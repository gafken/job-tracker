(function () {
  const JobTracker = window.JobTracker || (window.JobTracker = {});
  const API = JobTracker.API || "";
  const state = {
    currentFilter: "all",
    jobsPage: 1,
    JOBS_PAGE_SIZE: 10,
    STATUSES: ["saved", "applied", "interviewing", "offer", "rejected", "ghosted", "withdrawn"],
    allJobs: [],
  };

  function renderJobsPagination(totalPages, currentPage, totalCount) {
    const pagination = document.getElementById("jobs-pagination");
    if (!pagination) return;
    pagination.innerHTML = "";

    const prev = document.createElement("button");
    prev.textContent = "Prev";
    prev.disabled = currentPage <= 1;
    prev.addEventListener("click", () => {
      if (state.jobsPage > 1) {
        state.jobsPage -= 1;
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
      if (state.jobsPage < totalPages) {
        state.jobsPage += 1;
        loadJobs();
      }
    });
    pagination.appendChild(next);
  }

  function renderJobStats() {
    const total = state.allJobs.length;
    const active = state.allJobs.filter(j => ["saved", "applied", "interviewing"].includes(j.status)).length;
    const stale = state.allJobs.filter(j => j.age_days >= 14 && ["saved", "applied", "interviewing"].includes(j.status)).length;
    const stats = document.getElementById("job-stats");
    if (stats) {
      stats.innerHTML = `<span><b>${total}</b> tracked</span><span><b>${active}</b> active</span><span class="age-flag"><b>${stale}</b> stale 14d+</span>`;
    }
  }

  function renderJobs() {
    const tbody = document.getElementById("jobs-tbody");
    const empty = document.getElementById("jobs-empty");
    if (!tbody) return;

    const filtered = state.currentFilter === "all" ? state.allJobs : state.allJobs.filter(j => j.status === state.currentFilter);
    tbody.innerHTML = "";
    if (empty) empty.hidden = filtered.length > 0;

    filtered.forEach(job => {
      const tr = document.createElement("tr");
      const ageFlag = job.age_days >= 14 && ["saved", "applied", "interviewing"].includes(job.status);
      tr.className = "job-row";
      tr.dataset.jobId = String(job.id);
      tr.tabIndex = 0;
      tr.setAttribute("role", "button");
      tr.innerHTML = `
        <td><a class="role-title" href="${job.url}" target="_blank" rel="noopener">${JobTracker.escapeHtml(job.title)}</a></td>
        <td class="company">${JobTracker.escapeHtml(job.company)}</td>
        <td>${JobTracker.escapeHtml(job.platform)}</td>
        <td class="${ageFlag ? "age-flag" : ""}">${job.age_days}d</td>
        <td>${job.date_applied ? JobTracker.formatDate(job.date_applied) : "—"}</td>
        <td>
          <select class="status-select" data-id="${job.id}">
            ${state.STATUSES.map(s => `<option value="${s}" ${s === job.status ? "selected" : ""}>${s}</option>`).join("")}
          </select>
        </td>
        <td>
          <button class="followup-btn danger" data-delete-job="${job.id}">Delete</button>
        </td>
      `;

      tr.addEventListener("click", e => {
        if (e.target.closest("button") || e.target.closest("a") || e.target.closest("select")) return;
        JobTracker.openJobModal(job);
      });

      tr.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          JobTracker.openJobModal(job);
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
        const job = state.allJobs.find(j => String(j.id) === id);
        JobTracker.setDeleteTarget("job", String(id));
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = job
            ? `Delete ${job.title} at ${job.company}? This will permanently remove it from your tracked applications.`
            : "Delete this application? This will permanently remove it from your list.";
        }
        JobTracker.setDeleteConfirmVisible(true);
      });
    });

    renderJobStats();
  }

  async function loadJobs() {
    const res = await fetch(`${API}/api/jobs?page=${state.jobsPage}&page_size=${state.JOBS_PAGE_SIZE}`);
    const data = await res.json();
    state.allJobs = Array.isArray(data) ? data : data.items || [];
    renderJobs();
    renderJobsPagination(data.pages || 1, data.page || state.jobsPage, data.total || state.allJobs.length);
  }

  function init() {
    document.querySelectorAll("#job-filters .filter-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        document.querySelectorAll("#job-filters .filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        state.currentFilter = chip.dataset.status;
        renderJobs();
      });
    });

    const addJobButton = document.getElementById("add-job-btn");
    if (addJobButton) {
      addJobButton.addEventListener("click", () => {
        JobTracker.openJobModal();
      });
    }

    const jobForm = document.getElementById("job-form");
    if (jobForm) {
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

        JobTracker.setJobModalVisible(false);
        e.target.reset();
        loadJobs();
      });
    }

    const jobDeleteButton = document.getElementById("job-delete");
    if (jobDeleteButton) {
      jobDeleteButton.addEventListener("click", () => {
        const jobId = jobForm.dataset.jobId;
        if (!jobId) return;

        const job = state.allJobs.find(j => String(j.id) === jobId);
        JobTracker.setDeleteTarget("job", String(jobId));
        const text = document.getElementById("delete-confirm-text");
        if (text) {
          text.textContent = job
            ? `Delete ${job.title} at ${job.company}? This will permanently remove it from your tracked applications.`
            : "Delete this application? This will permanently remove it from your list.";
        }

        JobTracker.setJobModalVisible(false);
        JobTracker.setDeleteConfirmVisible(true);
      });
    }

    loadJobs();
  }

  JobTracker.jobs = { state, loadJobs, renderJobs, init };
  JobTracker.loadJobs = loadJobs;
  JobTracker.initJobs = init;
})();
