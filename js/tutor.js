import { bindUserNav, requireLogin } from "./auth.js";
import {
  askTutorWithAI,
  explainWithAI,
  generateQuestionsWithAI,
  summarizeWithAI
} from "./ai.js";
import { getNotes, updateNote } from "./storage.js";

async function initTutor() {
  const user = await requireLogin();
  if (!user) return;
  bindUserNav(user);

  const select = document.getElementById("noteSelect");
  const textBox = document.getElementById("noteText");
  const answer = document.getElementById("answer");
  const status = document.getElementById("status");
  const actionButtons = Array.from(document.querySelectorAll("[data-action]"));
  const askButton = document.getElementById("askBtn");
  let notes = [];

  try {
    notes = await getNotes(user);
  } catch (error) {
    console.error("Could not load notes for AI Tutor:", error);
    status.textContent = "Could not load your saved notes. You can still paste text below.";
    status.className = "status error";
  }

  for (const note of notes) {
    const option = document.createElement("option");
    option.value = note.id;
    option.textContent = note.title || "Untitled note";
    select.appendChild(option);
  }

  function selectedNote() {
    return notes.find((note) => String(note.id) === select.value);
  }

  select.addEventListener("change", () => {
    const note = selectedNote();
    if (note) textBox.value = note.text || "";
  });

  const requestedNote = new URLSearchParams(location.search).get("note");
  if (requestedNote && notes.some((note) => String(note.id) === requestedNote)) {
    select.value = requestedNote;
    textBox.value = selectedNote()?.text || "";
  }

  async function runAction(action) {
    const text = textBox.value.trim();
    const question = document.getElementById("question").value.trim();
    const note = selectedNote();
    if (!text) {
      status.textContent = "Choose a note or add some study text first.";
      status.className = "status error";
      return;
    }
    if (action === "tutor" && !question) {
      status.textContent = "Enter a follow-up question first.";
      status.className = "status error";
      return;
    }

    actionButtons.forEach((button) => { button.disabled = true; });
    askButton.disabled = true;
    status.textContent = "The AI Tutor is working...";
    status.className = "status";
    answer.textContent = "";
    try {
      let result;
      if (action === "explain") result = await explainWithAI(text);
      if (action === "summary") result = await summarizeWithAI(text);
      if (action === "questions") result = await generateQuestionsWithAI(text);
      if (action === "tutor") result = await askTutorWithAI(text, question);
      answer.textContent = result;

      if (note && action !== "tutor") {
        const field = action === "explain" ? "explanation" : action;
        try {
          await updateNote(note.id, { [field]: result }, user);
          Object.assign(note, { [field]: result });
        } catch (error) {
          console.error("Could not save AI response:", error);
          status.textContent = "Response ready, but it could not be saved to this note.";
          status.className = "status error";
          return;
        }
      }
      status.textContent = "Done.";
      status.className = "status success";
    } catch (error) {
      console.error("AI request failed:", error);
      status.textContent = error.message || "AI request failed. Please try again.";
      status.className = "status error";
    } finally {
      actionButtons.forEach((button) => { button.disabled = false; });
      askButton.disabled = false;
    }
  }

  actionButtons.forEach((button) => {
    button.addEventListener("click", () => runAction(button.dataset.action));
  });
  askButton.addEventListener("click", () => runAction("tutor"));
}

initTutor();
