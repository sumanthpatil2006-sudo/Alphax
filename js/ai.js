import { getCurrentUser } from "./auth.js";
import { getFirebaseServices } from "../firebase/firebase-config.js";

const API_BASE_URL = "";

export async function checkBackendHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    if (!response.ok) throw new Error(`Health check failed (${response.status}).`);
    return await response.json();
  } catch {
    return {
      online: false,
      geminiConfigured: false,
      firebaseAdminConfigured: false,
      model: ""
    };
  }
}

async function requestAI(action, text, question = "") {
  const user = await getCurrentUser();
  if (!user || user.mode !== "firebase") {
    throw new Error("AI features require a Firebase account. Configure Firebase to continue.");
  }

  const services = await getFirebaseServices();
  const token = await services.auth.currentUser?.getIdToken();
  if (!token) throw new Error("Your session expired. Please sign in again.");

  const response = await fetch(`${API_BASE_URL}/api/ai/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ text, question })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.error || `AI request failed (${response.status}).`);
  }
  if (typeof result.text !== "string" || !result.text.trim()) {
    throw new Error("The AI returned an empty response. Please try again.");
  }
  return result.text;
}

export function explainWithAI(text) {
  return requestAI("explain", text);
}

export function summarizeWithAI(text) {
  return requestAI("summary", text);
}

export function generateQuestionsWithAI(text) {
  return requestAI("questions", text);
}

export function askTutorWithAI(text, question) {
  return requestAI("tutor", text, question);
}
