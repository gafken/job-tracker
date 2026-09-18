(function () {
  const JobTracker = window.JobTracker || (window.JobTracker = {});
  const API = JobTracker.API || "";
  const state = {
    allDocuments: [],
  };

  function renderDocumentStats() {
    const total = state.allDocuments.length;
    const resumes = state.allDocuments.filter(d => d.document_type === "resume").length;
    const letters = state.allDocuments.filter(d => d.document_type === "recommendation_letter").length;
    const certificates = state.allDocuments.filter(d => d.document_type === "certificate").length;
    const stats = document.getElementById("document-stats");
    if (stats) {
      stats.innerHTML = `<span><b>${total}</b> total</span><span><b>${resumes}</b> resumes</span><span><b>${letters}</b> letters</span><span><b>${certificates}</b> certs</span>`;
    }
  }

  function renderDocuments() {
    const tbody = document.getElementById("documents-tbody");
    const empty = document.getElementById("documents-empty");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (empty) empty.hidden = state.allDocuments.length > 0;

    state.allDocuments.forEach(doc => {
      const tr = document.createElement("tr");
      tr.className = "document-row";
      tr.dataset.documentId = String(doc.id);
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.innerHTML = `
        <td>${doc.url ? `<a class="doc-link" href="${doc.url}" target="_blank" rel="noopener">${JobTracker.escapeHtml(doc.title)}</a>` : JobTracker.escapeHtml(doc.title)}</td>
        <td><span class="badge badge-${doc.document_type}">${doc.document_type.replace(/_/g, " ")}</span></td>
        <td>${doc.file_name ? JobTracker.escapeHtml(doc.file_name) : (doc.url ? "link" : "—")}</td>
        <td>${JobTracker.escapeHtml(doc.notes || "—")}</td>
        <td>${JobTracker.formatDate(doc.date_added)}</td>
        <td>
          <button class="followup-btn danger" data-delete-document="${doc.id}">Delete</button>
        </td>
      `;

      tr.addEventListener("click", e => {
        if (e.target.closest("button") || e.target.closest("a")) return;
        JobTracker.openDocumentModal(doc);
      });

      tr.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          JobTracker.openDocumentModal(doc);
        }
      });

      tbody.appendChild(tr);
    });

    tbody.querySelectorAll("[data-delete-document]").forEach(btn => {
      btn.addEventListener("click", e => {
        e.stopPropagation();
        const id = btn.dataset.deleteDocument;
        const documentItem = state.allDocuments.find(d => String(d.id) === id);
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = documentItem
            ? `Delete ${documentItem.title}? This will permanently remove it from your document library.`
            : "Delete this document? This will permanently remove it from your list.";
        }
        JobTracker.setDeleteTarget("document", String(id));
        JobTracker.setDeleteConfirmVisible(true);
      });
    });
  }

  async function loadDocuments() {
    const res = await fetch(`${API}/api/documents`);
    const data = await res.json();
    state.allDocuments = Array.isArray(data) ? data : data.items || [];
    renderDocuments();
    renderDocumentStats();
  }

  function bindFilePicker(button, input, type) {
    if (!button || !input) return;
    const displayIdMap = {
      resume: "resume-file-list",
      certificate: "certificate-file-list",
      recommendation_letter: "recommendation_letter-file-list",
    };

    button.addEventListener("click", () => input.click());

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

  function init() {
    const addDocumentButton = document.getElementById("add-document-btn");
    if (addDocumentButton) {
      addDocumentButton.addEventListener("click", () => {
        JobTracker.openDocumentModal();
      });
    }

    const documentForm = document.getElementById("document-form");
    if (documentForm) {
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

        JobTracker.setDocumentModalVisible(false);
        e.target.reset();
        loadDocuments();
      });
    }

    const documentDeleteButton = document.getElementById("document-delete");
    if (documentDeleteButton) {
      documentDeleteButton.addEventListener("click", () => {
        const documentId = documentForm.dataset.documentId;
        if (!documentId) return;

        const documentItem = state.allDocuments.find(d => String(d.id) === documentId);
        JobTracker.setDeleteTarget("document", String(documentId));
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = documentItem
            ? `Delete ${documentItem.title}? This will permanently remove it from your document library.`
            : "Delete this document? This will permanently remove it from your list.";
        }

        JobTracker.setDocumentModalVisible(false);
        JobTracker.setDeleteConfirmVisible(true);
      });
    }

    bindFilePicker(document.querySelector('[data-doc-type="resume"]'), document.getElementById("resume-file-input"), "resume");
    bindFilePicker(document.querySelector('[data-doc-type="certificate"]'), document.getElementById("certificate-file-input"), "certificate");
    bindFilePicker(document.querySelector('[data-doc-type="recommendation_letter"]'), document.getElementById("recommendation-letter-file-input"), "recommendation_letter");

    loadDocuments();
  }

  JobTracker.documents = { state, loadDocuments, renderDocuments, init };
  JobTracker.loadDocuments = loadDocuments;
  JobTracker.initDocuments = init;
})();
