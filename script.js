
const fileInput = document.getElementById("fileInput");
const extractBtn = document.getElementById("extractBtn");
const extractedText = document.getElementById("extractedText");
const fileName = document.getElementById("fileName");
const statusText = document.getElementById("status");
const progressBar = document.getElementById("progressBar");
const saveBtn = document.getElementById("saveBtn");
const copyBtn = document.getElementById("copyBtn");

let selectedFile = null;

// Load saved notes
let notes = JSON.parse(localStorage.getItem("alphaxNotes") || "[]");

displayNotes();

// Select image
fileInput.addEventListener("change", function () {
    selectedFile = this.files[0];

    if (!selectedFile) return;

    if (!selectedFile.type.startsWith("image/")) {
        alert("Please select a valid image.");
        selectedFile = null;
        return;
    }

    fileName.textContent = selectedFile.name;
    statusText.textContent = "Image ready for OCR.";
    progressBar.style.width = "0%";
    extractBtn.disabled = false;
});

// Extract text using Tesseract OCR
extractBtn.addEventListener("click", async function () {

    if (!selectedFile) return;

    extractBtn.disabled = true;
    saveBtn.disabled = true;

    statusText.textContent = "Processing your image...";
    progressBar.style.width = "0%";

    try {
        const result = await Tesseract.recognize(
            selectedFile,
            "eng",
            {
                logger: function (info) {
                    if (info.status === "recognizing text") {
                        const progress = Math.round(info.progress * 100);
                        progressBar.style.width = progress + "%";
                        statusText.textContent =
                            "Extracting text: " + progress + "%";
                    }
                }
            }
        );

        extractedText.value = result.data.text.trim();

        if (extractedText.value) {
            statusText.textContent = "Text extracted successfully!";
            saveBtn.disabled = false;
        } else {
            statusText.textContent = "No readable text found. Try another image.";
        }

    } catch (error) {
        console.error(error);
        statusText.textContent = "OCR failed. Please try again.";
    }

    extractBtn.disabled = false;
});

// Allow manual editing and saving
extractedText.addEventListener("input", function () {
    saveBtn.disabled = !this.value.trim();
});

// Save notes
saveBtn.addEventListener("click", function () {

    const text = extractedText.value.trim();

    if (!text) return;

    const note = {
        id: Date.now(),
        title: selectedFile ? selectedFile.name : "My Study Note",
        content: text,
        date: new Date().toLocaleDateString()
    };

    notes.unshift(note);

    localStorage.setItem("alphaxNotes", JSON.stringify(notes));

    displayNotes();

    statusText.textContent = "Notes saved successfully!";
    saveBtn.disabled = true;
});

// Display saved notes
function displayNotes() {

    const savedNotes = document.getElementById("savedNotes");

    savedNotes.innerHTML = "";

    document.getElementById("noteCount").textContent = notes.length;

    if (notes.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty";
        empty.textContent = "No saved notes yet. Upload your first note!";
        savedNotes.appendChild(empty);
        return;
    }

    notes.forEach(function (note) {

        const card = document.createElement("div");
        card.className = "note-card";

        const heading = document.createElement("h3");
        heading.textContent = note.title;

        const date = document.createElement("small");
        date.textContent = note.date;

        const content = document.createElement("p");
        content.textContent = note.content.substring(0, 250) +
            (note.content.length > 250 ? "..." : "");

        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-btn";
        deleteBtn.textContent = "Delete";

        deleteBtn.addEventListener("click", function () {
            notes = notes.filter(n => n.id !== note.id);

            localStorage.setItem(
                "alphaxNotes",
                JSON.stringify(notes)
            );

            displayNotes();
        });

        card.append(heading, date, content, deleteBtn);
        savedNotes.appendChild(card);
    });
}

// Copy extracted text
copyBtn.addEventListener("click", async function () {

    if (!extractedText.value.trim()) {
        alert("No text to copy.");
        return;
    }

    try {
        await navigator.clipboard.writeText(extractedText.value);
        alert("Text copied successfully!");
    } catch (error) {
        alert("Unable to copy. Please copy the text manually.");
    }
});