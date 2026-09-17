const API = "";

// ---------- Tabs ----------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", async () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "chat") {
      const configured = await ensureAssistantAvailable();
      if (configured) loadChatHistory();
    }
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
    tr.className = "contact-row";
    tr.dataset.contactId = String(c.id);
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.innerHTML = `
      <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" rel="noopener">${escapeHtml(c.name)}</a>` : escapeHtml(c.name)}</td>
      <td class="company">${escapeHtml(c.role || "")}${c.role && c.company ? " · " : ""}${escapeHtml(c.company || "")}</td>
      <td>${c.days_pending}d ago</td>
      <td><span class="badge badge-${c.status}">${c.status}</span></td>
      <td>${c.needs_follow_up ? `<button class="followup-btn" data-followup="${c.id}">Mark followed up</button>` : (c.status === "pending" ? "not yet" : "—")}</td>
      <td>
        <div class="row-actions">
          ${c.status === "pending" ? `<button class="followup-btn" data-accept="${c.id}">Mark accepted</button>` : ""}
          <button class="followup-btn danger" data-delete-contact="${c.id}">Delete</button>
        </div>
      </td>
    `;

    tr.addEventListener("click", e => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      openContactModal(c);
    });

    tr.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openContactModal(c);
      }
    });

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

  tbody.querySelectorAll("[data-delete-contact]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.deleteContact;
      const contact = allContacts.find(c => String(c.id) === id);
      contactForm.dataset.contactId = String(id);
      deleteConfirmText.textContent = contact
        ? `Delete ${contact.name}? This will permanently remove them from your connection list.`
        : "Delete this connection? This will permanently remove it from your list.";

      setDeleteConfirmVisible(true);
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

const contactModal = document.getElementById("contact-modal-backdrop");
const deleteConfirmModal = document.getElementById("delete-confirm-modal");
const contactForm = document.getElementById("contact-form");
const contactModalTitle = document.getElementById("contact-modal-title");
const contactSubmitButton = document.getElementById("contact-submit");
const contactDeleteButton = document.getElementById("contact-delete");
const deleteConfirmText = document.getElementById("delete-confirm-text");

function setContactModalVisible(visible) {
  contactModal.hidden = !visible;
  contactModal.style.display = visible ? "flex" : "none";
}

function setDeleteConfirmVisible(visible) {
  deleteConfirmModal.hidden = !visible;
  deleteConfirmModal.style.display = visible ? "flex" : "none";
}

function openContactModal(contact = null) {
  const mode = contact ? "edit" : "create";
  contactModalTitle.textContent = contact ? "Edit connection request" : "Add connection request";
  contactSubmitButton.textContent = contact ? "Save" : "Add";
  contactDeleteButton.hidden = !contact;
  contactForm.dataset.mode = mode;
  contactForm.dataset.contactId = contact ? String(contact.id) : "";

  contactForm.reset();
  contactForm.elements.name.value = contact?.name || "";
  contactForm.elements.linkedin_url.value = contact?.linkedin_url || "";
  contactForm.elements.company.value = contact?.company || "";
  contactForm.elements.role.value = contact?.role || "";
  contactForm.elements.status.value = contact?.status || "pending";
  contactForm.elements.follow_up_after_days.value = contact?.follow_up_after_days || 10;
  contactForm.elements.followed_up.checked = Boolean(contact && contact.followed_up);
  contactForm.elements.notes.value = contact?.notes || "";

  setContactModalVisible(true);
}

setContactModalVisible(false);
setDeleteConfirmVisible(false);

document.getElementById("add-contact-btn").addEventListener("click", () => {
  openContactModal();
});
document.getElementById("contact-cancel").addEventListener("click", () => {
  setContactModalVisible(false);
});
contactDeleteButton.addEventListener("click", () => {
  const contactId = contactForm.dataset.contactId;
  if (!contactId) return;

  const contact = allContacts.find(c => String(c.id) === contactId);
  deleteConfirmText.textContent = contact
    ? `Delete ${contact.name}? This will permanently remove them from your connection list.`
    : "Delete this connection? This will permanently remove it from your list.";

  setContactModalVisible(false);
  setDeleteConfirmVisible(true);
});
document.getElementById("delete-cancel").addEventListener("click", () => {
  setDeleteConfirmVisible(false);
});
document.getElementById("delete-confirm").addEventListener("click", async () => {
  const contactId = contactForm.dataset.contactId;
  if (!contactId) return;

  await fetch(`${API}/api/contacts/${contactId}`, { method: "DELETE" });
  setDeleteConfirmVisible(false);
  loadContacts();
});
contactForm.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  payload.follow_up_after_days = parseInt(payload.follow_up_after_days || "10", 10);
  payload.followed_up = Boolean(payload.followed_up);
  payload.status = payload.status || "pending";

  const isEdit = contactForm.dataset.mode === "edit";
  const url = isEdit ? `${API}/api/contacts/${contactForm.dataset.contactId}` : `${API}/api/contacts`;
  const method = isEdit ? "PATCH" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  setContactModalVisible(false);
  e.target.reset();
  loadContacts();
});

// ---------- Chat ----------
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

function showAssistantDisabledState(message = "Add your Claude key in the backend environment to use the Assistant.") {
  chatWindow.innerHTML = "";
  const div = document.createElement("div");
  div.className = "chat-msg assistant";
  div.textContent = message;
  chatWindow.appendChild(div);
  chatWindow.dataset.loaded = "1";
  if (chatInput) chatInput.disabled = true;
  if (chatForm) {
    const submit = chatForm.querySelector("button[type='submit']");
    if (submit) submit.disabled = true;
  }
}

async function ensureAssistantAvailable() {
  try {
    const res = await fetch(`${API}/api/chat/status`);
    const data = await res.json();
    if (!data.configured) {
      showAssistantDisabledState();
      return false;
    }

    if (chatInput) chatInput.disabled = false;
    if (chatForm) {
      const submit = chatForm.querySelector("button[type='submit']");
      if (submit) submit.disabled = false;
    }
    return true;
  } catch (err) {
    showAssistantDisabledState("The assistant is unavailable right now. Please check the backend configuration.");
    return false;
  }
}

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

chatForm.addEventListener("submit", async e => {
  e.preventDefault();
  if (chatInput && chatInput.disabled) return;
  const message = chatInput.value.trim();
  if (!message) return;
  addChatMsg("user", message);
  chatInput.value = "";
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

ensureAssistantAvailable();

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadJobs();
loadContacts();