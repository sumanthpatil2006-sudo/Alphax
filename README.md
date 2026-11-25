# AlphaX

AlphaX turns uploaded study notes into editable text, simple explanations, summaries, and practice questions. The MVP uses Firebase Authentication, Cloud Firestore, and Firebase Storage when configured; without Firebase web settings it runs in browser-local demo mode.

## Run locally

Requirements: Node.js 20 or newer and an internet connection for Firebase, Gemini, Tesseract.js, and PDF.js.

1. In `firebase/firebase-config.js`, replace the placeholder values with the web app configuration from Firebase Console.
2. In Firebase Console, enable **Authentication → Email/Password**, create a **Firestore Database**, and enable **Storage**.
3. From the project root, copy the server environment template and edit it:

   ```powershell
   Copy-Item server\.env.example server\.env
   notepad server\.env
   ```

4. Set `GEMINI_API_KEY` to a Gemini API key. Configure Firebase Admin credentials for the backend by either setting `GOOGLE_APPLICATION_CREDENTIALS` to a service-account JSON file outside this repository, or pasting the service-account JSON into `FIREBASE_SERVICE_ACCOUNT_JSON`. Set `FIREBASE_PROJECT_ID` to your project ID.
5. Install dependencies and start the app from the project root:

   ```powershell
   npm install --prefix server
   npm run dev --prefix server
   ```

6. Open [http://localhost:3000](http://localhost:3000). The Express server serves both the pages and the API. Run backend checks with `npm test --prefix server`.

The Firebase web configuration is public client configuration, not a secret. Restrict its API key in Google Cloud Console. Never commit `server/.env` or service-account credentials. The backend verifies Firebase ID tokens before calling Gemini. `FRONTEND_ORIGIN` is only needed when the frontend is hosted on a different origin; enter allowed origins as a comma-separated list.

## Firebase security rules

The included `firestore.rules` and `storage.rules` restrict notes and uploads to their owner. Deploy them with the Firebase CLI after signing in and selecting your Firebase project:

```powershell
firebase deploy --only firestore:rules,storage
```

`firebase.json` points the CLI to these rules. Confirm that your Firebase project has Firestore and Storage enabled before deployment.

## MVP features

- Email/password registration and login, logout, and user-specific pages.
- Browser-local demo accounts and notes if Firebase web configuration is still a placeholder. Demo accounts use a salted password hash, but local mode is not production authentication and does not sync across browsers.
- Image OCR for JPG, PNG, and WebP, plus text extraction and OCR fallback for PDFs (up to 30 pages). OCR uses English.
- Editable extracted text, note upload to Firebase Storage, and notes saved to Firestore.
- Gemini explanations, summaries, practice questions, and follow-up tutoring through the authenticated Express API.
- Responsive dashboard, recent notes, note library, and AI Tutor.

Uploads are limited to 15 MB, and AI input is limited to 20,000 characters. OCR quality depends on scan clarity; handwriting may need manual correction. Third-party OCR/PDF scripts are loaded from CDNs.

## Local demo mode

Without Firebase settings, registration, login, and notes run only in that browser using `localStorage`. This is useful for trying the UI and OCR, but Gemini endpoints deliberately require a Firebase-authenticated account and valid Firebase Admin credentials. Configure Firebase and Gemini to use AI features.
