// Replace these placeholder values from:
// Firebase Console -> Project settings -> Your apps -> Web app
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

export function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig.apiKey &&
      !firebaseConfig.apiKey.startsWith("YOUR_") &&
      firebaseConfig.authDomain &&
      !firebaseConfig.authDomain.startsWith("YOUR_") &&
      firebaseConfig.projectId &&
      !firebaseConfig.projectId.startsWith("YOUR_") &&
      firebaseConfig.appId &&
      !firebaseConfig.appId.startsWith("YOUR_")
  );
}

let servicesPromise = null;

export async function getFirebaseServices() {
  if (!isFirebaseConfigured()) {
    return null;
  }
  if (!servicesPromise) {
    servicesPromise = (async () => {
      const [
        { initializeApp, getApps },
        { getAuth },
        { getFirestore },
        { getStorage }
      ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js")
      ]);

      const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      return {
        app,
        auth: getAuth(app),
        db: getFirestore(app),
        storage: getStorage(app)
      };
    })();
  }
  return servicesPromise;
}