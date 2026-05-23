# Contributing to Yaqeen

Thank you for your interest in contributing to **Yaqeen**! Contributions from the developer community are vital to making this AI-powered service marketplace orchestrator a robust, resilient tool for localized service ecosystems.

Please read through this guide to understand our repository structure, local environment configuration, development workflows, and coding standards.

---

## Code of Conduct

By participating in this project, you agree to uphold our commitment to an open, inclusive, and professional environment. Please treat all contributors with respect, empathy, and constructive feedback.

---

## Repository Structure

The project is organized as a decoupled monorepo:
* **`/backend`**: Node.js & Express API middleware housing the core AI orchestrator (`AntigravityOrchestrator`), JSON repair utilities, and routing connectors.
* **`/mobile-app`**: React Native & Expo mobile application containing the role-based dashboards, native media features, and chat engines.
* **`database.rules.json` / `firestore.rules`**: Firebase configurations and profile-completeness guards.

---

## Local Development Setup

To get the application up and running locally, ensure you have **Node.js (v18+)** installed.

### 1. Pre-requisites & Credentials
You will need your own API keys. 

Create a `.env` file in the `/backend` folder:
```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
MOCK_AI=false
```

Create a `.env` file in the `/mobile-app` folder:
```env
EXPO_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
EXPO_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

### 2. Backend Setup
1. Open your terminal and navigate to `/backend`:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Express server:
   ```bash
   npm start
   ```
   The backend will start listening at `http://localhost:4000`.

### 3. Mobile Frontend Setup
1. Navigate to `/mobile-app`:
   ```bash
   cd ../mobile-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Expo developer client:
   ```bash
   npx expo start
   ```
4. Scan the QR code with the Expo Go app (on Android) or Camera app (on iOS) to launch the app on your mobile device, or press `a` (Android) or `i` (iOS) to launch in a simulator.

---

## Development & Git Workflow

We use a simple branch-based workflow to manage changes:

1. **Fork/Branch**: Always create a feature or bugfix branch from `main`:
   ```bash
   git checkout -b feature/your-awesome-feature
   # or
   git checkout -b bugfix/description-of-bug
   ```
2. **Commit Messages**: Write clear, imperative commits. E.g., `feat: integrate Google Maps Places autocomplete on provider profile`.
3. **Keep Branches Synced**: Regularly rebase or merge `main` into your feature branch to avoid merge conflicts.

---

## Coding Standards & Verification

To maintain code quality and prevent runtime failures, we enforce strict checks before any code is pushed:

### 1. Syntax Integrity Checks
Before submitting a Pull Request, run a syntax validity check on all modified JavaScript files using `node -c` (on Windows or Linux):
```bash
node -c backend/src/index.js
node -c mobile-app/App.js
```
All files must pass without any compilation errors.

### 2. File and Architecture Guardrails
* **No Hardcoded Credentials**: Never commit API keys, service accounts, or private `.env` variables to git. Double-check your `.gitignore` configuration before committing.
* **Preserve Documentation Integrity**: Do not delete existing comments, inline documentation, or JSDoc strings unless they are directly contradicted by your changes.

---

## Submitting Pull Requests

When your code is ready, open a Pull Request (PR) against the `main` branch. Ensure that you:
1. Complete all sections of the [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md).
2. Detail how your changes were verified (manual logs, simulator run, or automated outputs).
3. Wait for feedback or approval from the core repository maintainers.

We look forward to your contributions! Let's build a smarter service ecosystem together.
