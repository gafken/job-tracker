(function () {
  const JobTracker = window.JobTracker || (window.JobTracker = {});
  const API = JobTracker.API || "";

  function showAssistantDisabledState(message = "Add your Claude key in the backend environment to use the Assistant.") {
    const chatWindow = document.getElementById("chat-window");
    const chatInput = document.getElementById("chat-input");
    const chatForm = document.getElementById("chat-form");
    if (!chatWindow) return;

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
      const chatWindow = document.getElementById("chat-window");
      const chatInput = document.getElementById("chat-input");
      const chatForm = document.getElementById("chat-form");

      if (!data.configured) {
        showAssistantDisabledState();
        return false;
      }

      if (chatInput) chatInput.disabled = false;
      if (chatForm) {
        const submit = chatForm.querySelector("button[type='submit']");
        if (submit) submit.disabled = false;
      }
      if (chatWindow) chatWindow.dataset.loaded = "0";
      return true;
    } catch (err) {
      showAssistantDisabledState("The assistant is unavailable right now. Please check the backend configuration.");
      return false;
    }
  }

  function addChatMsg(role, content) {
    const chatWindow = document.getElementById("chat-window");
    if (!chatWindow) return;
    const div = document.createElement("div");
    div.className = `chat-msg ${role}`;
    div.textContent = content;
    chatWindow.appendChild(div);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  async function loadChatHistory() {
    const chatWindow = document.getElementById("chat-window");
    if (!chatWindow || chatWindow.dataset.loaded) return;
    const res = await fetch(`${API}/api/chat/history`);
    const history = await res.json();
    history.forEach(m => addChatMsg(m.role, m.content));
    chatWindow.dataset.loaded = "1";
  }

  function init() {
    const chatForm = document.getElementById("chat-form");
    const chatInput = document.getElementById("chat-input");
    if (!chatForm) return;

    chatForm.addEventListener("submit", async e => {
      e.preventDefault();
      if (chatInput && chatInput.disabled) return;
      const message = chatInput.value.trim();
      if (!message) return;
      addChatMsg("user", message);
      chatInput.value = "";

      const thinking = document.createElement("div");
      thinking.className = "chat-msg assistant";
      thinking.textContent = "Thinking…";
      const chatWindow = document.getElementById("chat-window");
      if (chatWindow) chatWindow.appendChild(thinking);

      try {
        const res = await fetch(`${API}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        });
        const data = await res.json();
        if (thinking.parentNode) thinking.parentNode.removeChild(thinking);
        addChatMsg("assistant", data.reply || "No response.");
      } catch (err) {
        if (thinking.parentNode) thinking.parentNode.removeChild(thinking);
        addChatMsg("assistant", "The assistant is unavailable right now.");
      }
    });

    const chatTabButton = document.querySelector('[data-tab="chat"]');
    if (chatTabButton) {
      chatTabButton.addEventListener("click", async () => {
        const configured = await ensureAssistantAvailable();
        if (configured) loadChatHistory();
      });
    }
  }

  JobTracker.chat = { showAssistantDisabledState, ensureAssistantAvailable, loadChatHistory, init };
  JobTracker.ensureAssistantAvailable = ensureAssistantAvailable;
  JobTracker.loadChatHistory = loadChatHistory;
  JobTracker.initChat = init;
})();
