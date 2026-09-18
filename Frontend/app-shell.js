(function () {
  const API = "";
  window.JobTracker = window.JobTracker || {};
  window.JobTracker.API = window.JobTracker.API || API;

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

  const deleteState = {
    type: null,
    id: null,
  };

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

  function setDeleteTarget(type, id) {
    deleteState.type = type;
    deleteState.id = id;
  }

  function getDeleteTarget() {
    return { type: deleteState.type, id: deleteState.id };
  }

  function clearDeleteTarget() {
    deleteState.type = null;
    deleteState.id = null;
  }

  function initSharedDeleteHandlers() {
    if (document.getElementById("delete-cancel")) {
      document.getElementById("delete-cancel").addEventListener("click", () => setDeleteConfirmVisible(false));
    }

    if (document.getElementById("delete-confirm")) {
      document.getElementById("delete-confirm").addEventListener("click", async () => {
        const { type, id } = getDeleteTarget();
        if (!type || !id) return;

        if (type === "job") {
          await fetch(`${window.JobTracker.API}/api/jobs/${id}`, { method: "DELETE" });
          if (window.JobTracker.loadJobs) window.JobTracker.loadJobs();
        } else if (type === "contact") {
          await fetch(`${window.JobTracker.API}/api/contacts/${id}`, { method: "DELETE" });
          if (window.JobTracker.loadContacts) window.JobTracker.loadContacts();
        } else {
          await fetch(`${window.JobTracker.API}/api/documents/${id}`, { method: "DELETE" });
          if (window.JobTracker.loadDocuments) window.JobTracker.loadDocuments();
        }

        clearDeleteTarget();
        setDeleteConfirmVisible(false);
      });
    }
  }

  function bootstrapDomainModules() {
    if (window.JobTracker.initJobs) window.JobTracker.initJobs();
    if (window.JobTracker.initContacts) window.JobTracker.initContacts();
    if (window.JobTracker.initDocuments) window.JobTracker.initDocuments();
    if (window.JobTracker.initChat) window.JobTracker.initChat();
    initTabNavigation();
  }

  window.JobTracker = Object.assign(window.JobTracker, {
    API: window.JobTracker.API || API,
    setJobModalVisible,
    setContactModalVisible,
    setDocumentModalVisible,
    setDeleteConfirmVisible,
    openJobModal,
    openContactModal,
    openDocumentModal,
    setDeleteTarget,
    getDeleteTarget,
    clearDeleteTarget,
    toDateInputValue,
    formatDate,
    escapeHtml,
    initTabNavigation,
    initSharedDeleteHandlers,
    bootstrapDomainModules,
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

  initSharedDeleteHandlers();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrapDomainModules, { once: true });
  } else {
    bootstrapDomainModules();
  }
})();
