import { requireLogin, bindUserNav } from "./auth.js";
import { getNotes } from "./storage.js";
import { checkBackendHealth } from "./ai.js";

async function initDashboard() {
  const user = await requireLogin();
  if (!user) return;

  bindUserNav(user);

  document.getElementById("welcome").textContent = "Welcome, " + user.name;
  document.getElementById("profileEmail").textContent = user.email;

  const [notesResult, health] = await Promise.allSettled([
    getNotes(user),
    checkBackendHealth()
  ]);

  const aiStatusEl = document.getElementById("aiStatusText");
  const backend = health.status === "fulfilled" ? health.value : { online: false };
  if (backend.online && backend.geminiConfigured && backend.firebaseAdminConfigured) {
    aiStatusEl.textContent = "Connected (" + backend.model + ")";
    aiStatusEl.style.color = "var(--success)";
  } else if (backend.online && !backend.firebaseAdminConfigured) {
    aiStatusEl.textContent = "Add Firebase Admin credentials";
    aiStatusEl.style.color = "#b45309";
  } else if (backend.online && !backend.geminiConfigured) {
    aiStatusEl.textContent = "Add Gemini API key";
    aiStatusEl.style.color = "#b45309";
  } else {
    aiStatusEl.textContent = "Offline (start server)";
    aiStatusEl.style.color = "var(--danger)";
  }

  const recentEl = document.getElementById("recentNotes");
  if (notesResult.status === "rejected") {
    console.error("Failed to load notes:", notesResult.reason);
    document.getElementById("noteCount").textContent = "—";
    recentEl.innerHTML = "<p class='status error'>Could not load your notes. Refresh to try again.</p>";
    return;
  }
  const notes = notesResult.value;
  document.getElementById("noteCount").textContent = String(notes.length);
  if (!notes.length) {
    recentEl.innerHTML =
      "<p class='status'>No notes saved yet. <a href='upload.html'>Upload your first note</a> to get started.</p>";
    return;
  }

  recentEl.innerHTML = "";
  notes.slice(0, 4).forEach((note) => {
    const item = document.createElement("div");
    item.className = "note";

    const title = document.createElement("strong");
    title.textContent = note.title;

    const meta = document.createElement("div");
    meta.textContent = `${note.date || ""}${note.noteType ? " · " + note.noteType : ""}`;

    const snippet = document.createElement("p");
    snippet.className = "status";
    snippet.textContent =
      note.text.length > 140 ? note.text.slice(0, 140) + "..." : note.text;

    const actions = document.createElement("div");
    actions.style.marginTop = "8px";
    const link = document.createElement("a");
    link.href = "ai-tutor.html?note=" + encodeURIComponent(note.id);
    link.className = "btn sm soft";
    link.textContent = "Study with AI Tutor";
    actions.appendChild(link);

    item.append(title, meta, snippet, actions);
    recentEl.appendChild(item);
  });
}

initDashboard();