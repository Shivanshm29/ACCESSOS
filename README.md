# ACCESSOS

**ACCESSOS** is an AI-powered Chrome and Microsoft Edge browser extension engineered to help users experiencing accessibility, language, literacy, and digital-navigation barriers complete complex digital processes.

> **Status: Phase 17 Completed (Hackathon Demo — FINAL ROADMAP PHASE)**  
> ACCESSOS features deterministic semantic extraction, local accessibility auditing, AI reasoning, Guided Mode progressive walkthroughs, Plain-Language Explain Anything, an allowlisted Safe Interaction Engine, Document Intelligence, User Preferences, a system-wide Privacy & Security architecture, a deterministic Completion Checker, a local Analytics & Productivity Measurement engine, validated Real-Site Testing compatibility across 10 diverse public site categories, comprehensive Production Hardening, complete Production-Style Deployment, and a judge-ready Hackathon Demonstration workflow.
> 
> *Core Invariants:*  
> - **"ACCESSOS treats webpage content, document content, and AI output as untrusted data."**  
> - **"Phase 8 remains the only browser mutation authority."**
> - **"Phase 17 is the FINAL roadmap phase. No further phases have been or will be started."**
> - **"Extension distribution packages contain ZERO secrets, zero TypeScript sources, and minimal Manifest V3 permissions."**
> - **"The backend runs non-root and starts cleanly in deterministic mode without external cloud dependencies."**
> - **"Network retry logic strictly enforces ZERO retries for browser mutations; mutations are single-shot and non-idempotent."**
> - **"Tab navigation and closure immediately invalidate active capability tokens and execution context."**
> - **"Real-site testing operates strictly via an explicit public allowlist in read-only / assistive mode by default."**
> - **"The Completion Checker determines workflow readiness deterministically and NEVER mutates browser state."**
> - **"Analytics is strictly local, observer-only, bounded, and contains zero PII, zero surveillance, and zero external telemetry."**

---

## Repository Structure

```
accessos/
├── extension/             # Chrome/Edge Manifest V3 TypeScript extension
│   ├── src/               # Background worker, content scripts, popup, options, overlay
│   ├── public/            # Static assets and manifest template
│   ├── icons/             # Extension icon assets (16x16, 48x48, 128x128)
│   ├── tests/             # Vitest unit & integration test suite
│   ├── manifest.json      # Manifest V3 specification
│   ├── package.json       # Extension npm package configuration
│   ├── tsconfig.json      # TypeScript compiler configuration
│   └── vite.config.ts     # Vite bundler configuration
├── backend/               # Python FastAPI backend service
│   ├── app/               # FastAPI application, core configuration, routers, schemas
│   ├── tests/             # Pytest test suite
│   ├── Dockerfile         # Container definition for backend
│   ├── pyproject.toml     # Packaging and pytest configuration
│   ├── requirements.txt   # Production Python dependencies
│   └── requirements-dev.txt # Development & test dependencies
├── tests/fixtures/        # Local HTML and document fixtures for testing
├── .env.example           # Environment variable template
├── .gitignore             # Git ignore configuration
├── docker-compose.yml     # Container orchestration
├── package.json           # Root convenience scripts
└── README.md              # Project overview and setup instructions
```

---

## Prerequisites

Ensure you have the following installed locally:
- **Node.js**: v20.x or later (v24+ recommended)
- **npm**: v10.x or later
- **Python**: v3.11 or later (v3.12 - v3.14 supported)
- **Google Chrome** or **Microsoft Edge** browser
- *(Optional)* **Docker & Docker Compose**

---

## Local Setup Instructions

### 1. Configure Environment Variables

Copy the template environment file:

```bash
cp .env.example .env
```

*(On Windows PowerShell: `Copy-Item .env.example .env`)*

---

### 2. Backend Setup (FastAPI & Python)

#### A. Create and activate a Python virtual environment

```bash
# Navigate to the repository root
cd accessos

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Linux / macOS:
source .venv/bin/activate
```

#### B. Install dependencies

```bash
pip install -r backend/requirements-dev.txt
```

#### C. Run backend tests

```bash
pytest backend
```

#### D. Start the backend development server

```bash
uvicorn app.main:app --app-dir backend --reload --port 8000
```

- API Base URL: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`
- Health Endpoint: `http://localhost:8000/health`

---

### 3. Extension Setup (TypeScript & Manifest V3)

#### A. Install npm dependencies

```bash
cd extension
npm install
```

#### B. Run extension tests (Vitest)

```bash
npm test
```

#### C. Build the extension

```bash
npm run build
```

#### D. Load into Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked** in the top-left toolbar.
4. Select the `accessos/extension/dist` directory.
5. The **ACCESSOS** extension icon will appear in your extensions menu and toolbar.

#### E. Load into Microsoft Edge

1. Open Microsoft Edge and navigate to `edge://extensions/`.
2. Toggle on **Developer mode** in the left sidebar.
3. Click **Load unpacked** at the top of the extensions page.
4. Select the `accessos/extension/dist` directory.
5. The **ACCESSOS** extension icon will appear in your toolbar.

---

### 4. Testing the "Analyze Current Page" Feature

#### Testing on Normal Web Pages & Test Fixture

1. Open any standard webpage (e.g. `https://en.wikipedia.org` or our test fixture).
2. To test against the local test fixture:
   ```bash
   # Start local HTTP server
   python -m http.server 3000 --directory tests/fixtures
   ```
   Navigate to `http://localhost:3000/accessos-test-page.html`.
3. Click the **ACCESSOS** icon in the browser toolbar to open the extension popup.
4. Verify the initial state: `"Ready to analyze this page."`
5. Click **[ Analyze Current Page ]**.
6. The status transitions briefly to `"Analyzing page..."`, then displays:
   - **Page**: `ACCESSOS Test Sandbox Page`
   - **URL**: `localhost:3000/accessos-test-page.html`
   - **Page type**: `Web Page`
   - **Interactive elements**: `9`

#### Testing Unsupported System Pages

1. Navigate to an internal browser URL such as `chrome://extensions/` or `edge://extensions/`.
2. Open the **ACCESSOS** extension popup.
3. Click **[ Analyze Current Page ]**.
4. Verify that ACCESSOS does not crash and displays:
   - `"ACCESSOS cannot analyze this page."`
   - `"Browser internal or protected system pages cannot be inspected."`

---

### 5. Running the Demo Portal (National Student Scholarship Portal)

### 5. Running with Docker Compose (Alternative)

To run the backend using Docker:

```bash
docker compose up --build
```

- Backend API: `http://localhost:8000`
- Health Check: `http://localhost:8000/health`

---

## Verification & Testing Commands

To run tests across both backend and extension:

```bash
# Run backend tests
pytest backend

# Run extension unit and integration tests
npm --prefix extension test

# Or using root convenience script:
npm test
```

| Verification Check | Command | Expected Result |
| :--- | :--- | :--- |
| **Backend Tests** | `pytest backend` | `191 passed, 1 skipped` |
| **Extension Regression Tests** | `npm --prefix extension test` | All tests pass |
| **TypeScript Typecheck** | `npm --prefix extension run typecheck` | Clean exit (0 errors) |
| **Extension Production Build** | `npm --prefix extension run build` | Builds `dist/` cleanly |
| **Backend Health Endpoint** | `curl http://localhost:8000/health` | HTTP 200 `{"status": "healthy", ...}` |
| **Backend Readiness Endpoint** | `curl http://localhost:8000/ready` | HTTP 200 `{"status": "ready", ...}` |

---

## Architectural Guarantees & Privacy

1. **Untrusted Data Boundary:** All web page content, DOM trees, and model outputs are treated as untrusted data and strictly validated.
2. **Minimal Permissions:** Manifest V3 extension utilizes only `storage` and `activeTab` permissions.
3. **Safe Interaction Pipeline:** Browser mutations require cryptographic capability tokens and explicit `USER_EXPLICIT` human provenance.
4. **Permanent Submit Blocker:** Consequential actions such as form submission and automated file uploads are permanently barred.
5. **Zero External Telemetry:** All analytics and auditing remain strictly local on-device without remote tracking.





