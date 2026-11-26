# 🎓 AlphaX — AI Curriculum & Study Gap Auditor

> **Never miss a critical syllabus topic before exams.**  
> AlphaX compares your official course outline against your typed and handwritten lecture notes using multimodal AI to pinpoint exact knowledge gaps and generate instant revision guides.

---

## 🚨 The Problem: "Syllabus Blindness"
Students prepare for exams using scattered PDFs, lecture slides, and photos of handwritten notebooks. Cross-checking dozens of pages line-by-line against an official university syllabus takes hours—and students often discover missing subtopics, derivations, or formulas only when they see the exam paper.

## 💡 The Solution
**AlphaX** acts as an automated academic curriculum auditor:
1. **Upload Your Course Outline:** Drop in an official syllabus PDF or photo.
2. **Upload Your Notes:** Attach multiple files at once—including lecture PDFs, slides, and photos of handwritten pages.
3. **Instant Gap Mapping:** AlphaX extracts every topic and classifies your preparation into **Covered**, **Partially Covered** (highlighting exact missing formulas/derivations), or **Not Covered**.
4. **One-Click Revision Notes:** Generate high-yield, exam-ready study notes for any missing or incomplete topic directly inside the dashboard.

---

## ✨ Key Features
- **Multimodal Document & Handwriting Analysis:** Powered by **Gemini 3 Flash Preview** to read PDFs, tables, diagrams, and handwritten pages simultaneously.
- **Deterministic Structured Reports:** Uses strict JSON schema enforcement to calculate accurate completion percentages and categorize every syllabus topic.
- **Interactive Gap Dashboard:** Filter topics by *All*, *Missing*, *Partially Covered*, or *Covered* with animated progress tracking.
- **AI Quick Revision Drawer:** Generates concise definitions, key formulas, and exam pitfalls for any flagged gap.
- **Multi-Subject Management:** Track multiple courses across a semester with persistent storage via **Firebase Firestore** or instant browser-based **Demo Mode**.

---

## 🛠️ Tech Stack
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons
- **AI Engine:** Google Gemini API (`gemini-3-flash-preview` with structured `responseSchema`)
- **Authentication & Database:** Firebase Auth (Google Sign-In) & Cloud Firestore (plus LocalStorage Demo Mode)

---

## 🚀 Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- A free Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation
1. **Clone the repository:**
   ```bash
   git clone [https://github.com/sumanthpatil2006-sudo/AlphaX.git](https://github.com/sumanthpatil2006-sudo/AlphaX.git)
   cd AlphaX