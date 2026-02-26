# CareXAI – Real-Time AI-Powered Healthcare Platform

CareXAI is a real-time telehealth platform that connects patients, doctors, and admins through secure video consultations, intelligent AI assistance, and rich clinical dashboards.

## What’s New / Recent Updates

- **Realtime backend is live**: Express + Socket.IO + Prisma (SQLite) powering auth, appointments, chat, schedules/slots, and queue updates.
- **Local ML risk scoring**: `/ai/health-risk` calls a Python CLI expected at `../handrecognition/ml_risk_cli.py` (diabetes/heart/hypertension).
- **Telechat with translation**: the Telechat panel can translate messages via Gemini using `VITE_GEMINI_API_KEY`.
- **Owner admin bootstrap**: backend auto-ensures a single “owner admin” via `OWNER_ADMIN_EMAIL` / `OWNER_ADMIN_PASSWORD`.
- **Windows convenience scripts**: `start-frontend.ps1` and `server/start-backend.ps1` run dev servers quickly.

---

## 1. Project Overview

CareXAI provides an end-to-end digital clinic experience:

- Patients can book appointments, chat with doctors, join video calls, and view their health insights.
- Doctors can manage schedules, consult patients via chat/video, and view analytics.
- Admins can monitor system health, users, and clinical activity.

The platform combines a modern React frontend, a Node.js + Prisma backend, real-time updates with Socket.IO, and AI capabilities powered by Google Gemini.

---

## 2. Problem Statement

Traditional healthcare systems often suffer from:

- Fragmented communication (phone calls, emails, paper notes).
- Long waiting times and poor visibility into appointment status.
- Limited remote consultation capabilities.
- Lack of intelligent assistance for triage and decision support.
- Poor analytics for understanding patient risk and system performance.

**CareXAI** aims to solve these problems by:

- Centralizing communication (chat + video) in one place.
- Providing real-time updates for appointments, messages, and alerts.
- Enabling remote, secure video consultations.
- Using AI to assist with symptom triage, report analysis, and risk prediction.
- Delivering dashboards for patients, doctors, and admins.

---

## 3. Key Features

### Frontend (Patient / Doctor / Admin)

- **Role-based dashboards**
   - Patient dashboard: upcoming appointments, health passport, AI risk insights.
   - Doctor dashboard: daily schedule, patient list, clinical alerts, analytics.
   - Admin dashboard: user management, system stats, audit logs.

- **Appointment management & real-time queue**
   - Patients can search/select doctors, pick time slots, and book appointments.
   - Doctors can manage availability, slots, and token numbers for in-person queues.
   - Status tracking (Scheduled, In Progress, Completed, Cancelled, etc.).
   - Real-time OPD-style queue view with each patient’s live position and doctor delay estimates.

- **Real-time chat (WhatsApp-style UI)**
   - One-to-one chat between patient and doctor per appointment.
   - Read receipts, timestamps, and file attachments (images/PDFs).

- **Telechat (doctor workflow)**
   - Dedicated chat panel with optional on-the-fly translation (Gemini-powered; see `VITE_GEMINI_API_KEY`).

- **Video consultations**
   - Browser-based video calls using Agora (or equivalent WebRTC provider).
   - Tokens generated securely on the backend.
   - Integrated into the appointment workflow.

- **AI medical assistant**
   - Gemini-powered chatbot for symptom queries and guidance (currently called from the frontend for demo/prototyping).
   - Document upload (e.g., lab reports) with AI-powered extraction and risk analysis.
   - Health passport with key metrics and AI insights.

- **Medication reminders (prototype)**
   - Patient & doctor UI for medication lists, dose schedules, adherence, and missed-dose alerts.
   - Note: parts of this flow currently use the in-browser `MockBackend` and are being migrated to the realtime backend.

### Backend

- **Authentication & authorization**
   - JWT-based auth with Patient, Doctor, and Admin roles.
   - Protected REST APIs and Socket.IO connections.
   - Session rehydration via `GET /auth/me` so each device/browser restores its user from a stored JWT independently.

- **Appointments & scheduling**
   - Prisma-based models for users, appointments, time slots, and chat messages.
   - Role-aware endpoints for listing and managing appointments.
   - OPD-style queues with token numbers, live status updates, and doctor schedules.

- **Real-time events**
   - Socket.IO channels for:
      - New appointment notifications.
      - Chat messages.
      - Slot updates and system events.
      - Appointment status/notes updates.
      - Queue position and delay updates per patient.

- **AI integration**
   - Backend service to call Google Gemini API for:
      - Chat completions.
      - Report extraction and structured metrics.

---

## 4. Tech Stack

### Frontend

- **React** (with hooks and functional components)
- **TypeScript**
- **Vite** (development/build tool)
- **Socket.IO Client** (real-time events)
- **UI libraries**: Tailwind-style utility classes / custom components
- **PWA**: `vite-plugin-pwa` + generated icons via `@vite-pwa/assets-generator`
- **Mobile options**:
   - **Capacitor** (Android wrapper dependencies included)
   - **Flutter** WebView wrapper (see `pubspec.yaml`)

### Backend

- **Node.js** + **Express**
- **Prisma ORM**
- **Socket.IO** (WebSockets-based real-time communication)

### Database

- **SQLite** (default local development database via Prisma, file-based)

### AI & External APIs

- **Google Gemini API** (via official Node client)
- **Agora (or similar)** for real-time video (WebRTC-based)

### Hosting / Deployment

- **Frontend**: Vercel
- **Backend**: (e.g., Render / Railway / Fly.io) – flexible, not tied to a single provider.
- **Database**: SQLite is the current default (Prisma `provider = "sqlite"`). For production-grade deployments you can migrate to Postgres later (requires updating Prisma datasource + migrations).

---

## 5. High-Level Architecture

At a high level:

1. **Client (React + TypeScript)**  
    - Renders dashboards and UI components.
    - Calls REST APIs for data (auth, appointments, metrics).
    - Maintains a WebSocket (Socket.IO) connection for real-time updates.
    - Uses the Agora SDK for video calls, getting tokens from the backend.

2. **API Server (Node.js + Express)**  
   - Exposes REST endpoints for auth, appointments, chat, metrics, schedules/slots, queue updates, and Agora token generation.
    - Issues JWTs on login and verifies them for each protected route.
   - Uses Prisma to query/update the SQLite database.
    - Exposes `/agora-token` (or similar) endpoint for secure video token generation.

3. **Realtime Layer (Socket.IO)**  
    - Listens for authenticated connections.
    - Subscribes users into rooms (e.g., `user:<id>`, `role:DOCTOR`, `appointment:<id>`).
    - Emits events when appointments or messages are created/updated.

4. **Database (SQLite via Prisma)**  
   - Stores users, appointments, time slots, chat messages, metrics, and AI outputs in a local file-backed database for development.

5. **AI Services (Gemini + Local ML)**  
   - **Gemini** is currently called from the frontend (demo/prototyping) using `@google/genai` and `VITE_GEMINI_API_KEY`.
   - **Local ML models** are called from the backend for `/ai/health-risk` via the Python CLI at `../handrecognition/ml_risk_cli.py`.

---

## 6. Folder Structure

A simplified folder layout:

```bash
careai/
├─ App.tsx                 # Root React component
├─ index.tsx               # React entry point
├─ vite.config.ts          # Vite configuration
├─ types.ts                # Shared TypeScript types
├─ components/             # Reusable UI & feature components
├─ pages/                  # Login + role dashboards
├─ services/               # API client, Gemini integration, utilities
├─ server/                 # Backend API + realtime server (Express + Socket.IO + Prisma)
│  ├─ index.js             # Server entry
│  ├─ prisma/              # Prisma schema + migrations (SQLite)
│  └─ README.md            # Backend-specific docs
├─ android/                # Flutter wrapper (Android)
├─ ios/                    # Flutter wrapper (iOS)
├─ lib/                    # Flutter wrapper Dart entry
├─ public/                 # Static assets
├─ start-frontend.ps1      # Windows dev shortcut
└─ README.md               # This file
```

> Optional local ML: the backend route `POST /ai/health-risk` expects a sibling folder `../handrecognition/` containing `ml_risk_cli.py` (see [server/index.js](server/index.js) and [server/README.md](server/README.md)). If you don’t have that folder, the rest of the app still runs; only that endpoint will fail.

---

## 7. How the System Works (Step-by-Step Flow)

### Authentication

1. User (patient, doctor, or admin) opens the app.
2. They register or log in via the **Login** page.
3. The frontend sends credentials to `/auth/login`.
4. Backend verifies credentials, issues a JWT, and returns role + profile.
5. Frontend stores the token (e.g., in `localStorage`) and:
    - Attaches it to all subsequent REST calls.
    - Uses it to authenticate the Socket.IO connection.
6. On subsequent visits, each browser/device uses the stored token to call `GET /auth/me` and restore the current user session independently.

### Appointments

1. Patient selects a doctor and a time slot (via Patient Dashboard).
2. Frontend calls `POST /appointments` with doctor ID, date, time, and consultation type (VIDEO or IN_PERSON).
3. Backend:
   - Creates an appointment record in SQLite (via Prisma).
    - Emits an `appointment:created` event via Socket.IO to:
       - The patient.
       - The doctor.
       - Admins (if relevant).
4. Dashboards update in real time.

### Real-Time Chat

1. From an appointment card, patient/doctor clicks **Message**.
2. Frontend opens `ChatSystem` with the specific `appointmentId`.
3. On mount:
    - Loads existing messages via `GET /appointments/:id/chat`.
    - Subscribes to `chat:message` events over Socket.IO.
4. When a message is sent:
    - Frontend calls `POST /appointments/:id/chat` with content and optional attachment.
    - Backend stores the message in the database and emits `chat:message` to both participants.
5. Both UIs update instantly without reload.

### Video Call

1. For a VIDEO appointment, both patient and doctor see a **Start Video Call** button.
2. When clicked:
    - Frontend uses the Agora SDK, deriving a unique `channelName` from the appointment.
    - Frontend requests a token from `POST /agora-token` with `channelName` and `uid`.
    - Backend verifies JWT, uses `AGORA_APP_ID` + `AGORA_APP_CERTIFICATE` to generate a time-limited token.
3. Frontend joins the Agora channel with `appId`, `channelName`, `token`, and `uid`.
4. When both participants join, their audio/video streams connect in real time.

### AI Assistant

1. User opens the AI chatbot or uploads a document.
2. For Gemini features (chat, report extraction, translation), the frontend calls Gemini directly using `VITE_GEMINI_API_KEY`.
3. For local ML risk scoring, the frontend calls `POST /ai/health-risk`, and the backend runs the Python models in `../handrecognition/ml_risk_cli.py`.
4. Results are returned and displayed in the UI.

---

## 8. Running the Project Locally

### 8.1. Prerequisites

- **Node.js** (LTS, e.g., 18+)
- **npm** (bundled with Node)
- **SQLite** (used via Prisma; no separate install needed for local dev)
- A **Google Gemini API key** (if using AI features)
- An **Agora** App ID and App Certificate (for video), if you enable video calls
- **Python 3.x** on PATH (only if using `/ai/health-risk`)
   - Python packages: `pandas`, `joblib`, `scikit-learn`

### 8.2. Clone the Repository

```bash
git clone <your-repo-url>.git
cd careai
```

If you want to enable the local ML risk endpoint (`POST /ai/health-risk`), ensure you also have a `handrecognition/` folder next to this repo root:

```text
<parent-folder>/
   careai/            (this repo)
   handrecognition/   (Python models; contains ml_risk_cli.py)
```

### 8.3. Install Dependencies

#### Frontend (root)

```bash
npm install
```

#### Backend (server)

```bash
cd server
npm install
cd ..
```

---

## 9. Environment Variables Setup

Create two `.env` files: one at the repo **root** (frontend) and one inside **server/** (backend).

### 9.1. Root `.env` (Frontend)

Create `./.env`:

```bash
VITE_API_BASE_URL=http://localhost:4000
VITE_GEMINI_API_KEY=<your_gemini_api_key_here>
VITE_AGORA_APP_ID=<your_agora_app_id_here>
```

> Do **not** commit real keys; use placeholders in shared configs.

### 9.2. Server `.env` (Backend)

Create `./server/.env` (you can start from the template `./server/.env.example`):

```bash
# SQLite database (default for local development)
DATABASE_URL="file:./dev.db"

# Auth
JWT_SECRET="<your_jwt_secret_here>"
PORT=4000

# Owner admin bootstrap (optional)
# If set, the backend ensures this admin exists on startup.
OWNER_ADMIN_EMAIL="owner@example.com"
OWNER_ADMIN_PASSWORD="change-me"

# Video (Agora)
AGORA_APP_ID="<your_agora_app_id_here>"
AGORA_APP_CERTIFICATE="<your_agora_app_certificate_here>"
```

---

## 10. Database Setup & Migrations (SQLite + Prisma)

1. Ensure `DATABASE_URL` in `server/.env` points to your SQLite file (the default `file:./dev.db` works for local dev).
2. From the `server` directory, run:

```bash
cd server

# Generate Prisma client
npx prisma generate

# Apply migrations (creates tables in your SQLite file)
npx prisma migrate dev --name init

# Optional: open Prisma Studio to inspect data
npx prisma studio
```

---

## 11. Starting the Development Servers

### 11.1. Start the Backend

From the repo root (either option works):

```bash
# Option A
npm run dev:server

# Option B
cd server
npm run dev
```

Windows shortcut:

```powershell
cd server
./start-backend.ps1
```

This starts the Express + Socket.IO server on:

```text
http://localhost:4000
```

### 11.2. Start the Frontend

In a separate terminal, from the project root:

```bash
npm run dev
```

Windows shortcut:

```powershell
./start-frontend.ps1
```

Vite will start the frontend, usually at:

```text
http://localhost:5173
```

Open this URL in your browser to use CareXAI.

---

## 12. Real-Time Features Explained

### 12.1. WebSockets / Socket.IO

- After login, the frontend creates a Socket.IO connection to `http://localhost:4000` with:

   ```js
   io(API_BASE_URL, { auth: { token: <jwt_token> } });
   ```

- The server authenticates the token and subscribes the user to rooms:

   - `user:<userId>`
   - `role:<role>`
   - Potentially `appointment:<appointmentId>`

- On key events (e.g., new appointment, chat message, slot update), the server emits events to the relevant rooms:

   ```js
   io.to(`user:${patientId}`).to(`user:${doctorId}`).emit('chat:message', message);
   io.to(`role:DOCTOR`).emit('appointment:created', appointment);
   ```

### 12.2. Chat

- Frontend listens for `chat:message` events and updates the `ChatSystem` UI in real time.
- Messages are also persisted in the SQLite database via Prisma for history.

### 12.3. Video Calls

- Video calls are handled by the Agora Web SDK (or equivalent), not directly over Socket.IO.
- Socket.IO is used to manage authentication + room membership; Agora handles the actual media transport.
- Backend exposes an authenticated route to generate short-lived video tokens.

### 12.4. Notifications

- “Soft” notifications (new appointments, messages, alerts) are delivered over Socket.IO.
- UI can show badges/toasts on these events.

---

## 13. Deployment Notes (Fixing localhost:4000 in Production)

If you see errors like `Failed to load resource: net::ERR_CONNECTION_REFUSED` to `http://localhost:4000/...` on your deployed site, it means the frontend is still pointing to a local backend.

- The frontend reads the base API URL from `VITE_API_BASE_URL` at build time. In production builds, you must set this to your public backend URL.

### Steps

- Deploy the backend (Express + Prisma) to a public host (e.g., Render, Railway, Fly.io, VPS). Ensure CORS allows your frontend origin.
- In your frontend hosting (e.g., Vercel):
   - Add an environment variable `VITE_API_BASE_URL` with your backend base URL (no trailing slash), for example:
      - `https://carexai-backend.onrender.com`
   - Redeploy the frontend so Vite bakes the correct URL into the bundle.

Optional: If you’ll proxy API calls through the same origin (e.g., `/api` on Vercel via rewrites), set `VITE_API_BASE_URL` to that proxied base and add the corresponding rewrite rules.

We include `.env.production.example` showing the required variable for production builds.

---

## 14. API Overview (Brief)

Below is a high-level summary; see backend code or docs for full details.

### Auth

- `POST /auth/register` – register a new user (patient/doctor).
- `POST /auth/login` – login, returns `{ token, user }`.
- `GET /auth/me` – return the current authenticated user based on the JWT.
- `POST /auth/seed-basic` – create sample users for local testing (see server README).

### Users & Doctors

- `GET /doctors` – list doctors.
- `PATCH /doctors/me` – update the current doctor’s profile.

### Appointments

- `GET /appointments` – list appointments for the current user (role-based).
- `POST /appointments` – create a new appointment.
 - `PATCH /appointments/:id/status` – update appointment status (doctor/admin) such as SCHEDULED, IN_PROGRESS, COMPLETED, etc.
 - `PATCH /appointments/:id/notes` – save or update clinical notes for an appointment (doctor only), emitting real-time updates.

### Chat

- `GET /appointments/:appointmentId/chat` – get chat history.
- `POST /appointments/:appointmentId/chat` – send message (text + optional attachment).

### Video

- `POST /agora-token` – generate a video token (requires JWT, body contains `channelName` and `uid`).

### Scheduling / Slots

- `PATCH /doctor/schedule` – save schedule config (slot duration/max patients).
- `GET /doctors/:doctorId/slots?date=YYYY-MM-DD` – get slots for a date.
- `PATCH /slots/:slotId/block` – block/unblock a slot.

### Metrics

- `GET /metrics` – patient metrics history (patients) or per patientId (doctors).
- `POST /metrics` – submit patient metrics.

### AI (Local ML)

- `POST /ai/health-risk` – local Python model risk scores (requires `python` on PATH + packages installed).

### Admin

- `PATCH /admin/doctors/:id/status` – verify/reject doctors.
- `POST /admin/clear-non-admin-users` – dev helper to reset sample data.

---

## 15. Screenshots

Add your screenshots here once available:

- Patient Dashboard:  
   `![Patient Dashboard](./docs/screenshots/patient-dashboard.png)`

- Doctor Dashboard:  
   `![Doctor Dashboard](./docs/screenshots/doctor-dashboard.png)`

- Admin Dashboard:  
   `![Admin Dashboard](./docs/screenshots/admin-dashboard.png)`

- Chat & Video Call:  
   `![Chat and Video Call](./docs/screenshots/chat-video.png)`

---

## 16. Progressive Web App (PWA)

- Install prompt and offline shell are enabled via `vite-plugin-pwa`.
- Manifest: generated at build (`dist/manifest.webmanifest`) with `display: standalone`, theme color `#e11d48`.
- Service worker: auto-update strategy, excludes Socket.IO (`NetworkOnly`) to keep real-time stable.
- Icons: PNGs generated from `public/favicon.svg` during `prebuild` (`pwa-192x192.png`, `pwa-512x512.png`, maskable, and Apple Touch 180x180).
- iOS: Safari supports Add to Home Screen; push notifications and background sync are limited by iOS policies.

Local test

```bash
cd careai
npm run build
npm run preview
```

Then open the shown URL and check DevTools → Application → Manifest and Service Workers.

Vercel

- Build will output the SW and manifest; static hosting works out-of-the-box. Ensure the app is deployed over HTTPS for PWA install prompts.

---

## 17. Future Improvements

Some ideas to enhance CareXAI:

- Full **EHR integration** (FHIR/HL7) with hospital systems.
- Role-based **fine-grained permissions** (e.g., specific data access scopes).
- More advanced AI:
   - Longitudinal risk modeling.
   - Medication adherence predictions.
   - Multi-language support and translation.
- Offline-first capabilities and mobile-native apps.
- Audit logging and monitoring integrated with external observability tools.
- Better load balancing and auto-scaling for production traffic.

---

## 18. Security & Privacy Considerations

- **Authentication & Authorization**
   - JWTs are used for API and WebSocket auth.
   - Role-based access control ensures data is only visible to authorized users.

- **Transport Security**
   - In production, always serve over HTTPS.
   - Use secure WebSocket (wss://) where supported.

- **Data Protection**
   - Store secrets in environment variables (never commit `.env` files).
   - Hash passwords (e.g., with bcrypt) before storing.
   - Limit access to sensitive health information based on user role.

- **Compliance**
   - For production/real patients, review compliance requirements (HIPAA, GDPR, etc.).
   - Implement logging, auditing, and data retention policies accordingly.

- **AI Safety**
   - Clearly communicate that AI responses are not medical diagnosis.
   - Encourage verification by a qualified clinician.

---

## 19. License

Specify your license here. For example:

```text
MIT License

Copyright (c) <year> <owner>

Permission is hereby granted, free of charge, to any person obtaining a copy
...
```

If you choose MIT, add a `LICENSE` file and update this section accordingly.

---


