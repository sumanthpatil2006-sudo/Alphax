import { bindUserNav, requireLogin } from "./auth.js";
import { deleteNote, getNotes } from "./storage.js";

async function initNotes() {
  const user = await requireLogin();
  if (!user) return;
  bindUserNav(user);

  const list = document.getElementById("notesList");
  let notes;
  try {
    notes = await getNotes(user);
  } catch (error) {
    console.error("Could not load notes:", error);
    list.innerHTML = "<p class='status error'>Could not load your notes. Refresh to try again.</p>";
    return;
  }

  if (!notes.length) {
    list.innerHTML = "<div class='card'><p class='status'>No notes saved yet. Upload your first note to get started.</p><a class='btn' href='upload.html'>Upload notes</a></div>";
    return;
  }

  list.replaceChildren();
  for (const note of notes) {
    const card = document.createElement("article");
    card.className = "card note-card";

    const title = document.createElement("h3");
    title.textContent = note.title || "Untitled note";
    const meta = document.createElement("div");
    meta.className = "note-meta";
    meta.textContent = [note.date, note.noteType, note.fileName].filter(Boolean).join(" · ");
    const text = document.createElement("p");
    text.className = "note-preview";
    text.textContent = note.text;
    const actions = document.createElement("div");
    actions.className = "note-actions";

    const tutorLink = document.createElement("a");
    tutorLink.className = "btn";
    tutorLink.textContent = "Study with AI Tutor";
    tutorLink.href = `ai-tutor.html?note=${encodeURIComponent(note.id)}`;
    actions.appendChild(tutorLink);

    if (note.fileUrl) {
      const fileLink = document.createElement("a");
      fileLink.className = "btn soft";
      fileLink.textContent = "View original";
      fileLink.href = note.fileUrl;
      fileLink.target = "_blank";
      fileLink.rel = "noopener noreferrer";
      actions.appendChild(fileLink);
    }

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "btn danger";
    removeButton.textContent = "Delete";
    removeButton.addEventListener("click", async () => {
      if (!window.confirm(`Delete "${note.title || "Untitled note"}"?`)) return;
      removeButton.disabled = true;
      try {
        const result = await deleteNote(note.id, note.storagePath, user);
        card.remove();
        if (result?.storageDeleteFailed) {
          window.alert("The note was deleted, but its original upload could not be removed from Storage.");
        }
        if (!list.querySelector(".note-card")) {
          list.innerHTML = "<div class='card'><p class='status'>No notes saved yet. Upload your first note to get started.</p><a class='btn' href='upload.html'>Upload notes</a></div>";
        }
      } catch (error) {
        console.error("Could not delete note:", error);
        window.alert(error.message || "Could not delete this note. Please try again.");
        removeButton.disabled = false;
      }
    });
    actions.appendChild(removeButton);
    card.append(title, meta, text, actions);
    list.appendChild(card);
  }
}

initNotes();
