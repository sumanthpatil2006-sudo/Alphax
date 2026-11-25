import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { GoogleGenAI } from "@google/genai";
import { applicationDefault, cert, getApp, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
dotenv.config({ path: path.join(currentDir, ".env") });
const app = express();
const port = Number(process.env.PORT) || 3000;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const firebaseProjectId = process.env.FIREBASE_PROJECT_ID?.startsWith("YOUR_")
  ? ""
  : process.env.FIREBASE_PROJECT_ID;
const allowedOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const MAX_TEXT_LENGTH = 20000;

let firebaseAuth;

app.use(cors({
  origin(origin, callback) {
    if (!allowedOrigins.length) {
      callback(null, false);
      return;
    }
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    callback(new Error("This origin is not allowed by CORS."));
  }
}));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    online: true,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    model: modelName,
    firebaseAdminConfigured: Boolean(
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.GOOGLE_CLOUD_PROJECT
    )
  });
});

function getAdminAuth() {
  if (firebaseAuth) return firebaseAuth;

  const existingApps = getApps();
  if (!existingApps.length) {
    let options;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      let serviceAccount;
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch {
        throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON must contain valid JSON.");
      }
      options = {
        credential: cert(serviceAccount),
        projectId: firebaseProjectId || serviceAccount.project_id
      };
    } else {
      const projectId = firebaseProjectId || process.env.GOOGLE_CLOUD_PROJECT;
      if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT) {
        return null;
      }
      options = {
        credential: applicationDefault(),
        ...(projectId ? { projectId } : {})
      };
    }
    initializeApp(options);
  }

  firebaseAuth = getAuth(getApps().length ? getApp() : initializeApp());
  return firebaseAuth;
}

async function requireFirebaseUser(req, res, next) {
  const authorization = req.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    res.status(401).json({ error: "Sign in with Firebase to use AI features." });
    return;
  }

  try {
    const auth = getAdminAuth();
    if (!auth) {
      res.status(503).json({ error: "Firebase Admin credentials are not configured on the server." });
      return;
    }
    req.user = await auth.verifyIdToken(token);
    next();
  } catch (error) {
    if (error?.code && String(error.code).startsWith("auth/")) {
      res.status(401).json({ error: "Your session is invalid or expired. Please sign in again." });
      return;
    }
    next(error);
  }
}

function getGemini() {
  if (!process.env.GEMINI_API_KEY) {
    const error = new Error("Gemini is not configured. Add GEMINI_API_KEY to server/.env.");
    error.status = 503;
    throw error;
  }
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

function validateInput(req, res, next) {
  const { text } = req.body || {};
  if (typeof text !== "string" || !text.trim()) {
    res.status(400).json({ error: "Add some note text before asking the AI." });
    return;
  }
  if (text.length > MAX_TEXT_LENGTH) {
    res.status(413).json({ error: `Note text must be ${MAX_TEXT_LENGTH.toLocaleString()} characters or fewer.` });
    return;
  }
  if (req.body.question !== undefined && typeof req.body.question !== "string") {
    res.status(400).json({ error: "The question must be text." });
    return;
  }
  if (typeof req.body.question === "string" && req.body.question.length > 2000) {
    res.status(413).json({ error: "Questions must be 2,000 characters or fewer." });
    return;
  }
  next();
}

const prompts = {
  explain: (text) => `Explain these study notes in clear, beginner-friendly language. Keep important facts accurate and use short sections when useful.\n\nNotes:\n${text}`,
  summary: (text) => `Create a concise, well-organized study summary of these notes. Preserve key terms and facts.\n\nNotes:\n${text}`,
  questions: (text) => `Create 5 useful study questions from these notes and provide a clear answer for each. Number each question and answer.\n\nNotes:\n${text}`,
  tutor: (text, question) => `Act as a patient study tutor. Answer the student's question using the notes as context. If the notes do not contain enough information, say so clearly.\n\nNotes:\n${text}\n\nStudent question:\n${question}`
};

async function generateResponse(req, res, action) {
  const { text, question = "" } = req.body;
  if (action === "tutor" && !question.trim()) {
    res.status(400).json({ error: "Enter a question for the AI Tutor." });
    return;
  }

  const result = await getGemini().models.generateContent({
    model: modelName,
    contents: prompts[action](text.trim(), question.trim())
  });
  const output = result.text?.trim();
  if (!output) {
    throw new Error("Gemini returned an empty response. Please try again.");
  }
  res.json({ text: output });
}

for (const action of ["explain", "summary", "questions", "tutor"]) {
  app.post(`/api/ai/${action}`, requireFirebaseUser, validateInput, async (req, res, next) => {
    try {
      await generateResponse(req, res, action);
    } catch (error) {
      next(error);
    }
  });
}

app.use((req, res, next) => {
  if (/^\/(?:server|node_modules)(?:\/|$)/.test(req.path)) {
    res.sendStatus(404);
    return;
  }
  next();
});
app.use(express.static(projectRoot, { dotfiles: "ignore", index: "index.html" }));

app.use((error, _req, res, _next) => {
  const status = Number(error.status) || (error.type === "entity.parse.failed" ? 400 : 500);
  console.error("Request failed:", error.message);
  res.status(status).json({
    error: status === 500 ? "The server could not complete this request. Please try again." : error.message
  });
});

if (process.env.NODE_ENV !== "test") {
  createServer(app).listen(port, () => {
    console.log(`AlphaX is running at http://localhost:${port}`);
  });
}

export { app };
