import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Sparkles,
  LogOut,
  Plus,
  Trash2,
  Settings,
  X,
  Loader2,
  GraduationCap,
  ChevronRight,
  Layers,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

/**
 * AlphaX - Complete Single-File React Application
 * Features:
 * 1. Google Sign-In (Firebase Auth) + Instant Demo Mode (LocalStorage persisted)
 * 2. Multi-Subject Management (Create, switch, and delete subjects)
 * 3. Multimodal Syllabus & Multi-File Notes Uploader (PDFs & Images)
 * 4. Gemini 3 Flash Preview Structured JSON Output for Gap Analysis
 * 5. Interactive Dashboard with Animated Progress Bar & Status Filters
 * 6. On-demand AI Quick Study Notes Drawer for Missing / Partially Covered Topics
 */

const SAMPLE_DEMO_COURSES = {
  "cs-301": {
    id: "cs-301",
    courseName: "Operating Systems (CS-301)",
    coveragePercent: 62,
    updatedAt: "Today, 2:30 PM",
    topics: [
      {
        name: "Process Lifecycle & PCB Architecture",
        status: "covered",
        whatIsMissing: "",
      },
      {
        name: "CPU Scheduling Algorithms (FCFS, SJF, Round Robin)",
        status: "covered",
        whatIsMissing: "",
      },
      {
        name: "Process Synchronization & Semaphores",
        status: "partially_covered",
        whatIsMissing:
          "Producer-Consumer solution using counting semaphores and Dining Philosophers deadlock condition are missing from your notes.",
      },
      {
        name: "Deadlock Prevention, Avoidance & Banker's Algorithm",
        status: "not_covered",
        whatIsMissing:
          "Entire module absent. Need resource allocation graphs, safety algorithm steps, and numerical examples.",
      },
      {
        name: "Paging, Segmentation & Virtual Memory",
        status: "partially_covered",
        whatIsMissing:
          "Basic paging translation is covered, but TLB (Translation Lookaside Buffer) hit-ratio formulas and inverted page tables are missing.",
      },
      {
        name: "Page Replacement Algorithms (FIFO, LRU, Optimal)",
        status: "covered",
        whatIsMissing: "",
      },
      {
        name: "Disk Scheduling (SCAN, C-SCAN, LOOK)",
        status: "not_covered",
        whatIsMissing:
          "Seek time comparison charts and C-LOOK head movement diagrams are not present in uploaded notes.",
      },
    ],
  },
};

async function fileToInlineData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(",")[1];
      resolve({
        inlineData: {
          mimeType: file.type || "application/pdf",
          data: base64String,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function fetchGeminiWithRetry(url, payload, retries = 3) {
  let delay = 1000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData?.error?.message || `API Error: ${response.status}`
        );
      }
      return await response.json();
    } catch (error) {
      if (attempt === retries) throw error;
      await new Promise((res) => setTimeout(res, delay));
      delay *= 2;
    }
  }
}

export default function App() {
  const [user, setUser] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [showSettings, setShowSettings] = useState(false);
  const [customGeminiKey, setCustomGeminiKey] = useState("");
  const [firebaseConfigInput, setFirebaseConfigInput] = useState("");
  const [firebaseInstance, setFirebaseInstance] = useState(null);

  const [courses, setCourses] = useState({});
  const [activeCourseId, setActiveCourseId] = useState("default-course");
  const [newSubjectName, setNewSubjectName] = useState("");
  const [isAddingSubject, setIsAddingSubject] = useState(false);

  const [syllabusFile, setSyllabusFile] = useState(null);
  const [notesFiles, setNotesFiles] = useState([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [statusBanner, setStatusBanner] = useState(null);

  const [activeFilter, setActiveFilter] = useState("all");
  const [studyModalTopic, setStudyModalTopic] = useState(null);
  const [studyNotesContent, setStudyNotesContent] = useState("");
  const [generatingStudyNotes, setGeneratingStudyNotes] = useState(false);

  const syllabusInputRef = useRef(null);
  const notesInputRef = useRef(null);

  useEffect(() => {
    try {
      const savedKey = localStorage.getItem("alphax_gemini_key");
      if (savedKey) setCustomGeminiKey(savedKey);

      const savedFbConfig = localStorage.getItem("alphax_firebase_config");
      if (savedFbConfig) {
        setFirebaseConfigInput(savedFbConfig);
        initFirebaseFromString(savedFbConfig);
      }
    } catch (e) {
      // Ignore storage access restrictions
    }
  }, []);

  const initFirebaseFromString = async (configStr) => {
    try {
      const parsed = JSON.parse(configStr);
      if (!parsed.apiKey || !parsed.projectId) return null;

      const [
        { initializeApp, getApps },
        { getAuth, GoogleAuthProvider, signInWithPopup, signOut },
        { getFirestore, doc, setDoc, getDocs, collection, deleteDoc },
      ] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      ]);

      const app = getApps().length ? getApps()[0] : initializeApp(parsed);
      const auth = getAuth(app);
      const db = getFirestore(app);
      const provider = new GoogleAuthProvider();

      const fbObj = {
        auth,
        db,
        provider,
        signInWithPopup,
        signOut,
        doc,
        setDoc,
        getDocs,
        collection,
        deleteDoc,
      };
      setFirebaseInstance(fbObj);
      return fbObj;
    } catch (err) {
      console.error("Firebase init error:", err);
      return null;
    }
  };

  const handleEnterDemoMode = () => {
    setIsDemoMode(true);
    setUser({
      uid: "demo-student-01",
      displayName: "Alex Rivera (Demo Student)",
      email: "alex.student@university.edu",
      photoURL: null,
    });

    try {
      const savedDemo = localStorage.getItem("alphax_demo_courses");
      if (savedDemo) {
        const parsed = JSON.parse(savedDemo);
        setCourses(parsed);
        const firstKey = Object.keys(parsed)[0];
        if (firstKey) setActiveCourseId(firstKey);
      } else {
        setCourses(SAMPLE_DEMO_COURSES);
        setActiveCourseId("cs-301");
      }
    } catch {
      setCourses(SAMPLE_DEMO_COURSES);
      setActiveCourseId("cs-301");
    }
  };

  const handleGoogleSignIn = async () => {
    setStatusBanner(null);
    if (!firebaseInstance) {
      setShowSettings(true);
      setStatusBanner({
        type: "info",
        message:
          "Paste your Firebase Web Config JSON in Settings to enable live Google Sign-In, or click 'Continue in Demo Mode' to test immediately.",
      });
      return;
    }

    setAuthLoading(true);
    try {
      const result = await firebaseInstance.signInWithPopup(
        firebaseInstance.auth,
        firebaseInstance.provider
      );
      const loggedUser = result.user;
      setUser(loggedUser);
      setIsDemoMode(false);

      const querySnapshot = await firebaseInstance.getDocs(
        firebaseInstance.collection(
          firebaseInstance.db,
          "users",
          loggedUser.uid,
          "courses"
        )
      );
      const loadedCourses = {};
      querySnapshot.forEach((docSnap) => {
        loadedCourses[docSnap.id] = { id: docSnap.id, ...docSnap.data() };
      });

      setCourses(loadedCourses);
      const keys = Object.keys(loadedCourses);
      if (keys.length > 0) {
        setActiveCourseId(keys[0]);
      } else {
        const defaultId = "subject-1";
        setCourses({
          [defaultId]: {
            id: defaultId,
            courseName: "My First Subject",
            coveragePercent: 0,
            topics: [],
          },
        });
        setActiveCourseId(defaultId);
      }
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: `Google Sign-In failed: ${err.message}`,
      });
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    if (firebaseInstance && !isDemoMode) {
      await firebaseInstance.signOut(firebaseInstance.auth);
    }
    setUser(null);
    setIsDemoMode(false);
    setCourses({});
    setSyllabusFile(null);
    setNotesFiles([]);
    setStatusBanner(null);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    try {
      localStorage.setItem("alphax_gemini_key", customGeminiKey.trim());
      if (firebaseConfigInput.trim()) {
        localStorage.setItem("alphax_firebase_config", firebaseConfigInput.trim());
        const fb = await initFirebaseFromString(firebaseConfigInput.trim());
        if (!fb) {
          setStatusBanner({
            type: "error",
            message:
              "Invalid Firebase JSON format. Make sure keys are double-quoted valid JSON.",
          });
          return;
        }
      }
      setShowSettings(false);
      setStatusBanner({
        type: "success",
        message: "AlphaX settings saved successfully.",
      });
    } catch (err) {
      setStatusBanner({
        type: "error",
        message: "Could not save settings: " + err.message,
      });
    }
  };

  const persistCourseData = async (updatedCourses, targetCourseId) => {
    setCourses(updatedCourses);
    if (isDemoMode) {
      try {
        localStorage.setItem("alphax_demo_courses", JSON.stringify(updatedCourses));
      } catch {
        // Ignore quota errors
      }
    } else if (firebaseInstance && user && updatedCourses[targetCourseId]) {
      await firebaseInstance.setDoc(
        firebaseInstance.doc(
          firebaseInstance.db,
          "users",
          user.uid,
          "courses",
          targetCourseId
        ),
        updatedCourses[targetCourseId]
      );
    }
  };

  const handleCreateSubject = async (e) => {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const id = `subj-${Date.now()}`;
    const newCourse = {
      id,
      courseName: newSubjectName.trim(),
      coveragePercent: 0,
      topics: [],
      updatedAt: "Just now",
    };
    const updated = { ...courses, [id]: newCourse };
    await persistCourseData(updated, id);
    setActiveCourseId(id);
    setNewSubjectName("");
    setIsAddingSubject(false);
    setSyllabusFile(null);
    setNotesFiles([]);
  };

  const handleDeleteSubject = async (idToDelete) => {
    const updated = { ...courses };
    delete updated[idToDelete];
    setCourses(updated);

    if (isDemoMode) {
      localStorage.setItem("alphax_demo_courses", JSON.stringify(updated));
    } else if (firebaseInstance && user) {
      await firebaseInstance.deleteDoc(
        firebaseInstance.doc(
          firebaseInstance.db,
          "users",
          user.uid,
          "courses",
          idToDelete
        )
      );
    }

    const remainingKeys = Object.keys(updated);
    if (remainingKeys.length > 0) {
      setActiveCourseId(remainingKeys[0]);
    } else {
      const fallbackId = `subj-${Date.now()}`;
      setCourses({
        [fallbackId]: {
          id: fallbackId,
          courseName: "General Course",
          coveragePercent: 0,
          topics: [],
        },
      });
      setActiveCourseId(fallbackId);
    }
  };

  const handleNotesSelect = (e) => {
    const selected = Array.from(e.target.files || []);
    if (selected.length > 0) {
      setNotesFiles((prev) => [...prev, ...selected]);
    }
  };

  const removeNoteFile = (index) => {
    setNotesFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyzeGap = async (e) => {
    e.preventDefault();
    setStatusBanner(null);

    if (!syllabusFile || notesFiles.length === 0) {
      setStatusBanner({
        type: "error",
        message:
          "Please upload both a Curriculum/Syllabus copy (PDF/Image) and at least one Notes file.",
      });
      return;
    }

    setAnalyzing(true);
    try {
      const syllabusPart = await fileToInlineData(syllabusFile);
      const noteParts = await Promise.all(notesFiles.map(fileToInlineData));

      const currentCourse = courses[activeCourseId];
      const prompt = `
        You are AlphaX, an expert academic curriculum auditor.
        Compare the attached SYLLABUS/CURRICULUM document against the student's uploaded NOTES files.
        
        Instructions:
        1. Extract every distinct topic/subtopic from the curriculum document.
        2. Thoroughly inspect all uploaded notes files to check whether each topic is explained.
        3. Classify each topic's status strictly as:
           - "covered": Topic is clearly present and adequately explained in the notes.
           - "partially_covered": Topic is mentioned or briefly outlined, but lacks key derivations, formulas, diagrams, or sub-concepts required.
           - "not_covered": Topic is completely missing from the notes.
        4. For "partially_covered" or "not_covered" topics, provide a concise, actionable explanation in "whatIsMissing" detailing what the student still needs to study. For "covered", leave "whatIsMissing" as "".
        5. Calculate an accurate integer "coveragePercent" (0 to 100) reflecting overall completion.
        6. Use the course name from the document, or fallback to "${currentCourse?.courseName || "Course Analysis"}".
      `;

      const apiKey = customGeminiKey || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, syllabusPart, ...noteParts],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              courseName: { type: "STRING" },
              coveragePercent: { type: "INTEGER" },
              topics: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    status: {
                      type: "STRING",
                      enum: ["covered", "partially_covered", "not_covered"],
                    },
                    whatIsMissing: { type: "STRING" },
                  },
                  required: ["name", "status", "whatIsMissing"],
                },
              },
            },
            required: ["courseName", "coveragePercent", "topics"],
          },
        },
      };

      const data = await fetchGeminiWithRetry(apiUrl, payload);
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        throw new Error(
          "Empty response from Gemini. Click the Settings gear icon in the top bar and add your Gemini API key."
        );
      }

      const parsedReport = JSON.parse(rawText);
      const updatedCourse = {
        id: activeCourseId,
        courseName:
          currentCourse?.courseName &&
          currentCourse.courseName !== "My First Subject"
            ? currentCourse.courseName
            : parsedReport.courseName,
        coveragePercent: Math.min(
          100,
          Math.max(0, Number(parsedReport.coveragePercent) || 0)
        ),
        topics: parsedReport.topics || [],
        updatedAt: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const updatedCourses = {
        ...courses,
        [activeCourseId]: updatedCourse,
      };

      await persistCourseData(updatedCourses, activeCourseId);
      setActiveFilter("all");
      setStatusBanner({
        type: "success",
        message: "AlphaX audit complete! Scroll down to review your gap report.",
      });
    } catch (err) {
      console.error(err);
      setStatusBanner({
        type: "error",
        message:
          err.message ||
          "Failed to analyze files. Ensure files are valid PDFs/Images under 15MB and your Gemini API key is configured in Settings.",
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleGenerateStudyNotes = async (topic) => {
    setStudyModalTopic(topic);
    setStudyNotesContent("");
    setGeneratingStudyNotes(true);

    try {
      const activeCourse = courses[activeCourseId];
      const apiKey = customGeminiKey || "";
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

      const prompt = `
        You are AlphaX, an expert university tutor. A student is preparing for "${activeCourse?.courseName || "their exam"}" and is missing notes for the topic:
        
        Topic: "${topic.name}"
        Gap Identified: "${topic.whatIsMissing || "Complete topic needs to be covered"}"
        
        Create concise, high-yield exam revision notes for this exact topic. Structure it clearly with:
        1. Core Definition & Intuition (2-3 sentences)
        2. Key Concepts, Formulas, or Steps (bullet points)
        3. Quick Exam Tip / Common Pitfall
        
        Keep it crisp, clear, and easy to memorize.
      `;

      const payload = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4 },
      };

      const data = await fetchGeminiWithRetry(apiUrl, payload);
      const text =
        data?.candidates?.[0]?.content?.parts?.[0]?.text ||
        "Could not generate notes. Please check your Gemini API key in Settings.";
      setStudyNotesContent(text);
    } catch (err) {
      setStudyNotesContent(
        `Error generating study guide: ${err.message}\n\nTip: Click the Settings gear icon in the top bar to enter your Gemini API key.`
      );
    } finally {
      setGeneratingStudyNotes(false);
    }
  };

  const currentCourse = courses[activeCourseId] || {
    courseName: "No Subject Selected",
    coveragePercent: 0,
    topics: [],
  };

  const counts = {
    all: currentCourse.topics.length,
    not_covered: currentCourse.topics.filter((t) => t.status === "not_covered")
      .length,
    partially_covered: currentCourse.topics.filter(
      (t) => t.status === "partially_covered"
    ).length,
    covered: currentCourse.topics.filter((t) => t.status === "covered").length,
  };

  const filteredTopics = currentCourse.topics.filter((t) =>
    activeFilter === "all" ? true : t.status === activeFilter
  );

  // ============================================================================
  // VIEW 1: LOGIN SCREEN
  // ============================================================================
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between text-slate-900">
        <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900">
              Alpha<span className="text-indigo-600">X</span>
            </span>
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 px-3 py-2 rounded-lg hover:bg-slate-200/60 transition"
          >
            <Settings className="w-4 h-4" />
            <span>API & Firebase Config</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-7 sm:p-9">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-semibold mb-5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>AlphaX • Powered by Gemini AI</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
              Never miss a critical topic before exams.
            </h1>
            <p className="mt-3 text-sm sm:text-base text-slate-600 leading-relaxed">
              Upload your official course outline and your lecture notes. AlphaX
              instantly maps what you have covered and flags every missing topic.
            </p>

            {statusBanner && (
              <div
                className={`mt-5 p-3.5 rounded-xl text-xs sm:text-sm flex items-start gap-2.5 ${
                  statusBanner.type === "error"
                    ? "bg-rose-50 text-rose-800 border border-rose-200"
                    : "bg-indigo-50 text-indigo-800 border border-indigo-200"
                }`}
              >
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{statusBanner.message}</span>
              </div>
            )}

            <div className="mt-7 space-y-3">
              <button
                onClick={handleGoogleSignIn}
                disabled={authLoading}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 px-4 rounded-xl shadow-sm transition cursor-pointer disabled:opacity-60"
              >
                {authLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.5 12.3c0-.8-.1-1.7-.2-2.5H12v4.8h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.3 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.6 7.4C.6 9.4 0 11.6 0 14s.6 4.6 1.6 6.6l3.7-2.8z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 20.4 7.4 23 12 23z"
                    />
                  </svg>
                )}
                <span>Sign in with Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-3 text-xs uppercase tracking-wider text-slate-400 font-medium">
                  or test immediately
                </span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              <button
                onClick={handleEnterDemoMode}
                className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold py-3.5 px-4 rounded-xl border border-indigo-200/80 transition cursor-pointer"
              >
                <span>Continue in Demo Mode</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Supports PDF & Handwritten Notes
              </span>
              <span>AlphaX v1.0</span>
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-slate-400">
          AlphaX • Built with React, Tailwind CSS, Firebase & Gemini AI
        </footer>

        {showSettings && (
          <SettingsModal
            customGeminiKey={customGeminiKey}
            setCustomGeminiKey={setCustomGeminiKey}
            firebaseConfigInput={firebaseConfigInput}
            setFirebaseConfigInput={setFirebaseConfigInput}
            onSave={handleSaveSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: MAIN ALPHAX GAP DASHBOARD
  // ============================================================================
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-16">
      <nav className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight text-slate-900">
                Alpha<span className="text-indigo-600">X</span>
              </span>
              {isDemoMode && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-100 text-amber-800">
                  Demo Mode
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowSettings(true)}
              title="API & Firebase Settings"
              className="p-2.5 rounded-xl text-slate-600 hover:text-indigo-600 hover:bg-slate-100 transition cursor-pointer"
            >
              <Settings className="w-5 h-5" />
            </button>

            <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l border-slate-200">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border border-slate-200"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center">
                  {(user.displayName || "S").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="text-left leading-tight">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-[140px]">
                  {user.displayName || "Student"}
                </p>
                <p className="text-[11px] text-slate-500 truncate max-w-[140px]">
                  {user.email}
                </p>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-rose-50 hover:text-rose-700 transition cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 space-y-6">
        {statusBanner && (
          <div
            className={`p-4 rounded-2xl text-sm flex items-center justify-between gap-3 border ${
              statusBanner.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : statusBanner.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : "bg-indigo-50 text-indigo-800 border-indigo-200"
            }`}
          >
            <div className="flex items-center gap-2.5">
              {statusBanner.type === "error" ? (
                <XCircle className="w-5 h-5 shrink-0 text-rose-600" />
              ) : statusBanner.type === "success" ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              ) : (
                <Sparkles className="w-5 h-5 shrink-0 text-indigo-600" />
              )}
              <span>{statusBanner.message}</span>
            </div>
            <button
              onClick={() => setStatusBanner(null)}
              className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Your Subjects
              </h2>
            </div>

            {!isAddingSubject && (
              <button
                onClick={() => setIsAddingSubject(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition self-start sm:self-auto cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Subject</span>
              </button>
            )}
          </div>

          {isAddingSubject && (
            <form
              onSubmit={handleCreateSubject}
              className="mb-4 flex flex-col sm:flex-row gap-2"
            >
              <input
                type="text"
                placeholder="e.g., Data Structures, Thermodynamics, Macroeconomics..."
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                autoFocus
                className="flex-1 px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingSubject(false)}
                  className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {Object.values(courses).map((course) => {
              const isSelected = course.id === activeCourseId;
              return (
                <div
                  key={course.id}
                  onClick={() => {
                    setActiveCourseId(course.id);
                    setActiveFilter("all");
                  }}
                  className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-sm font-medium border transition cursor-pointer ${
                    isSelected
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <BookOpen
                    className={`w-4 h-4 ${
                      isSelected ? "text-indigo-200" : "text-slate-400"
                    }`}
                  />
                  <span>{course.courseName}</span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-md font-bold ${
                      isSelected
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-200/80 text-slate-600"
                    }`}
                  >
                    {course.coveragePercent}%
                  </span>
                  {Object.keys(courses).length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteSubject(course.id);
                      }}
                      title="Delete subject"
                      className={`p-0.5 rounded hover:bg-black/15 transition ${
                        isSelected
                          ? "text-indigo-200 hover:text-white"
                          : "text-slate-400 hover:text-rose-600"
                      }`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                AlphaX Curriculum & Notes Audit
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Upload your official course outline and one or more note files
                (PDFs or photos of handwritten pages).
              </p>
            </div>
            {currentCourse.updatedAt && (
              <span className="text-xs text-slate-400">
                Last synced: {currentCourse.updatedAt}
              </span>
            )}
          </div>

          <form onSubmit={handleAnalyzeGap} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                onClick={() => syllabusInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between ${
                  syllabusFile
                    ? "border-indigo-400 bg-indigo-50/40"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-slate-50/70"
                }`}
              >
                <input
                  ref={syllabusInputRef}
                  type="file"
                  accept=".pdf,image/*"
                  onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                  className="hidden"
                />

                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      syllabusFile
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      Step 1 • Required
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-0.5">
                      Official Course Outline
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      PDF document or clear photo of your course curriculum
                    </p>
                  </div>
                </div>

                {syllabusFile ? (
                  <div className="mt-4 flex items-center justify-between bg-white px-3 py-2 rounded-xl border border-indigo-200 text-xs">
                    <span className="font-medium text-slate-800 truncate pr-2">
                      {syllabusFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSyllabusFile(null);
                      }}
                      className="text-rose-600 hover:text-rose-700 font-semibold shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Click to select outline file</span>
                  </div>
                )}
              </div>

              <div
                onClick={() => notesInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-2xl p-5 transition cursor-pointer flex flex-col justify-between ${
                  notesFiles.length > 0
                    ? "border-emerald-400 bg-emerald-50/30"
                    : "border-slate-300 hover:border-emerald-400 hover:bg-slate-50/70"
                }`}
              >
                <input
                  ref={notesInputRef}
                  type="file"
                  multiple
                  accept=".pdf,image/*"
                  onChange={handleNotesSelect}
                  className="hidden"
                />

                <div className="flex items-start gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                      notesFiles.length > 0
                        ? "bg-emerald-600 text-white"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <Upload className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                      Step 2 • Multiple Files Allowed
                    </span>
                    <h3 className="font-bold text-slate-900 text-base mt-0.5">
                      Your Study Notes
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">
                      Upload lecture PDFs, slides, or photos of handwritten
                      pages
                    </p>
                  </div>
                </div>

                {notesFiles.length > 0 ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 space-y-1.5 max-h-28 overflow-y-auto pr-1"
                  >
                    {notesFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-white px-3 py-1.5 rounded-lg border border-emerald-200 text-xs"
                      >
                        <span className="font-medium text-slate-800 truncate pr-2">
                          {file.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeNoteFile(idx)}
                          className="text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => notesInputRef.current?.click()}
                      className="text-xs font-semibold text-emerald-700 hover:underline pt-1 inline-flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add more note files
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Click to select notes (PDF / Images)</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <p className="text-xs text-slate-500">
                AlphaX AI reads handwriting and tables automatically. Results
                sync to your profile.
              </p>

              <button
                type="submit"
                disabled={analyzing || !syllabusFile || notesFiles.length === 0}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold px-6 py-3.5 rounded-xl shadow-sm transition cursor-pointer disabled:cursor-not-allowed"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>AlphaX Mapping Curriculum...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    <span>Find Missing Topics</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {currentCourse.topics && currentCourse.topics.length > 0 ? (
          <section className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-sm space-y-6">
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                    AlphaX Audit Report
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {currentCourse.courseName}
                  </h2>
                </div>

                <div className="flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-extrabold text-slate-900">
                    {currentCourse.coveragePercent}%
                  </span>
                  <span className="text-sm font-medium text-slate-500">
                    Covered
                  </span>
                </div>
              </div>

              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    currentCourse.coveragePercent >= 75
                      ? "bg-emerald-500"
                      : currentCourse.coveragePercent >= 40
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  }`}
                  style={{ width: `${currentCourse.coveragePercent}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3">
                  <p className="text-xs font-semibold text-rose-700">
                    Not Covered
                  </p>
                  <p className="text-xl font-bold text-rose-900 mt-0.5">
                    {counts.not_covered}
                  </p>
                </div>
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3">
                  <p className="text-xs font-semibold text-amber-700">
                    Partial Gaps
                  </p>
                  <p className="text-xl font-bold text-amber-900 mt-0.5">
                    {counts.partially_covered}
                  </p>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3">
                  <p className="text-xs font-semibold text-emerald-700">
                    Completed
                  </p>
                  <p className="text-xl font-bold text-emerald-900 mt-0.5">
                    {counts.covered}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-4">
              {[
                { key: "all", label: `All Topics (${counts.all})` },
                {
                  key: "not_covered",
                  label: `Missing (${counts.not_covered})`,
                },
                {
                  key: "partially_covered",
                  label: `Partially Covered (${counts.partially_covered})`,
                },
                { key: "covered", label: `Covered (${counts.covered})` },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer ${
                    activeFilter === tab.key
                      ? "bg-slate-900 text-white shadow-sm"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200/80"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredTopics.length === 0 ? (
                <div className="text-center py-10 text-sm text-slate-500">
                  No topics match this filter.
                </div>
              ) : (
                filteredTopics.map((topic, index) => {
                  const isMissing = topic.status === "not_covered";
                  const isPartial = topic.status === "partially_covered";
                  const isCovered = topic.status === "covered";

                  return (
                    <div
                      key={index}
                      className={`rounded-2xl p-4 sm:p-5 border-l-4 border transition ${
                        isMissing
                          ? "bg-rose-50/40 border-rose-200 border-l-rose-500"
                          : isPartial
                          ? "bg-amber-50/40 border-amber-200 border-l-amber-500"
                          : "bg-emerald-50/30 border-emerald-200/80 border-l-emerald-500"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isMissing && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800">
                                <XCircle className="w-3.5 h-3.5" />
                                Not Covered
                              </span>
                            )}
                            {isPartial && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                Partially Covered
                              </span>
                            )}
                            {isCovered && (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Covered
                              </span>
                            )}
                          </div>

                          <h3 className="font-bold text-slate-900 text-base">
                            {topic.name}
                          </h3>

                          {!isCovered && topic.whatIsMissing && (
                            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                              <span className="font-semibold text-slate-800">
                                Gap Details:{" "}
                              </span>
                              {topic.whatIsMissing}
                            </p>
                          )}
                        </div>

                        {!isCovered && (
                          <button
                            onClick={() => handleGenerateStudyNotes(topic)}
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs transition shrink-0 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Generate Quick Study Notes</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ) : (
          <section className="bg-white rounded-2xl border border-dashed border-slate-300 p-8 sm:p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900">
              No AlphaX Report Yet for "{currentCourse.courseName}"
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1.5">
              Upload your course outline and notes above, then click{" "}
              <strong className="text-slate-700">Find Missing Topics</strong> to
              generate your coverage checklist.
            </p>
            {isDemoMode && (
              <button
                onClick={() => {
                  setCourses(SAMPLE_DEMO_COURSES);
                  setActiveCourseId("cs-301");
                }}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3.5 py-2 rounded-xl cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Load Sample Operating Systems Report</span>
              </button>
            )}
          </section>
        )}
      </main>

      {studyModalTopic && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                    AlphaX Quick Revision Guide
                  </p>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                    {studyModalTopic.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setStudyModalTopic(null)}
                className="p-2 rounded-xl text-slate-500 hover:bg-slate-200/70 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-sm text-slate-700 leading-relaxed">
              {studyModalTopic.whatIsMissing && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                  <strong>Targeted Gap: </strong>
                  {studyModalTopic.whatIsMissing}
                </div>
              )}

              {generatingStudyNotes ? (
                <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <p className="text-sm font-medium text-slate-600">
                    Drafting concise revision notes for this topic...
                  </p>
                </div>
              ) : (
                <div className="whitespace-pre-wrap font-sans text-slate-800 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  {studyNotesContent}
                </div>
              )}
            </div>

            <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setStudyModalTopic(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition cursor-pointer"
              >
                Done Studying
              </button>
            </div>
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          customGeminiKey={customGeminiKey}
          setCustomGeminiKey={setCustomGeminiKey}
          firebaseConfigInput={firebaseConfigInput}
          setFirebaseConfigInput={setFirebaseConfigInput}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

function SettingsModal({
  customGeminiKey,
  setCustomGeminiKey,
  firebaseConfigInput,
  setFirebaseConfigInput,
  onSave,
  onClose,
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900">
              AlphaX API & Firebase Configuration
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSave} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Gemini API Key (Required for Local VS Code)
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              value={customGeminiKey}
              onChange={(e) => setCustomGeminiKey(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Get a free key from Google AI Studio to power AI file analysis.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Firebase Web Config JSON (Optional — for Google Sign-In & Cloud Sync)
            </label>
            <textarea
              rows={5}
              placeholder='{"apiKey": "...", "authDomain": "...", "projectId": "...", "appId": "..."}'
              value={firebaseConfigInput}
              onChange={(e) => setFirebaseConfigInput(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-mono rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer"
            >
              Save Settings
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}