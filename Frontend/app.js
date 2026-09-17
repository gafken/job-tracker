const API = "";

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "chat") loadChatHistory();
  });
});

// ---------- Jobs ----------
let currentFilter = "all";
const STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "ghosted", "withdrawn"];

document.querySelectorAll("#job-filters .filter-chip").forEach(chip => {
  chip.addEventListener("click", () => {
    document.querySelectorAll("#job-filters .filter-chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    currentFilter = chip.dataset.status;
    renderJobs();
  });
});

let allJobs = [];

async function loadJobs() {
  const res = await fetch(`${API}/api/jobs`);
  allJobs = await res.json();
  renderJobs();
}

function renderJobs() {
  const tbody = document.getElementById("jobs-tbody");
  const empty = document.getElementById("jobs-empty");
  const filtered = currentFilter === "all" ? allJobs : allJobs.filter(j => j.status === currentFilter);

  tbody.innerHTML = "";
  empty.hidden = filtered.length > 0;

  filtered.forEach(job => {
    const tr = document.createElement("tr");
    const ageFlag = job.age_days >= 14 && ["saved", "applied", "interviewing"].includes(job.status);
    tr.innerHTML = `
      <td><a class="role-title" href="${job.url}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></td>
      <td class="company">${escapeHtml(job.company)}</td>
      <td>${escapeHtml(job.platform)}</td>
      <td class="${ageFlag ? 'age-flag' : ''}">${job.age_days}d</td>
      <td>
        <select class="status-select" data-id="${job.id}">
          ${STATUSES.map(s => `<option value="${s}" ${s === job.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td><button class="followup-btn" data-delete-job="${job.id}">Remove</button></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll(".status-select").forEach(sel => {
    sel.addEventListener("change", async () => {
      await fetch(`${API}/api/jobs/${sel.dataset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: sel.value }),
      });
      loadJobs();
    });
  });

  tbody.querySelectorAll("[data-delete-job]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/api/jobs/${btn.dataset.deleteJob}`, { method: "DELETE" });
      loadJobs();
    });
  });

  renderJobStats();
}

function renderJobStats() {
  const total = allJobs.length;
  const active = allJobs.filter(j => ["saved", "applied", "interviewing"].includes(j.status)).length;
  const stale = allJobs.filter(j => j.age_days >= 14 && ["saved", "applied", "interviewing"].includes(j.status)).length;
  document.getElementById("job-stats").innerHTML =
    `<span><b>${total}</b> tracked</span><span><b>${active}</b> active</span><span class="age-flag"><b>${stale}</b> stale 14d+</span>`;
}

// ---------- Contacts ----------
let allContacts = [];

async function loadContacts() {
  const res = await fetch(`${API}/api/contacts`);
  allContacts = await res.json();
  renderContacts();
}

function renderContacts() {
  const tbody = document.getElementById("contacts-tbody");
  const empty = document.getElementById("contacts-empty");
  tbody.innerHTML = "";
  empty.hidden = allContacts.length > 0;

  allContacts.forEach(c => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)}</td>
      <td class="company">${escapeHtml(c.role || "")}${c.role && c.company ? " · " : ""}${escapeHtml(c.company || "")}</td>
      <td>${c.days_pending}d ago</td>
      <td><span class="badge badge-${c.status}">${c.status}</span></td>
      <td>${c.needs_follow_up ? `<button class="followup-btn" data-followup="${c.id}">Mark followed up</button>` : (c.status === "pending" ? "not yet" : "—")}</td>
      <td>
        ${c.status === "pending" ? `<button class="followup-btn" data-accept="${c.id}">Mark accepted</button>` : ""}
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-followup]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/api/contacts/${btn.dataset.followup}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followed_up: true }),
      });
      loadContacts();
    });
  });

  tbody.querySelectorAll("[data-accept]").forEach(btn => {
    btn.addEventListener("click", async () => {
      await fetch(`${API}/api/contacts/${btn.dataset.accept}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "accepted" }),
      });
      loadContacts();
    });
  });

  renderContactStats();
}

function renderContactStats() {
  const total = allContacts.length;
  const pending = allContacts.filter(c => c.status === "pending").length;
  const needsFollowup = allContacts.filter(c => c.needs_follow_up).length;
  document.getElementById("contact-stats").innerHTML =
    `<span><b>${total}</b> tracked</span><span><b>${pending}</b> pending</span><span class="age-flag"><b>${needsFollowup}</b> need follow-up</span>`;
}

document.getElementById("add-contact-btn").addEventListener("click", () => {
  document.getElementById("contact-modal-backdrop").hidden = false;
});
document.getElementById("contact-cancel").addEventListener("click", () => {
  document.getElementById("contact-modal-backdrop").hidden = true;
});
document.getElementById("contact-form").addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  payload.follow_up_after_days = parseInt(payload.follow_up_after_days || "10", 10);
  await fetch(`${API}/api/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  document.getElementById("contact-modal-backdrop").hidden = true;
  e.target.reset();
  loadContacts();
});

// ---------- Chat ----------
const chatWindow = document.getElementById("chat-window");

function addChatMsg(role, content) {
  const div = document.createElement("div");
  div.className = `chat-msg ${role}`;
  div.textContent = content;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

async function loadChatHistory() {
  if (chatWindow.dataset.loaded) return;
  const res = await fetch(`${API}/api/chat/history`);
  const history = await res.json();
  history.forEach(m => addChatMsg(m.role, m.content));
  chatWindow.dataset.loaded = "1";
}

document.getElementById("chat-form").addEventListener("submit", async e => {
  e.preventDefault();
  const input = document.getElementById("chat-input");
  const message = input.value.trim();
  if (!message) return;
  addChatMsg("user", message);
  input.value = "";
  const thinking = document.createElement("div");
  thinking.className = "chat-msg assistant";
  thinking.textContent = "…";
  chatWindow.appendChild(thinking);
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json();
    thinking.textContent = data.reply;
  } catch (err) {
    thinking.textContent = "Error reaching the assistant. Is ANTHROPIC_API_KEY set on the backend?";
  }
});

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadJobs();
loadContacts();