(function () {
  const JobTracker = window.JobTracker || (window.JobTracker = {});
  const API = JobTracker.API || "";
  const state = {
    allContacts: [],
    contactsPage: 1,
    CONTACTS_PAGE_SIZE: 10,
  };

  function renderContactsPagination(totalPages, currentPage, totalCount) {
    const pagination = document.getElementById("contacts-pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => {
      if (state.contactsPage > 1) {
        state.contactsPage -= 1;
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
      if (state.contactsPage < totalPages) {
        state.contactsPage += 1;
        loadContacts();
      }
    });
    pagination.appendChild(next);
  }

  function renderContactStats() {
    const total = state.allContacts.length;
    const pending = state.allContacts.filter(c => c.status === "pending").length;
    const needsFollowup = state.allContacts.filter(c => c.needs_follow_up).length;
    const stats = document.getElementById("contact-stats");
    if (stats) {
      stats.innerHTML = `<span><b>${total}</b> tracked</span><span><b>${pending}</b> pending</span><span class="age-flag"><b>${needsFollowup}</b> need follow-up</span>`;
    }
  }

  function renderContacts() {
    const tbody = document.getElementById("contacts-tbody");
    const empty = document.getElementById("contacts-empty");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (empty) empty.hidden = state.allContacts.length > 0;

    state.allContacts.forEach(c => {
      const tr = document.createElement("tr");
      tr.className = "contact-row";
      tr.dataset.contactId = String(c.id);
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.innerHTML = `
        <td>${c.linkedin_url ? `<a href="${c.linkedin_url}" target="_blank" rel="noopener">${JobTracker.escapeHtml(c.name)}</a>` : JobTracker.escapeHtml(c.name)}</td>
        <td class="company">${JobTracker.escapeHtml(c.role || "")}${c.role && c.company ? " · " : ""}${JobTracker.escapeHtml(c.company || "")}</td>
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
        JobTracker.openContactModal(c);
      });

      tr.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          JobTracker.openContactModal(c);
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
        const contact = state.allContacts.find(c => String(c.id) === id);
        JobTracker.setDeleteTarget("contact", String(id));
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = contact
            ? `Delete ${contact.name}? This will permanently remove them from your connection list.`
            : "Delete this connection? This will permanently remove it from your list.";
        }
        JobTracker.setDeleteConfirmVisible(true);
      });
    });

    renderContactStats();
  }

  async function loadContacts() {
    const res = await fetch(`${API}/api/contacts?page=${state.contactsPage}&page_size=${state.CONTACTS_PAGE_SIZE}`);
    const data = await res.json();
    state.allContacts = Array.isArray(data) ? data : data.items || [];
    renderContacts();
    renderContactsPagination(data.pages || 1, data.page || state.contactsPage, data.total || state.allContacts.length);
  }

  function init() {
    const addContactButton = document.getElementById("add-contact-btn");
    if (addContactButton) {
      addContactButton.addEventListener("click", () => {
        JobTracker.openContactModal();
      });
    }

    const contactForm = document.getElementById("contact-form");
    if (contactForm) {
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

        JobTracker.setContactModalVisible(false);
        e.target.reset();
        loadContacts();
      });
    }

    const contactDeleteButton = document.getElementById("contact-delete");
    if (contactDeleteButton) {
      contactDeleteButton.addEventListener("click", () => {
        const contactId = contactForm.dataset.contactId;
        if (!contactId) return;

        const contact = state.allContacts.find(c => String(c.id) === contactId);
        JobTracker.setDeleteTarget("contact", String(contactId));
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = contact
            ? `Delete ${contact.name}? This will permanently remove them from your connection list.`
            : "Delete this connection? This will permanently remove it from your list.";
        }

        JobTracker.setContactModalVisible(false);
        JobTracker.setDeleteConfirmVisible(true);
      });
    }

    loadContacts();
  }

  JobTracker.contacts = { state, loadContacts, renderContacts, init };
  JobTracker.loadContacts = loadContacts;
  JobTracker.initContacts = init;
})();
