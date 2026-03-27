# CareXAI Realtime Backend (Server)

This folder contains a **real backend + realtime server** for CareXAI.

- **Tech**: Node.js, Express, Socket.IO, Prisma, SQLite
- **Realtime**: Every new appointment created via the API emits an `appointment:created` event to the relevant patient, doctor, and all admins.
- **Queues**: Emits `queue:update` snapshots to patients for OPD-style queue position + delay.
- **AI (local ML)**: `POST /ai/health-risk` runs Python models from `../../handrecognition/ml_risk_cli.py`.

## Setup

```bash
cd server
cp .env.example .env
# Optionally adjust DATABASE_URL / JWT_SECRET / PORT
npm install
npx prisma migrate dev --name init
npm run dev
```

Windows shortcut:

```powershell
./start-backend.ps1
```

### Optional env vars

- `OWNER_ADMIN_EMAIL` / `OWNER_ADMIN_PASSWORD`: ensures a single owner admin account exists on startup.
- `AGORA_APP_ID` / `AGORA_APP_CERTIFICATE`: required for `POST /agora-token`.
- `ALLOWED_ORIGINS`: comma-separated frontend origins allowed by HTTP CORS + Socket.IO (example: `https://carexai.vercel.app,http://localhost:3000`).
- `GROQ_API_KEY` / `GROQ_MODEL`: required for AI consultation summary endpoint `POST /appointments/:appointmentId/ai-summary`.

### Python prerequisites (only for `/ai/health-risk`)

- Ensure `python` is available on PATH.
- Install packages: `pip install pandas joblib scikit-learn`

## Auth

- `POST /auth/seed-basic` – one-time helper to create sample users (patient, doctor, admin) with password `password123`.
- `POST /auth/login` – returns a JWT (`token`) and basic user info.
- All protected routes require `Authorization: Bearer <token>`.
- Socket.IO clients must connect with `auth: { token }`.

## Appointments

- `GET /appointments` – returns appointments filtered by the caller's role:
  - PATIENT → their appointments
  - DOCTOR → appointments where they are the doctor
  - ADMIN → all appointments
- `POST /appointments` – patient booking endpoint.
  - Body: `{ doctorId, date, time, type, consultationType }`
  - On success:
    - Saves to the database
    - Emits `appointment:created` via Socket.IO to:
      - `user:<patientId>`
      - `user:<doctorId>`
      - `role:ADMIN`

This is the first vertical slice toward making CareXAI a **true realtime system**. Next steps are to:

1. Move other data (prescriptions, consultation status, approvals, chat) into the database.
2. Emit corresponding realtime events on every write.
3. Replace the current `MockBackend` on the frontend with real API + Socket.IO client listeners.
