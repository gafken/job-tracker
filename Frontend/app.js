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
let jobsPage = 1;
const JOBS_PAGE_SIZE = 10;
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
  const res = await fetch(`${API}/api/jobs?page=${jobsPage}&page_size=${JOBS_PAGE_SIZE}`);
  const data = await res.json();
  allJobs = Array.isArray(data) ? data : data.items || [];
  renderJobs();
  renderJobsPagination(data.pages || 1, data.page || jobsPage, data.total || allJobs.length);
}

function renderJobsPagination(totalPages, currentPage, totalCount) {
  const pagination = document.getElementById("jobs-pagination");
  pagination.innerHTML = "";

  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = currentPage <= 1;
  prev.addEventListener("click", () => {
    if (jobsPage > 1) {
      jobsPage -= 1;
      loadJobs();
    }
  });
  pagination.appendChild(prev);

  const label = document.createElement("span");
  label.textContent = `Page ${currentPage} of ${totalPages} • ${totalCount} total`;
  pagination.appendChild(label);

  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = currentPage >= totalPages;
  next.addEventListener("click", () => {
    if (jobsPage < totalPages) {
      jobsPage += 1;
      loadJobs();
    }
  });
  pagination.appendChild(next);
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
    tr.className = "job-row";
    tr.dataset.jobId = String(job.id);
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.innerHTML = `
      <td><a class="role-title" href="${job.url}" target="_blank" rel="noopener">${escapeHtml(job.title)}</a></td>
      <td class="company">${escapeHtml(job.company)}</td>
      <td>${escapeHtml(job.platform)}</td>
      <td class="${ageFlag ? 'age-flag' : ''}">${job.age_days}d</td>
      <td>${job.date_applied ? formatDate(job.date_applied) : "—"}</td>
      <td>
        <select class="status-select" data-id="${job.id}">
          ${STATUSES.map(s => `<option value="${s}" ${s === job.status ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </td>
      <td>
        <button class="followup-btn danger" data-delete-job="${job.id}">Delete</button>
      </td>
    `;

    tr.addEventListener("click", e => {
      if (e.target.closest("button") || e.target.closest("a") || e.target.closest("select")) return;
      openJobModal(job);
    });

    tr.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openJobModal(job);
      }
    });

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
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.deleteJob;
      const job = allJobs.find(j => String(j.id) === id);
      deleteTargetType = "job";
      deleteTargetId = String(id);
      deleteConfirmText.textContent = job
        ? `Delete ${job.title} at ${job.company}? This will permanently remove it from your tracked applications.`
        : "Delete this application? This will permanently remove it from your list.";
      setDeleteConfirmVisible(true);
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
let contactsPage = 1;
const CONTACTS_PAGE_SIZE = 10;

async function loadContacts() {
  const res = await fetch(`${API}/api/contacts?page=${contactsPage}&page_size=${CONTACTS_PAGE_SIZE}`);
  const data = await res.json();
  allContacts = Array.isArray(data) ? data : data.items || [];
  renderContacts();
  renderContactsPagination(data.pages || 1, data.page || contactsPage, data.total || allContacts.length);
}

function renderContactsPagination(totalPages, currentPage, totalCount) {
  const pagination = document.getElementById("contacts-pagination");
  pagination.innerHTML = "";

  const prev = document.createElement("button");
  prev.textContent = "Prev";
  prev.disabled = currentPage <= 1;
  prev.addEventListener("click", () => {
    if (contactsPage > 1) {
      contactsPage -= 1;
      loadContacts();
    }
  });
  pagination.appendChild(prev);

  const label = document.createElement("span");
  label.textContent = `Page ${currentPage} of ${totalPages} • ${totalCount} total`;
  pagination.appendChild(label);

  const next = document.createElement("button");
  next.textContent = "Next";
  next.disabled = currentPage >= totalPages;
  next.addEventListener("click", () => {
    if (contactsPage < totalPages) {
      contactsPage += 1;
      loadContacts();
    }
  });
  pagination.appendChild(next);
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

// ---------- Documents ----------
let allDocuments = [];

async function loadDocuments() {
  const res = await fetch(`${API}/api/documents`);
  const data = await res.json();
  allDocuments = Array.isArray(data) ? data : data.items || [];
  renderDocuments();
  renderDocumentStats();
}

function renderDocumentStats() {
  const total = allDocuments.length;
  const resumes = allDocuments.filter(d => d.document_type === "resume").length;
  const letters = allDocuments.filter(d => d.document_type === "recommendation_letter").length;
  const certificates = allDocuments.filter(d => d.document_type === "certificate").length;
  document.getElementById("document-stats").innerHTML =
    `<span><b>${total}</b> total</span><span><b>${resumes}</b> resumes</span><span><b>${letters}</b> letters</span><span><b>${certificates}</b> certs</span>`;
}

function renderDocuments() {
  const tbody = document.getElementById("documents-tbody");
  const empty = document.getElementById("documents-empty");
  tbody.innerHTML = "";
  empty.hidden = allDocuments.length > 0;

  allDocuments.forEach(doc => {
    const tr = document.createElement("tr");
    tr.className = "document-row";
    tr.dataset.documentId = String(doc.id);
    tr.tabIndex = 0;
    tr.setAttribute("role", "button");
    tr.innerHTML = `
      <td>${doc.url ? `<a class="doc-link" href="${doc.url}" target="_blank" rel="noopener">${escapeHtml(doc.title)}</a>` : escapeHtml(doc.title)}</td>
      <td><span class="badge badge-${doc.document_type}">${doc.document_type.replace(/_/g, " ")}</span></td>
      <td>${doc.file_name ? escapeHtml(doc.file_name) : (doc.url ? "link" : "—")}</td>
      <td>${escapeHtml(doc.notes || "—")}</td>
      <td>${formatDate(doc.date_added)}</td>
      <td>
        <button class="followup-btn danger" data-delete-document="${doc.id}">Delete</button>
      </td>
    `;

    tr.addEventListener("click", e => {
      if (e.target.closest("button") || e.target.closest("a")) return;
      openDocumentModal(doc);
    });

    tr.addEventListener("keydown", e => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDocumentModal(doc);
      }
    });

    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-delete-document]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.stopPropagation();
      const id = btn.dataset.deleteDocument;
      const documentItem = allDocuments.find(d => String(d.id) === id);
      deleteTargetType = "document";
      deleteTargetId = String(id);
      deleteConfirmText.textContent = documentItem
        ? `Delete ${documentItem.title}? This will permanently remove it from your document library.`
        : "Delete this document? This will permanently remove it from your list.";
      setDeleteConfirmVisible(true);
    });
  });
}

const jobModal = document.getElementById("job-modal-backdrop");
const jobForm = document.getElementById("job-form");
const jobModalTitle = document.getElementById("job-modal-title");
const jobSubmitButton = document.getElementById("job-submit");
const jobDeleteButton = document.getElementById("job-delete");
const contactModal = document.getElementById("contact-modal-backdrop");
const documentModal = document.getElementById("document-modal-backdrop");
const deleteConfirmModal = document.getElementById("delete-confirm-modal");
const contactForm = document.getElementById("contact-form");
const documentForm = document.getElementById("document-form");
const contactModalTitle = document.getElementById("contact-modal-title");
const documentModalTitle = document.getElementById("document-modal-title");
const contactSubmitButton = document.getElementById("contact-submit");
const documentSubmitButton = document.getElementById("document-submit");
const contactDeleteButton = document.getElementById("contact-delete");
const documentDeleteButton = document.getElementById("document-delete");
const deleteConfirmText = document.getElementById("delete-confirm-text");
let deleteTargetType = null;
let deleteTargetId = null;

function setJobModalVisible(visible) {
  jobModal.hidden = !visible;
  jobModal.style.display = visible ? "flex" : "none";
}

function setContactModalVisible(visible) {
  contactModal.hidden = !visible;
  contactModal.style.display = visible ? "flex" : "none";
}

function setDocumentModalVisible(visible) {
  documentModal.hidden = !visible;
  documentModal.style.display = visible ? "flex" : "none";
}

function setDeleteConfirmVisible(visible) {
  deleteConfirmModal.hidden = !visible;
  deleteConfirmModal.style.display = visible ? "flex" : "none";
}

function openJobModal(job = null) {
  const mode = job ? "edit" : "create";
  jobModalTitle.textContent = job ? "Edit application" : "Add application";
  jobSubmitButton.textContent = job ? "Save" : "Add";
  jobDeleteButton.hidden = !job;
  jobForm.dataset.mode = mode;
  jobForm.dataset.jobId = job ? String(job.id) : "";

  jobForm.reset();
  jobForm.elements.title.value = job?.title || "";
  jobForm.elements.company.value = job?.company || "";
  jobForm.elements.url.value = job?.url || "";
  jobForm.elements.platform.value = job?.platform || "other";
  jobForm.elements.location.value = job?.location || "";
  jobForm.elements.date_applied.value = job?.date_applied ? toDateInputValue(job.date_applied) : toDateInputValue(new Date());
  jobForm.elements.status.value = job?.status || "saved";
  jobForm.elements.notes.value = job?.notes || "";

  setJobModalVisible(true);
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

function openDocumentModal(documentItem = null) {
  const mode = documentItem ? "edit" : "create";
  documentModalTitle.textContent = documentItem ? "Edit document" : "Add document";
  documentSubmitButton.textContent = documentItem ? "Save" : "Add";
  documentDeleteButton.hidden = !documentItem;
  documentForm.dataset.mode = mode;
  documentForm.dataset.documentId = documentItem ? String(documentItem.id) : "";

  documentForm.reset();
  documentForm.elements.title.value = documentItem?.title || "";
  documentForm.elements.document_type.value = documentItem?.document_type || "resume";
  documentForm.elements.file_name.value = documentItem?.file_name || "";
  documentForm.elements.url.value = documentItem?.url || "";
  documentForm.elements.notes.value = documentItem?.notes || "";

  setDocumentModalVisible(true);
}

setJobModalVisible(false);
setContactModalVisible(false);
setDocumentModalVisible(false);
setDeleteConfirmVisible(false);

document.getElementById("add-job-btn").addEventListener("click", () => {
  openJobModal();
});
document.getElementById("add-contact-btn").addEventListener("click", () => {
  openContactModal();
});
const addDocumentButton = document.getElementById("add-document-btn");
if (addDocumentButton) {
  addDocumentButton.addEventListener("click", () => {
    openDocumentModal();
  });
}
document.getElementById("job-cancel").addEventListener("click", () => {
  setJobModalVisible(false);
});
document.getElementById("document-cancel").addEventListener("click", () => {
  setDocumentModalVisible(false);
});
jobDeleteButton.addEventListener("click", () => {
  const jobId = jobForm.dataset.jobId;
  if (!jobId) return;

  const job = allJobs.find(j => String(j.id) === jobId);
  deleteTargetType = "job";
  deleteTargetId = String(jobId);
  deleteConfirmText.textContent = job
    ? `Delete ${job.title} at ${job.company}? This will permanently remove it from your tracked applications.`
    : "Delete this application? This will permanently remove it from your list.";

  setJobModalVisible(false);
  setDeleteConfirmVisible(true);
});
jobForm.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  payload.status = payload.status || "saved";
  payload.platform = payload.platform || "other";
  payload.date_applied = payload.date_applied || null;

  const isEdit = jobForm.dataset.mode === "edit";
  const url = isEdit ? `${API}/api/jobs/${jobForm.dataset.jobId}` : `${API}/api/jobs`;
  const method = isEdit ? "PATCH" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  setJobModalVisible(false);
  e.target.reset();
  loadJobs();
});
document.getElementById("contact-cancel").addEventListener("click", () => {
  setContactModalVisible(false);
});
contactDeleteButton.addEventListener("click", () => {
  const contactId = contactForm.dataset.contactId;
  if (!contactId) return;

  const contact = allContacts.find(c => String(c.id) === contactId);
  deleteTargetType = "contact";
  deleteTargetId = String(contactId);
  deleteConfirmText.textContent = contact
    ? `Delete ${contact.name}? This will permanently remove them from your connection list.`
    : "Delete this connection? This will permanently remove it from your list.";

  setContactModalVisible(false);
  setDeleteConfirmVisible(true);
});
documentDeleteButton.addEventListener("click", () => {
  const documentId = documentForm.dataset.documentId;
  if (!documentId) return;

  const documentItem = allDocuments.find(d => String(d.id) === documentId);
  deleteTargetType = "document";
  deleteTargetId = String(documentId);
  deleteConfirmText.textContent = documentItem
    ? `Delete ${documentItem.title}? This will permanently remove it from your document library.`
    : "Delete this document? This will permanently remove it from your list.";

  setDocumentModalVisible(false);
  setDeleteConfirmVisible(true);
});
document.getElementById("delete-cancel").addEventListener("click", () => {
  setDeleteConfirmVisible(false);
});
document.getElementById("delete-confirm").addEventListener("click", async () => {
  if (!deleteTargetType || !deleteTargetId) return;

  if (deleteTargetType === "job") {
    await fetch(`${API}/api/jobs/${deleteTargetId}`, { method: "DELETE" });
    loadJobs();
  } else if (deleteTargetType === "contact") {
    await fetch(`${API}/api/contacts/${deleteTargetId}`, { method: "DELETE" });
    loadContacts();
  } else {
    await fetch(`${API}/api/documents/${deleteTargetId}`, { method: "DELETE" });
    loadDocuments();
  }

  deleteTargetType = null;
  deleteTargetId = null;
  setDeleteConfirmVisible(false);
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
documentForm.addEventListener("submit", async e => {
  e.preventDefault();
  const form = new FormData(e.target);
  const payload = Object.fromEntries(form.entries());
  payload.document_type = payload.document_type || "resume";

  const isEdit = documentForm.dataset.mode === "edit";
  const url = isEdit ? `${API}/api/documents/${documentForm.dataset.documentId}` : `${API}/api/documents`;
  const method = isEdit ? "PATCH" : "POST";

  await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  setDocumentModalVisible(false);
  e.target.reset();
  loadDocuments();
});

// ---------- Chat ----------
const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");

function bindFilePicker(button, input, type) {
  if (!button || !input) return;

  const displayIdMap = {
    resume: "resume-file-list",
    certificate: "certificate-file-list",
    recommendation_letter: "recommendation_letter-file-list",
    "recommendation-letter": "recommendation_letter-file-list",
  };

  button.addEventListener("click", () => {
    input.click();
  });

  input.addEventListener("change", async () => {
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const displayId = displayIdMap[type] || `${type}-file-list`;
    const display = document.getElementById(displayId);
    if (display) {
      display.innerHTML = "";
      files.forEach(file => {
        const pill = document.createElement("span");
        pill.className = "file-pill";
        pill.textContent = file.name;
        display.appendChild(pill);
      });
    }

    const payloads = files.map(file => ({
      title: file.name,
      document_type: type,
      file_name: file.name,
      url: "",
      notes: `Selected from browser: ${file.name}`,
    }));

    for (const payload of payloads) {
      await fetch(`${API}/api/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    input.value = "";
    loadDocuments();
  });
}

bindFilePicker(document.querySelector('[data-doc-type="resume"]'), document.getElementById("resume-file-input"), "resume");
bindFilePicker(document.querySelector('[data-doc-type="certificate"]'), document.getElementById("certificate-file-input"), "certificate");
bindFilePicker(document.querySelector('[data-doc-type="recommendation_letter"]'), document.getElementById("recommendation-letter-file-input"), "recommendation_letter");

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

function toDateInputValue(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const localDate = new Date(date.getTime() - (date.getTimezoneOffset() * 60000));
  return localDate.toISOString().split("T")[0];
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

loadJobs();
loadContacts();
loadDocuments();