import { requireLogin } from "./auth.js";
import { saveNote, uploadNoteFile } from "./storage.js";
import { extractTextFromFile } from "./ocr.js";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

async function initUpload() {
  const user = await requireLogin();
  if (!user) return;

  const fileInput = document.getElementById("fileInput");
  const preview = document.getElementById("preview");
  const previewLabel = document.getElementById("previewLabel");
  const statusEl = document.getElementById("status");
  const textOutput = document.getElementById("textOutput");
  const extractBtn = document.getElementById("extractBtn");
  const saveBtn = document.getElementById("saveBtn");
  let previewUrl = "";

  function setStatus(message, kind = "") {
    statusEl.textContent = message;
    statusEl.className = `status${kind ? ` ${kind}` : ""}`;
  }

  function supportedFile(file) {
    return allowedTypes.has(file.type) || /\.(jpe?g|png|webp|pdf)$/i.test(file.name);
  }

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!supportedFile(file)) {
      fileInput.value = "";
      setStatus("Choose a JPG, PNG, WebP image, or PDF.", "error");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      fileInput.value = "";
      setStatus("Files must be 15 MB or smaller.", "error");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (file.type.startsWith("image/")) {
      previewUrl = URL.createObjectURL(file);
      preview.src = previewUrl;
      preview.hidden = false;
      previewLabel.hidden = true;
    } else {
      preview.removeAttribute("src");
      preview.hidden = true;
      previewLabel.textContent = `PDF selected: ${file.name}`;
      previewLabel.hidden = false;
    }
    setStatus("");
  });

  extractBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      setStatus("Choose an image or PDF first.", "error");
      return;
    }
    if (!supportedFile(file) || file.size > MAX_FILE_SIZE) {
      setStatus("Choose a supported file no larger than 15 MB.", "error");
      return;
    }

    extractBtn.disabled = true;
    fileInput.disabled = true;
    setStatus("Reading text... 0%");
    try {
      const text = await extractTextFromFile(file, (progress) => {
        setStatus(`Reading text... ${progress}%`);
      });
      textOutput.value = text;
      setStatus(
        text ? "Text extracted. Review and edit it before saving." : "No text found. Try a clearer image or PDF.",
        text ? "success" : "error"
      );
    } catch (error) {
      console.error("OCR failed:", error);
      setStatus(error.message || "OCR failed. Please try again.", "error");
    } finally {
      extractBtn.disabled = false;
      fileInput.disabled = false;
    }
  });

  saveBtn.addEventListener("click", async () => {
    const file = fileInput.files?.[0];
    const text = textOutput.value.trim();
    if (!text) {
      setStatus("Add or extract some text before saving.", "error");
      return;
    }
    if (text.length > 20000) {
      setStatus("Notes can contain up to 20,000 characters. Edit the text before saving.", "error");
      return;
    }
    saveBtn.disabled = true;
    fileInput.disabled = true;
    setStatus("Saving your note...");
    try {
      const fileDetails = file ? await uploadNoteFile(file, user) : {};
      await saveNote({
        title: document.getElementById("noteTitle").value.trim() || "Untitled note",
        text,
        noteType: document.getElementById("noteType").value,
        ...fileDetails
      }, user);
      setStatus("Note saved. Opening your notes...", "success");
      window.setTimeout(() => {
        location.href = "my-notes.html";
      }, 700);
    } catch (error) {
      console.error("Saving note failed:", error);
      setStatus(error.message || "Could not save your note. Please try again.", "error");
    } finally {
      saveBtn.disabled = false;
      fileInput.disabled = false;
    }
  });
}

initUpload();
