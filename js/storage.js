import { getFirebaseServices, isFirebaseConfigured } from "../firebase/firebase-config.js";
import { getCurrentUser } from "./auth.js";

function localNotesKey(user) {
  return "alphax_notes_" + (user?.email || "guest");
}

function readLocalNotes(user) {
  return JSON.parse(localStorage.getItem(localNotesKey(user)) || "[]");
}

function writeLocalNotes(user, notes) {
  localStorage.setItem(localNotesKey(user), JSON.stringify(notes));
}

export async function uploadNoteFile(file, user) {
  if (!file) return { fileUrl: "", storagePath: "", fileName: "", fileType: "" };

  const activeUser = user || (await getCurrentUser());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const fileType = file.type || (
    /\.pdf$/i.test(file.name) ? "application/pdf" :
      /\.jpe?g$/i.test(file.name) ? "image/jpeg" :
        /\.png$/i.test(file.name) ? "image/png" :
          /\.webp$/i.test(file.name) ? "image/webp" : ""
  );

  if (isFirebaseConfigured() && activeUser?.mode === "firebase" && activeUser.uid) {
    const services = await getFirebaseServices();
    const { ref, uploadBytes, getDownloadURL } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
    );

    const storagePath = `notes/${activeUser.uid}/${Date.now()}_${safeName}`;
    const storageRef = ref(services.storage, storagePath);
    await uploadBytes(storageRef, file, { contentType: fileType || "application/octet-stream" });
    const fileUrl = await getDownloadURL(storageRef);

    return {
      fileUrl,
      storagePath,
      fileName: file.name,
      fileType
    };
  }

  // Local mode: store lightweight image thumbnail preview if small (< 400KB)
  let fileUrl = "";
  if (file.type.startsWith("image/") && file.size <= 400 * 1024) {
    fileUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => resolve("");
      reader.readAsDataURL(file);
    });
  }

  return {
    fileUrl,
    storagePath: "",
    fileName: file.name,
    fileType
  };
}

export async function getNotes(user) {
  const activeUser = user || (await getCurrentUser());
  if (!activeUser) return [];

  if (isFirebaseConfigured() && activeUser.mode === "firebase") {
    const services = await getFirebaseServices();
    const { collection, query, where, getDocs } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );

    const q = query(collection(services.db, "notes"), where("uid", "==", activeUser.uid));
    const snapshot = await getDocs(q);
    const notes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    notes.sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0));
    return notes;
  }

  return readLocalNotes(activeUser);
}

export async function getNoteById(id, user) {
  if (!id) return null;
  const activeUser = user || (await getCurrentUser());
  if (!activeUser) return null;

  if (isFirebaseConfigured() && activeUser.mode === "firebase") {
    const services = await getFirebaseServices();
    const { doc, getDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    const snap = await getDoc(doc(services.db, "notes", String(id)));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.uid !== activeUser.uid) return null;
    return { id: snap.id, ...data };
  }

  return readLocalNotes(activeUser).find((n) => String(n.id) === String(id)) || null;
}

export async function saveNote(noteInput, user) {
  const activeUser = user || (await getCurrentUser());
  if (!activeUser) throw new Error("You must be logged in to save notes.");

  const nowMs = Date.now();
  const notePayload = {
    uid: activeUser.uid,
    title: (noteInput.title || "Untitled Note").trim(),
    text: (noteInput.text || "").trim(),
    noteType: noteInput.noteType || "printed",
    fileName: noteInput.fileName || "",
    fileType: noteInput.fileType || "",
    fileUrl: noteInput.fileUrl || "",
    storagePath: noteInput.storagePath || "",
    explanation: noteInput.explanation || "",
    summary: noteInput.summary || "",
    questions: noteInput.questions || "",
    createdAtMs: nowMs,
    updatedAtMs: nowMs,
    date: new Date(nowMs).toLocaleString()
  };

  if (isFirebaseConfigured() && activeUser.mode === "firebase") {
    const services = await getFirebaseServices();
    const { collection, addDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );

    const docRef = await addDoc(collection(services.db, "notes"), {
      ...notePayload,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { id: docRef.id, ...notePayload };
  }

  const notes = readLocalNotes(activeUser);
  const localNote = { id: String(nowMs), ...notePayload };
  notes.unshift(localNote);
  writeLocalNotes(activeUser, notes);
  return localNote;
}

export async function updateNote(id, updates, user) {
  const activeUser = user || (await getCurrentUser());
  if (!activeUser || !id) return null;

  const patch = { ...updates, updatedAtMs: Date.now() };

  if (isFirebaseConfigured() && activeUser.mode === "firebase") {
    const services = await getFirebaseServices();
    const { doc, updateDoc, serverTimestamp } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    await updateDoc(doc(services.db, "notes", String(id)), {
      ...patch,
      updatedAt: serverTimestamp()
    });
    return { id: String(id), ...patch };
  }

  const notes = readLocalNotes(activeUser);
  const idx = notes.findIndex((n) => String(n.id) === String(id));
  if (idx === -1) return null;
  notes[idx] = { ...notes[idx], ...patch };
  writeLocalNotes(activeUser, notes);
  return notes[idx];
}

export async function deleteNote(id, storagePath, user) {
  const activeUser = user || (await getCurrentUser());
  if (!activeUser || !id) return;

  if (isFirebaseConfigured() && activeUser.mode === "firebase") {
    const services = await getFirebaseServices();
    const { doc, deleteDoc } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"
    );
    await deleteDoc(doc(services.db, "notes", String(id)));

    if (storagePath) {
      try {
        const { ref, deleteObject } = await import(
          "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js"
        );
        await deleteObject(ref(services.storage, storagePath));
      } catch (error) {
        console.error("Note was deleted, but its uploaded file could not be removed:", error);
        return { storageDeleteFailed: true };
      }
    }
    return { storageDeleteFailed: false };
  }

  const notes = readLocalNotes(activeUser).filter((n) => String(n.id) !== String(id));
  writeLocalNotes(activeUser, notes);
  return { storageDeleteFailed: false };
}