const API = "";
window.JobTracker = window.JobTracker || {};
window.JobTracker.API = API;

const jobModal = document.getElementById("job-modal-backdrop");
const jobForm = document.getElementById("job-form");
const jobModalTitle = document.getElementById("job-modal-title");
const jobSubmitButton = document.getElementById("job-submit");
const jobDeleteButton = document.getElementById("job-delete");
const contactModal = document.getElementById("contact-modal-backdrop");
const contactForm = document.getElementById("contact-form");
const contactModalTitle = document.getElementById("contact-modal-title");
const contactSubmitButton = document.getElementById("contact-submit");
const contactDeleteButton = document.getElementById("contact-delete");
const documentModal = document.getElementById("document-modal-backdrop");
const documentForm = document.getElementById("document-form");
const documentModalTitle = document.getElementById("document-modal-title");
const documentSubmitButton = document.getElementById("document-submit");
const documentDeleteButton = document.getElementById("document-delete");
const deleteConfirmModal = document.getElementById("delete-confirm-modal");
const deleteConfirmText = document.getElementById("delete-confirm-text");

let deleteTargetType = null;
let deleteTargetId = null;

function setJobModalVisible(visible) {
  if (jobModal) {
    jobModal.hidden = !visible;
    jobModal.style.display = visible ? "flex" : "none";
  }
}

function setContactModalVisible(visible) {
  if (contactModal) {
    contactModal.hidden = !visible;
    contactModal.style.display = visible ? "flex" : "none";
  }
}

function setDocumentModalVisible(visible) {
  if (documentModal) {
    documentModal.hidden = !visible;
    documentModal.style.display = visible ? "flex" : "none";
  }
}

function setDeleteConfirmVisible(visible) {
  if (deleteConfirmModal) {
    deleteConfirmModal.hidden = !visible;
    deleteConfirmModal.style.display = visible ? "flex" : "none";
  }
}

function openJobModal(job = null) {
  if (!jobForm || !jobModalTitle || !jobSubmitButton || !jobDeleteButton) return;
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
  if (!contactForm || !contactModalTitle || !contactSubmitButton || !contactDeleteButton) return;
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
  if (!documentForm || !documentModalTitle || !documentSubmitButton || !documentDeleteButton) return;
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

function initTabNavigation() {
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById("tab-" + btn.dataset.tab);
      if (target) target.classList.add("active");
      if (btn.dataset.tab === "chat" && window.JobTracker.ensureAssistantAvailable) {
        const configured = await window.JobTracker.ensureAssistantAvailable();
        if (configured && window.JobTracker.loadChatHistory) window.JobTracker.loadChatHistory();
      }
    });
  });
}

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

window.JobTracker = Object.assign(window.JobTracker, {
  API,
  setJobModalVisible,
  setContactModalVisible,
  setDocumentModalVisible,
  setDeleteConfirmVisible,
  openJobModal,
  openContactModal,
  openDocumentModal,
  deleteTargetType,
  deleteTargetId,
  get deleteTarget() { return { type: deleteTargetType, id: deleteTargetId }; },
  set deleteTarget(value) {
    deleteTargetType = value?.type || null;
    deleteTargetId = value?.id || null;
  },
  setDeleteTarget: (type, id) => {
    deleteTargetType = type;
    deleteTargetId = id;
  },
  deleteConfirmText,
  formatDate,
  escapeHtml,
  toDateInputValue,
  initTabNavigation,
});

setJobModalVisible(false);
setContactModalVisible(false);
setDocumentModalVisible(false);
setDeleteConfirmVisible(false);

if (document.getElementById("job-cancel")) {
  document.getElementById("job-cancel").addEventListener("click", () => setJobModalVisible(false));
}
if (document.getElementById("contact-cancel")) {
  document.getElementById("contact-cancel").addEventListener("click", () => setContactModalVisible(false));
}
if (document.getElementById("document-cancel")) {
  document.getElementById("document-cancel").addEventListener("click", () => setDocumentModalVisible(false));
}
if (document.getElementById("delete-cancel")) {
  document.getElementById("delete-cancel").addEventListener("click", () => setDeleteConfirmVisible(false));
}
if (document.getElementById("delete-confirm")) {
  document.getElementById("delete-confirm").addEventListener("click", async () => {
    if (!deleteTargetType || !deleteTargetId) return;

    if (deleteTargetType === "job") {
      await fetch(`${API}/api/jobs/${deleteTargetId}`, { method: "DELETE" });
      if (window.JobTracker.loadJobs) window.JobTracker.loadJobs();
    } else if (deleteTargetType === "contact") {
      await fetch(`${API}/api/contacts/${deleteTargetId}`, { method: "DELETE" });
      if (window.JobTracker.loadContacts) window.JobTracker.loadContacts();
    } else {
      await fetch(`${API}/api/documents/${deleteTargetId}`, { method: "DELETE" });
      if (window.JobTracker.loadDocuments) window.JobTracker.loadDocuments();
    }

    deleteTargetType = null;
    deleteTargetId = null;
    setDeleteConfirmVisible(false);
  });
}

initTabNavigation();

if (window.JobTracker.initJobs) window.JobTracker.initJobs();
if (window.JobTracker.initContacts) window.JobTracker.initContacts();
if (window.JobTracker.initDocuments) window.JobTracker.initDocuments();
if (window.JobTracker.initChat) window.JobTracker.initChat();
if (window.JobTracker.ensureAssistantAvailable) window.JobTracker.ensureAssistantAvailable();