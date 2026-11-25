import { getFirebaseServices, isFirebaseConfigured } from "../firebase/firebase-config.js";

const LOCAL_USERS_KEY = "alphax_users";
const LOCAL_CURRENT_KEY = "alphax_current";

function getLocalUsers() {
  return JSON.parse(localStorage.getItem(LOCAL_USERS_KEY) || "[]");
}

function getLocalUser() {
  return JSON.parse(localStorage.getItem(LOCAL_CURRENT_KEY) || "null");
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const result = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations: 210000,
    hash: "SHA-256"
  }, key, 256);
  return bytesToHex(new Uint8Array(result));
}

function mapFirebaseUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.displayName || user.email?.split("@")[0] || "Student",
    email: user.email || "",
    mode: "firebase"
  };
}

function formatAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "An account with this email already exists.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/weak-password") return "Password must be at least 6 characters.";
  if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
    return "Incorrect email or password.";
  }
  return err?.message || "Authentication failed. Please try again.";
}

export function getAuthMode() {
  return isFirebaseConfigured() ? "firebase" : "local";
}

export async function registerUser(name, email, password) {
  const cleanName = (name || "").trim();
  const cleanEmail = (email || "").trim().toLowerCase();

  if (!cleanName || !cleanEmail || !password || password.length < 6) {
    return { ok: false, message: "Please fill all fields (password minimum 6 characters)." };
  }

  if (isFirebaseConfigured()) {
    try {
      const services = await getFirebaseServices();
      const [
        { createUserWithEmailAndPassword, updateProfile },
        { doc, setDoc, serverTimestamp }
      ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
      ]);

      const cred = await createUserWithEmailAndPassword(services.auth, cleanEmail, password);
      await updateProfile(cred.user, { displayName: cleanName });

      await setDoc(doc(services.db, "users", cred.user.uid), {
        uid: cred.user.uid,
        name: cleanName,
        email: cleanEmail,
        createdAt: serverTimestamp()
      });

      const mapped = mapFirebaseUser({ ...cred.user, displayName: cleanName });
      return { ok: true, user: mapped, message: "Account created!" };
    } catch (err) {
      return { ok: false, message: formatAuthError(err) };
    }
  }

  const users = getLocalUsers();
  if (users.find((u) => u.email.toLowerCase() === cleanEmail)) {
    return { ok: false, message: "Email already registered." };
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const newUser = {
    uid: "local_" + Date.now(),
    name: cleanName,
    email: cleanEmail,
    salt: bytesToHex(salt),
    passwordHash: await hashPassword(password, salt)
  };
  users.push(newUser);
  localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  const sessionUser = { uid: newUser.uid, name: newUser.name, email: newUser.email, mode: "local" };
  localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser, message: "Account created!" };
}

export async function loginUser(email, password) {
  const cleanEmail = (email || "").trim().toLowerCase();
  if (!cleanEmail || !password) {
    return { ok: false, message: "Please enter both email and password." };
  }

  if (isFirebaseConfigured()) {
    try {
      const services = await getFirebaseServices();
      const [
        { signInWithEmailAndPassword },
        { doc, getDoc, setDoc, serverTimestamp }
      ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
      ]);

      const cred = await signInWithEmailAndPassword(services.auth, cleanEmail, password);
      const userRef = doc(services.db, "users", cred.user.uid);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        await setDoc(userRef, {
          uid: cred.user.uid,
          name: cred.user.displayName || cleanEmail.split("@")[0],
          email: cleanEmail,
          createdAt: serverTimestamp()
        });
      }
      return { ok: true, user: mapFirebaseUser(cred.user), message: "Logged in!" };
    } catch (err) {
      return { ok: false, message: formatAuthError(err) };
    }
  }

  const users = getLocalUsers();
  const user = users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) return { ok: false, message: "Wrong email or password." };

  if (user.passwordHash) {
    const salt = Uint8Array.from(user.salt.match(/.{2}/g) || [], (byte) => parseInt(byte, 16));
    if (await hashPassword(password, salt) !== user.passwordHash) {
      return { ok: false, message: "Wrong email or password." };
    }
  } else if (user.password === password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    user.salt = bytesToHex(salt);
    user.passwordHash = await hashPassword(password, salt);
    delete user.password;
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
  } else {
    return { ok: false, message: "Wrong email or password." };
  }

  const sessionUser = {
    uid: user.uid || "local_" + user.email,
    name: user.name,
    email: user.email,
    mode: "local"
  };
  localStorage.setItem(LOCAL_CURRENT_KEY, JSON.stringify(sessionUser));
  return { ok: true, user: sessionUser, message: "Logged in!" };
}

export async function getCurrentUser() {
  if (isFirebaseConfigured()) {
    const services = await getFirebaseServices();
    const { onAuthStateChanged } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );

    if (services.auth.currentUser) {
      return mapFirebaseUser(services.auth.currentUser);
    }

    return new Promise((resolve) => {
      const unsubscribe = onAuthStateChanged(services.auth, (user) => {
        unsubscribe();
        resolve(mapFirebaseUser(user));
      });
    });
  }

  const local = getLocalUser();
  if (!local) return null;
  return {
    uid: local.uid || "local_" + local.email,
    name: local.name,
    email: local.email,
    mode: "local"
  };
}

export async function requireLogin() {
  const user = await getCurrentUser();
  if (!user) {
    location.href = "login.html";
    return null;
  }
  return user;
}

export async function redirectIfLoggedIn() {
  const user = await getCurrentUser();
  if (user) {
    location.href = "dashboard.html";
  }
}

export async function logout() {
  if (isFirebaseConfigured()) {
    const services = await getFirebaseServices();
    const { signOut } = await import(
      "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"
    );
    await signOut(services.auth);
  }
  localStorage.removeItem(LOCAL_CURRENT_KEY);
  location.href = "login.html";
}

export function bindUserNav(user) {
  const nameEl = document.getElementById("navUserName");
  const modeEl = document.getElementById("syncBadge");
  const logoutBtn = document.getElementById("logoutBtn");

  if (nameEl && user) {
    nameEl.textContent = user.name;
    nameEl.title = user.email;
  }
  if (modeEl) {
    const firebaseOn = user?.mode === "firebase";
    modeEl.textContent = firebaseOn ? "Firebase Cloud" : "Local Mode";
    modeEl.className = "badge " + (firebaseOn ? "badge-cloud" : "badge-local");
  }
  if (logoutBtn) {
    logoutBtn.onclick = (e) => {
      e.preventDefault();
      logout().catch((err) => {
        console.error("Sign out failed:", err);
        window.alert("Could not sign out. Please try again.");
      });
    };
  }
}