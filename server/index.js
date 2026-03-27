import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import AgoraAccessTokenPkg from 'agora-access-token';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const { RtcTokenBuilder, RtcRole } = AgoraAccessTokenPkg;

// Resolve repo root so we can call the Python risk models
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PYTHON_RISK_SCRIPT = path.resolve(__dirname, '../../handrecognition/ml_risk_cli.py');

const prisma = new PrismaClient();

const parseAllowedOrigins = (rawValue) => {
  const values = String(rawValue || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  return [...new Set(values)];
};

const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.length === 0) return true;
  return ALLOWED_ORIGINS.includes(origin);
};

const corsOriginOption = (origin, callback) => {
  if (isOriginAllowed(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error(`CORS blocked for origin: ${origin}`));
};

const app = express();
// Support base64 chat attachments (images/docs/videos) without hitting tiny default body limits.
app.use(express.json({ limit: '20mb' }));
app.use(cors({ origin: corsOriginOption, credentials: true }));
app.set('trust proxy', 1);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'carexai-server', timestamp: new Date().toISOString() });
});

const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOriginOption,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';

// Agora configuration
const AGORA_APP_ID = process.env.AGORA_APP_ID;
const AGORA_APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

const userSocketIds = new Map();

const markUserConnected = (userId, socketId) => {
  const ids = userSocketIds.get(userId) || new Set();
  const wasOffline = ids.size === 0;
  ids.add(socketId);
  userSocketIds.set(userId, ids);
  return wasOffline;
};

const markUserDisconnected = (userId, socketId) => {
  const ids = userSocketIds.get(userId);
  if (!ids) return true;
  ids.delete(socketId);
  if (ids.size === 0) {
    userSocketIds.delete(userId);
    return true;
  }
  userSocketIds.set(userId, ids);
  return false;
};

const isUserOnline = (userId) => {
  const ids = userSocketIds.get(userId);
  return !!ids && ids.size > 0;
};

// Single-owner admin configuration
const OWNER_ADMIN_EMAIL = process.env.OWNER_ADMIN_EMAIL || 'ddnandu3@gmail.com';
const OWNER_ADMIN_PASSWORD = process.env.OWNER_ADMIN_PASSWORD || '123456';

// Helper to shape doctor response consistently for all consumers
const shapeDoctor = (d) => {
  const totalSlots = Array.isArray(d.timeSlots) ? d.timeSlots.length : 0;
  const openSlots = Array.isArray(d.timeSlots)
    ? d.timeSlots.filter((s) => !s.isBlocked && s.bookedCount < s.maxPatients).length
    : 0;

  return {
    id: d.id,
    name: d.name,
    email: d.email,
    role: d.role,
    specialization: d.specialization || null,
    experienceYears: d.experienceYears ?? null,
    qualification: d.qualification || null,
    registrationNumber: d.registrationNumber || null,
    medicalCouncil: d.medicalCouncil || null,
    rating: d.rating ?? null,
    status: d.doctorStatus || null,
    hasSchedule: !!d.doctorSchedule,
    totalSlots,
    openSlots,
  };
};

// Helper to broadcast queue updates to all affected patients for a doctor/date
const broadcastQueueSnapshot = async (doctorId, dateStr) => {
  const appts = await prisma.appointment.findMany({
    where: {
      doctorId,
      date: dateStr,
      status: { notIn: ['CANCELLED', 'REJECTED'] },
    },
    orderBy: [{ time: 'asc' }, { tokenNumber: 'asc' }],
  });

  const now = new Date();

  for (const appt of appts) {
    const ahead = appts.filter((a) => {
      if (a.id === appt.id) return false;
      if (['CANCELLED', 'REJECTED', 'COMPLETED'].includes(a.status)) return false;
      if (a.time < appt.time) return true;
      if (a.time === appt.time) {
        const at = a.tokenNumber || 0;
        const bt = appt.tokenNumber || 0;
        return at < bt;
      }
      return false;
    }).length;

    // Rough delay estimate: how many minutes past scheduled time this appointment is
    let delayMinutes = 0;
    try {
      const scheduled = new Date(`${appt.date}T${appt.time}:00`);
      if (!Number.isNaN(scheduled.getTime()) && now > scheduled && appt.status !== 'COMPLETED') {
        delayMinutes = Math.max(0, Math.round((now.getTime() - scheduled.getTime()) / 60000));
      }
    } catch {
      delayMinutes = 0;
    }

    io.to(`user:${appt.patientId}`).emit('queue:update', {
      appointmentId: appt.id,
      doctorId: appt.doctorId,
      date: appt.date,
      tokenNumber: appt.tokenNumber || null,
      ahead,
      delayMinutes,
      status: appt.status,
    });
  }
};

// --- Auth helpers ---
const generateToken = (user) => {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' });
};

const authMiddleware = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const ensureVerifiedDoctor = async (userId) => {
  const doctor = await prisma.user.findUnique({ where: { id: userId } });
  if (!doctor || doctor.role !== 'DOCTOR') {
    return { ok: false, status: null };
  }
  const status = doctor.doctorStatus || 'PENDING';
  return { ok: status === 'VERIFIED', status };
};

const extractJsonFromModelOutput = (rawText = '') => {
  const trimmed = String(rawText || '').trim();
  const withoutFence = trimmed
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  const first = withoutFence.indexOf('{');
  const last = withoutFence.lastIndexOf('}');
  if (first >= 0 && last > first) {
    return withoutFence.slice(first, last + 1);
  }
  return withoutFence;
};

const normalizeAiSummary = (parsed) => {
  const toText = (v, fallback = '') => (typeof v === 'string' ? v.trim() : fallback);
  const points = Array.isArray(parsed?.keyDiscussionPoints)
    ? parsed.keyDiscussionPoints.map((p) => String(p || '').trim()).filter(Boolean)
    : [];

  return {
    symptoms: toText(parsed?.symptoms, 'Not clearly stated in transcript.'),
    possibleCondition: toText(parsed?.possibleCondition, 'Potential condition requires clinical evaluation.'),
    keyDiscussionPoints: points,
    recommendations: toText(parsed?.recommendations, 'Follow evidence-based care and clinician judgment.'),
    followUpInstructions: toText(parsed?.followUpInstructions, 'Monitor symptoms and schedule follow-up as needed.'),
  };
};

const generateMedicalSummaryFromTranscript = async (transcript) => {
  if (!GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is not configured on the server');
  }

  const systemPrompt = [
    'You are an assistive clinical documentation AI for telehealth.',
    'Return only valid JSON with this schema:',
    '{',
    '  "symptoms": "string",',
    '  "possibleCondition": "string",',
    '  "keyDiscussionPoints": ["string"],',
    '  "recommendations": "string",',
    '  "followUpInstructions": "string"',
    '}',
    'Rules:',
    '- Do not provide a definitive diagnosis.',
    '- Write concise and clinically neutral text.',
    '- If information is missing, state uncertainty clearly.',
    '- Never include markdown or code fences.',
  ].join('\n');

  const payload = {
    model: GROQ_MODEL,
    temperature: 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Consultation transcript:\n${transcript}`,
      },
    ],
  };

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data?.error?.message || 'Groq summarization failed';
    throw new Error(msg);
  }

  const content = data?.choices?.[0]?.message?.content || '{}';
  const jsonText = extractJsonFromModelOutput(content);
  const parsed = JSON.parse(jsonText);
  return normalizeAiSummary(parsed);
};

// --- Scheduling helpers ---
const getDefaultSchedule = () => ([
  { day: 'Mon', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Tue', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Wed', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Thu', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Fri', available: true, startTime: '09:00', endTime: '17:00' },
  { day: 'Sat', available: false, startTime: '10:00', endTime: '14:00' },
  { day: 'Sun', available: false, startTime: '10:00', endTime: '14:00' },
]);

const ensureDoctorSchedule = async (doctorId) => {
  let config = await prisma.doctorSchedule.findUnique({ where: { doctorId } });
  if (!config) {
    config = await prisma.doctorSchedule.create({
      data: {
        doctorId,
        scheduleJson: JSON.stringify(getDefaultSchedule()),
        slotDuration: 30,
        defaultMaxPatients: 1,
      },
    });
  }
  return config;
};

// Ensure exactly one owner admin account exists with the configured credentials
const ensureOwnerAdminUser = async () => {
  const passwordHash = await bcrypt.hash(OWNER_ADMIN_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: OWNER_ADMIN_EMAIL },
    update: { name: 'Owner Admin', role: 'ADMIN', passwordHash },
    create: { name: 'Owner Admin', email: OWNER_ADMIN_EMAIL, role: 'ADMIN', passwordHash },
  });

  console.log('Owner admin ensured:', OWNER_ADMIN_EMAIL);
};

const generateSlotsForDate = async (doctorId, dateStr) => {
  const config = await ensureDoctorSchedule(doctorId);
  const schedule = JSON.parse(config.scheduleJson || '[]');
  const date = new Date(dateStr);
  const dayOfWeek = date.toLocaleDateString('en-US', { weekday: 'short' });
  const daySchedule = schedule.find((d) => d.day === dayOfWeek);
  if (!daySchedule || !daySchedule.available) return [];

  const generated = [];
  const [startH, startM] = daySchedule.startTime.split(':').map(Number);
  const [endH, endM] = daySchedule.endTime.split(':').map(Number);
  const duration = config.slotDuration || 30;
  const maxPatients = config.defaultMaxPatients || 1;

  let current = new Date(date);
  current.setHours(startH, startM, 0, 0);
  const end = new Date(date);
  end.setHours(endH, endM, 0, 0);

  while (current < end) {
    const startTime = current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
    const nextTime = new Date(current.getTime() + duration * 60000);
    const endTime = nextTime.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

    const id = `${doctorId}_${dateStr}_${startTime}`;
    generated.push({
      id,
      doctorId,
      date: dateStr,
      startTime,
      endTime,
      maxPatients,
      bookedCount: 0,
      isBlocked: false,
      isEmergency: false,
    });
    current = nextTime;
  }

  const stored = await prisma.timeSlot.findMany({ where: { doctorId, date: dateStr } });
  const byId = new Map(stored.map((s) => [s.id, s]));

  return generated.map((slot) => {
    const db = byId.get(slot.id);
    if (!db) return slot;
    return {
      ...slot,
      maxPatients: db.maxPatients,
      bookedCount: db.bookedCount,
      isBlocked: db.isBlocked,
      isEmergency: db.isEmergency,
    };
  });
};

// --- HTTP routes ---

// Seed a couple of users for quick testing (NOT for production)
app.post('/auth/seed-basic', async (_req, res) => {
  const defaultPasswordHash = await bcrypt.hash('password123', 10);

  // Idempotent upserts so you can safely call this endpoint multiple times
  const patient = await prisma.user.upsert({
    where: { email: 'john@carexai.com' },
    update: { name: 'John Doe', role: 'PATIENT', passwordHash: defaultPasswordHash },
    create: { name: 'John Doe', email: 'john@carexai.com', passwordHash: defaultPasswordHash, role: 'PATIENT' },
  });

  const doctor = await prisma.user.upsert({
    where: { email: 'emily@carexai.com' },
    update: {
      name: 'Dr. Emily Chen',
      role: 'DOCTOR',
      passwordHash: defaultPasswordHash,
      specialization: 'Cardiologist',
      qualification: 'MD',
      registrationNumber: 'MED12345',
      medicalCouncil: 'Medical Council of India',
      experienceYears: 12,
      doctorStatus: 'VERIFIED',
    },
    create: {
      name: 'Dr. Emily Chen',
      email: 'emily@carexai.com',
      passwordHash: defaultPasswordHash,
      role: 'DOCTOR',
      specialization: 'Cardiologist',
      qualification: 'MD',
      registrationNumber: 'MED12345',
      medicalCouncil: 'Medical Council of India',
      experienceYears: 12,
      doctorStatus: 'VERIFIED',
    },
  });
  // Initialize default schedule for seeded doctor
  await ensureDoctorSchedule(doctor.id);

  // Admin user is managed exclusively via OWNER_ADMIN_EMAIL/OWNER_ADMIN_PASSWORD
  return res.json({ ok: true, patient, doctor });
});

// Self-service registration for patients and doctors
app.post('/auth/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      specialization,
      qualification,
      registrationNumber,
      medicalCouncil,
      experienceYears,
    } = req.body || {};

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (role !== 'PATIENT' && role !== 'DOCTOR') {
      return res.status(400).json({ error: 'Only patient and doctor self-registration is allowed' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const data = { name, email, passwordHash, role };
    if (role === 'DOCTOR') {
      data.specialization = specialization || null;
      data.qualification = qualification || null;
      data.registrationNumber = registrationNumber || null;
      data.medicalCouncil = medicalCouncil || null;
      data.experienceYears =
        typeof experienceYears === 'number'
          ? experienceYears
          : typeof experienceYears === 'string'
            ? parseInt(experienceYears, 10) || null
            : null;
      data.doctorStatus = 'PENDING';
    }

    const user = await prisma.user.create({
      data,
    });

    // Ensure a default schedule for newly registered doctors
    if (role === 'DOCTOR') {
      await ensureDoctorSchedule(user.id);
    }

    const token = generateToken(user);
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.role === 'DOCTOR' ? (user.doctorStatus || 'PENDING') : null,
      },
    });
  } catch (err) {
    console.error('Error in /auth/register', err);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  // Lock admin access to the single owner account only
  if (user.role === 'ADMIN' && user.email !== OWNER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access is restricted to the owner account.' });
  }
  const token = generateToken(user);
  return res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.role === 'DOCTOR' ? (user.doctorStatus || 'PENDING') : null,
    },
  });
});

// Return the currently authenticated user based on JWT
app.get('/auth/me', authMiddleware, async (req, res) => {
  const { id } = req.user;
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  // Enforce the same admin restriction as login
  if (user.role === 'ADMIN' && user.email !== OWNER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Admin access is restricted to the owner account.' });
  }

  return res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.role === 'DOCTOR' ? (user.doctorStatus || 'PENDING') : null,
  });
});

app.get('/presence/:userId', authMiddleware, async (req, res) => {
  const { userId } = req.params;
  return res.json({ userId, online: isUserOnline(userId) });
});

app.get('/appointments', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  let where = {};
  if (role === 'PATIENT') where = { patientId: id };
  else if (role === 'DOCTOR') where = { doctorId: id };

  const appts = await prisma.appointment.findMany({
    where,
    include: { patient: true, doctor: true },
    orderBy: { createdAt: 'asc' },
  });

  const shaped = appts.map((a) => ({
    id: a.id,
    patientId: a.patientId,
    patientName: a.patient.name,
    doctorId: a.doctorId,
    doctorName: a.doctor.name,
    date: a.date,
    time: a.time,
    status: a.status,
    type: a.type,
    consultationType: a.consultationType,
    slotId: a.slotId || null,
    tokenNumber: a.tokenNumber || null,
    symptoms: a.symptoms || null,
    notes: a.notes || null,
  }));

  res.json(shaped);
});

app.post('/appointments', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'PATIENT') return res.status(403).json({ error: 'Only patients can book' });

  const { doctorId, date, time, type, consultationType, slotId: providedSlotId, symptoms, autoShare } = req.body;
  const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.role !== 'DOCTOR') return res.status(400).json({ error: 'Invalid doctor' });

  // Prevent double booking for the same patient at the same time
  const existing = await prisma.appointment.findFirst({
    where: {
      patientId: id,
      date,
      time,
      status: { notIn: ['CANCELLED', 'REJECTED'] },
    },
  });
  if (existing) return res.status(400).json({ error: 'You already have an appointment at this time.' });

  const slotId = providedSlotId || `${doctorId}_${date}_${time}`;

  // Ensure slot exists and has capacity
  const config = await ensureDoctorSchedule(doctorId);
  let slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    slot = await prisma.timeSlot.create({
      data: {
        id: slotId,
        doctorId,
        date,
        startTime: time,
        endTime: time,
        maxPatients: config.defaultMaxPatients || 1,
        bookedCount: 0,
        isBlocked: false,
        isEmergency: false,
      },
    });
  }

  if (slot.isBlocked) return res.status(400).json({ error: 'Slot is blocked by doctor.' });
  if (slot.bookedCount >= slot.maxPatients) return res.status(400).json({ error: 'Slot is fully booked.' });

  // Atomically increment bookedCount and derive token number
  const updatedSlot = await prisma.timeSlot.update({
    where: { id: slot.id },
    data: { bookedCount: { increment: 1 } },
  });

  const tokenNumber = updatedSlot.bookedCount;

  const appt = await prisma.appointment.create({
    data: {
      patientId: id,
      doctorId,
      date,
      time,
      type,
      consultationType,
      slotId,
      tokenNumber,
      symptoms: symptoms || null,
    },
    include: { patient: true, doctor: true },
  });

  const shaped = {
    id: appt.id,
    patientId: appt.patientId,
    patientName: appt.patient.name,
    doctorId: appt.doctorId,
    doctorName: appt.doctor.name,
    date: appt.date,
    time: appt.time,
    status: appt.status,
    type: appt.type,
    consultationType: appt.consultationType,
    slotId: appt.slotId || null,
    tokenNumber: appt.tokenNumber || null,
    symptoms: appt.symptoms || null,
    notes: appt.notes || null,
  };

  // Emit real-time event to patient, doctor, and all admins
  io.to(`user:${appt.patientId}`).to(`user:${appt.doctorId}`).to('role:ADMIN').emit('appointment:created', shaped);

  // Also emit slot update for schedule grids
  io.to(`user:${appt.doctorId}`).to('role:ADMIN').emit('slot:updated', {
    id: slotId,
    doctorId,
    date,
    startTime: time,
    endTime: time,
    maxPatients: updatedSlot.maxPatients,
    bookedCount: updatedSlot.bookedCount,
    isBlocked: updatedSlot.isBlocked,
    isEmergency: updatedSlot.isEmergency,
  });

  // Broadcast updated queue positions to all patients for this doctor + date
  await broadcastQueueSnapshot(doctorId, date);

  const shapeChatMessage = (m) => ({
    id: m.id,
    appointmentId: m.appointmentId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    content: m.content,
    timestamp: m.createdAt.toISOString(),
    isRead: m.isRead,
    attachmentUrl: m.attachmentUrl || undefined,
    attachmentType: m.attachmentType || undefined,
  });

  if (autoShare && typeof autoShare === 'object') {
    const currentVitals = autoShare.currentVitals && typeof autoShare.currentVitals === 'object'
      ? autoShare.currentVitals
      : {};
    const riskSummary = autoShare.riskSummary && typeof autoShare.riskSummary === 'object'
      ? autoShare.riskSummary
      : {};
    const healthPassport = autoShare.healthPassport && typeof autoShare.healthPassport === 'object'
      ? autoShare.healthPassport
      : {};
    const vitalsTrend = Array.isArray(autoShare.vitalsTrend) ? autoShare.vitalsTrend.slice(-5) : [];
    const documents = Array.isArray(autoShare.documents) ? autoShare.documents.slice(0, 10) : [];

    const summaryLines = [
      'AUTO-SHARED PATIENT SNAPSHOT',
      `Booked appointment: ${date} ${time}`,
      `Blood Group: ${healthPassport.bloodGroup || 'N/A'}`,
      `Clinical Summary: ${healthPassport.clinicalSummary || 'Not provided'}`,
      'Latest Vitals:',
      `- BP: ${currentVitals.systolicBP || '--'}/${currentVitals.diastolicBP || '--'} mmHg`,
      `- Glucose: ${currentVitals.glucose || '--'} mg/dL`,
      `- BMI: ${currentVitals.bmi || '--'}`,
      `- Cholesterol: ${currentVitals.cholesterol || '--'} mg/dL`,
      'Risk Summary:',
      `- Diabetes Risk: ${typeof riskSummary.diabetesRisk === 'number' ? riskSummary.diabetesRisk + '%' : 'N/A'}`,
      `- Hypertension Risk: ${typeof riskSummary.hypertensionRisk === 'number' ? riskSummary.hypertensionRisk + '%' : 'N/A'}`,
      `- Heart Disease Risk: ${typeof riskSummary.heartDiseaseRisk === 'number' ? riskSummary.heartDiseaseRisk + '%' : 'N/A'}`,
      `Vitals Trend Points Shared: ${vitalsTrend.length}`,
      `Documents Shared: ${documents.length}`,
    ];

    const summaryMessage = await prisma.chatMessage.create({
      data: {
        appointment: { connect: { id: appt.id } },
        sender: { connect: { id: appt.patientId } },
        receiver: { connect: { id: appt.doctorId } },
        senderRole: 'PATIENT',
        content: summaryLines.join('\n'),
      },
    });

    io
      .to(`user:${appt.patientId}`)
      .to(`user:${appt.doctorId}`)
      .to('role:ADMIN')
      .emit('chat:message', shapeChatMessage(summaryMessage));

    for (const doc of documents) {
      const docName = doc && doc.name ? String(doc.name) : 'Unnamed document';
      const docType = doc && doc.type ? String(doc.type) : 'unknown';
      const docDate = doc && doc.date ? String(doc.date) : 'unknown date';
      const docCategory = doc && doc.category ? String(doc.category) : 'General';
      const docUrl = doc && typeof doc.url === 'string' ? doc.url : '';
      const canAttachUrl = /^data:|^https?:\/\//i.test(docUrl);
      const attachmentType = /^data:image\//i.test(docUrl)
        ? 'image'
        : /^data:video\//i.test(docUrl)
          ? 'video'
          : /^data:application\/pdf/i.test(docUrl)
            ? 'pdf'
            : 'file';

      const docMessage = await prisma.chatMessage.create({
        data: {
          appointment: { connect: { id: appt.id } },
          sender: { connect: { id: appt.patientId } },
          receiver: { connect: { id: appt.doctorId } },
          senderRole: 'PATIENT',
          content: `DOCUMENT SHARED: ${docName} | Type: ${docType} | Category: ${docCategory} | Date: ${docDate}`,
          attachmentUrl: canAttachUrl ? docUrl : null,
          attachmentType: canAttachUrl ? attachmentType : null,
        },
      });

      io
        .to(`user:${appt.patientId}`)
        .to(`user:${appt.doctorId}`)
        .to('role:ADMIN')
        .emit('chat:message', shapeChatMessage(docMessage));
    }
  }

  res.status(201).json(shaped);
});

// Update appointment status (e.g. doctor marks consultation started/completed)
app.patch('/appointments/:id/status', authMiddleware, async (req, res) => {
  const { id: userId, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(userId);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { status } = req.body || {};

  if (!status || !['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'PENDING', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  // Only the owning doctor can mark status changes for their appointments
  if (role !== 'DOCTOR' || appt.doctorId !== userId) {
    return res.status(403).json({ error: 'Only the assigned doctor can update status' });
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: { status },
    include: { patient: true, doctor: true },
  });

  const shaped = {
    id: updated.id,
    patientId: updated.patientId,
    patientName: updated.patient.name,
    doctorId: updated.doctorId,
    doctorName: updated.doctor.name,
    date: updated.date,
    time: updated.time,
    status: updated.status,
    type: updated.type,
    consultationType: updated.consultationType,
    slotId: updated.slotId || null,
    tokenNumber: updated.tokenNumber || null,
    symptoms: updated.symptoms || null,
    notes: updated.notes || null,
  };

  // Notify patient, doctor, and admins about status change
  io.to(`user:${updated.patientId}`).to(`user:${updated.doctorId}`).to('role:ADMIN').emit('appointment:updated', shaped);

  // Recompute queue positions for this doctor/date and notify all affected patients
  await broadcastQueueSnapshot(updated.doctorId, updated.date);

  return res.json(shaped);
});

// Save or update doctor consultation notes for an appointment
app.patch('/appointments/:id/notes', authMiddleware, async (req, res) => {
  const { id: userId, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(userId);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { notes } = req.body || {};

  const appt = await prisma.appointment.findUnique({ where: { id: req.params.id } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  // Only the assigned doctor can write notes for this appointment
  if (role !== 'DOCTOR' || appt.doctorId !== userId) {
    return res.status(403).json({ error: 'Only the assigned doctor can update notes' });
  }

  const updated = await prisma.appointment.update({
    where: { id: appt.id },
    data: { notes: typeof notes === 'string' ? notes : null },
    include: { patient: true, doctor: true },
  });

  const shaped = {
    id: updated.id,
    patientId: updated.patientId,
    patientName: updated.patient.name,
    doctorId: updated.doctorId,
    doctorName: updated.doctor.name,
    date: updated.date,
    time: updated.time,
    status: updated.status,
    type: updated.type,
    consultationType: updated.consultationType,
    slotId: updated.slotId || null,
    tokenNumber: updated.tokenNumber || null,
    symptoms: updated.symptoms || null,
    notes: updated.notes || null,
  };

  // Notify both doctor and patient (and admins) so UIs update in real-time
  io.to(`user:${updated.patientId}`).to(`user:${updated.doctorId}`).to('role:ADMIN').emit('appointment:updated', shaped);

  return res.json(shaped);
});

// Doctor schedule configuration
app.patch('/doctor/schedule', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') return res.status(403).json({ error: 'Only doctors can update schedule' });

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const { schedule, slotDuration, maxPatients } = req.body;
  if (!Array.isArray(schedule)) return res.status(400).json({ error: 'schedule must be an array' });

  const config = await ensureDoctorSchedule(id);
  const updated = await prisma.doctorSchedule.update({
    where: { id: config.id },
    data: {
      scheduleJson: JSON.stringify(schedule),
      slotDuration: typeof slotDuration === 'number' ? slotDuration : config.slotDuration,
      defaultMaxPatients: typeof maxPatients === 'number' ? maxPatients : config.defaultMaxPatients,
    },
  });

  return res.json({
    doctorId: updated.doctorId,
    schedule: JSON.parse(updated.scheduleJson),
    slotDuration: updated.slotDuration,
    maxPatients: updated.defaultMaxPatients,
  });
});

// List all doctors for patient booking and dashboards
app.get('/doctors', authMiddleware, async (_req, res) => {
  const doctors = await prisma.user.findMany({
    where: { role: 'DOCTOR' },
    orderBy: { name: 'asc' },
    include: {
      doctorSchedule: true,
      timeSlots: true,
    },
  });

  const shaped = doctors.map(shapeDoctor);

  res.json(shaped);
});

// Allow doctors to update their own profile metadata
app.patch('/doctors/me', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Only doctors can update their profile' });
  }

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const {
    specialization,
    qualification,
    registrationNumber,
    medicalCouncil,
    experienceYears,
  } = req.body || {};

  const data = {};
  if (typeof specialization !== 'undefined') data.specialization = specialization || null;
  if (typeof qualification !== 'undefined') data.qualification = qualification || null;
  if (typeof registrationNumber !== 'undefined') data.registrationNumber = registrationNumber || null;
  if (typeof medicalCouncil !== 'undefined') data.medicalCouncil = medicalCouncil || null;
  if (typeof experienceYears !== 'undefined') {
    if (typeof experienceYears === 'number') data.experienceYears = experienceYears;
    else if (typeof experienceYears === 'string') {
      const parsed = parseInt(experienceYears, 10);
      data.experienceYears = Number.isNaN(parsed) ? null : parsed;
    } else {
      data.experienceYears = null;
    }
  }

  try {
    const updated = await prisma.user.update({
      where: { id },
      data,
      include: {
        doctorSchedule: true,
        timeSlots: true,
      },
    });

    const shaped = shapeDoctor(updated);

    // Broadcast to all connected clients so dashboards stay in sync
    io.emit('doctor:updated', shaped);

    return res.json(shaped);
  } catch (err) {
    console.error('Error in /doctors/me', err);
    return res.status(500).json({ error: 'Failed to update doctor profile' });
  }
});

// Slots for a doctor + date
app.get('/doctors/:doctorId/slots', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { doctorId } = req.params;
  const { date } = req.query;
  if (!date || typeof date !== 'string') return res.status(400).json({ error: 'Missing date' });

  const doctor = await prisma.user.findUnique({ where: { id: doctorId } });
  if (!doctor || doctor.role !== 'DOCTOR') return res.status(404).json({ error: 'Doctor not found' });

  const slots = await generateSlotsForDate(doctorId, date);
  res.json(slots);
});

// Block/unblock a specific slot
app.patch('/slots/:slotId/block', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') return res.status(403).json({ error: 'Only doctors can block slots' });

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const { slotId } = req.params;
  const { blocked } = req.body;
  if (typeof blocked !== 'boolean') return res.status(400).json({ error: 'blocked must be boolean' });

  const parts = slotId.split('_');
  if (parts[0] !== id) return res.status(403).json({ error: 'Cannot modify another doctor\'s slot' });

  const doctorId = parts[0];
  const date = parts[1];
  const time = parts[2];

  const config = await ensureDoctorSchedule(doctorId);
  let slot = await prisma.timeSlot.findUnique({ where: { id: slotId } });
  if (!slot) {
    slot = await prisma.timeSlot.create({
      data: {
        id: slotId,
        doctorId,
        date,
        startTime: time,
        endTime: time,
        maxPatients: config.defaultMaxPatients || 1,
        bookedCount: 0,
        isBlocked: blocked,
        isEmergency: false,
      },
    });
  } else {
    slot = await prisma.timeSlot.update({ where: { id: slotId }, data: { isBlocked: blocked } });
  }

  const shaped = {
    id: slot.id,
    doctorId: slot.doctorId,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    maxPatients: slot.maxPatients,
    bookedCount: slot.bookedCount,
    isBlocked: slot.isBlocked,
    isEmergency: slot.isEmergency,
  };

  io.to(`user:${doctorId}`).to('role:ADMIN').emit('slot:updated', shaped);

  res.json(shaped);
});

// Patient metrics (vitals history)
app.get('/metrics', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { patientId } = req.query;

  let targetId = id;
  if (role === 'DOCTOR' && typeof patientId === 'string') {
    // For now, allow doctors to fetch metrics for a given patientId; fine-tune ACL later.
    targetId = patientId;
  } else if (role !== 'PATIENT') {
    return res.status(403).json({ error: 'Only patients or doctors can view metrics' });
  }

  const rows = await prisma.healthMetric.findMany({
    where: { patientId: targetId },
    orderBy: { createdAt: 'asc' },
  });

  const metrics = rows.map((r) => {
    try {
      return JSON.parse(r.metricsJson);
    } catch {
      return null;
    }
  }).filter(Boolean);

  res.json(metrics);
});

app.post('/metrics', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'PATIENT') return res.status(403).json({ error: 'Only patients can submit metrics' });

  const metrics = req.body;
  if (!metrics || typeof metrics !== 'object') return res.status(400).json({ error: 'Invalid metrics payload' });

  await prisma.healthMetric.create({
    data: {
      patientId: id,
      metricsJson: JSON.stringify(metrics),
    },
  });

  res.status(201).json({ ok: true });
});

// --- AI health risk prediction using local Python models ---
app.post('/ai/health-risk', authMiddleware, async (req, res) => {
  const { role } = req.user;
  if (role !== 'PATIENT') {
    return res.status(403).json({ error: 'Only patients can analyze their health risks' });
  }

  const { metrics, age, gender } = req.body || {};
  const safeMetrics = metrics && typeof metrics === 'object' ? metrics : {};

  const payload = {
    age: Number(age) || 0,
    glucose: Number(safeMetrics.glucose) || 0,
    bmi: Number(safeMetrics.bmi) || 0,
    bp: Number(safeMetrics.systolicBP) || 0,
    cholesterol: Number(safeMetrics.cholesterol) || 0,
    // Optional fields – default to 0 if not provided
    thalach: Number(safeMetrics.maxHeartRate || 0),
    oldpeak: Number(safeMetrics.stDepression || 0),
  };

  // Spawn Python process that wraps the trained ML models
  const py = spawn('python', [PYTHON_RISK_SCRIPT]);

  let stdout = '';
  let stderr = '';

  py.stdout.on('data', (data) => {
    stdout += data.toString();
  });

  py.stderr.on('data', (data) => {
    stderr += data.toString();
  });

  py.on('error', (err) => {
    console.error('Failed to start Python risk script', err);
  });

  py.on('close', (code) => {
    if (code !== 0) {
      console.error('Python risk script exited with code', code, stderr);
      return res.status(500).json({ error: 'Risk model failed', details: stderr.trim() });
    }

    try {
      const parsed = JSON.parse(stdout || '{}');
      const diabetesProb = Number(parsed.diabetes_risk) || 0;
      const heartProb = Number(parsed.heart_risk) || 0;
      const hyperProb = Number(parsed.hyper_risk) || 0;

      const toPercent = (p) => Math.round(Math.max(0, Math.min(1, p)) * 100);

      const riskLevelFromProb = (p) => {
        if (p > 0.7) return 'High';
        if (p > 0.5) return 'Moderate';
        return 'Low';
      };

      const buildPrediction = (condition, prob) => {
        const riskLevel = riskLevelFromProb(prob);
        const probPct = toPercent(prob);

        let recommendation = 'Maintain regular check-ups and a healthy lifestyle.';
        if (riskLevel === 'High') {
          recommendation = 'Consult a specialist promptly and consider further diagnostic tests.';
        } else if (riskLevel === 'Moderate') {
          recommendation = 'Schedule a clinical review soon and monitor vitals more frequently.';
        }

        return {
          condition,
          probability: probPct,
          riskLevel,
          confidenceScore: 90,
          topFactors: [],
          recommendation,
        };
      };

      const predictions = [
        buildPrediction('Diabetes', diabetesProb),
        buildPrediction('Heart Disease', heartProb),
        buildPrediction('Hypertension', hyperProb),
      ];

      const result = {
        predictions,
        diabetesRisk: toPercent(diabetesProb),
        hypertensionRisk: toPercent(hyperProb),
        heartDiseaseRisk: toPercent(heartProb),
        ckdRiskLevel: 'Low',
        strokeRiskScore: 0,
        thyroidAnalysis: '',
        keyFactors: [],
        explanation:
          'Risk scores generated from local machine-learning models using blood pressure, glucose, BMI, cholesterol and age.',
        lifestyleRecommendations: [
          'Maintain a balanced diet rich in vegetables and low in processed sugar.',
          'Exercise at least 150 minutes per week as tolerated.',
          'Monitor blood pressure and glucose regularly and follow up with your clinician.',
        ],
        confidenceLevel: 'High',
        confidenceReason:
          'Models are trained on structured clinical datasets but should not replace professional medical judgment.',
        confidenceImprovement:
          'Provide the latest lab values and follow-up measurements to further improve risk estimation accuracy.',
        timestamp: new Date().toISOString(),
      };

      return res.json(result);
    } catch (err) {
      console.error('Failed to parse Python risk output', err, stdout);
      return res.status(500).json({ error: 'Invalid output from risk model' });
    }
  });

  py.stdin.write(JSON.stringify(payload));
  py.stdin.end();
});

// --- Chat messages ---
app.get('/appointments/:appointmentId/chat', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { appointmentId } = req.params;

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  // Access control: only participants or admin can view chat
  if (
    role !== 'ADMIN' &&
    !(role === 'PATIENT' && appt.patientId === id) &&
    !(role === 'DOCTOR' && appt.doctorId === id)
  ) {
    return res.status(403).json({ error: 'Chat access denied' });
  }

  const rows = await prisma.chatMessage.findMany({
    where: { appointmentId },
    orderBy: { createdAt: 'asc' },
  });

  const messages = rows.map((m) => ({
    id: m.id,
    appointmentId: m.appointmentId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    content: m.content,
    timestamp: m.createdAt.toISOString(),
    isRead: m.isRead,
    attachmentUrl: m.attachmentUrl || undefined,
    attachmentType: m.attachmentType || undefined,
  }));

  res.json(messages);
});

app.post('/appointments/:appointmentId/chat', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { appointmentId } = req.params;
  const { content, attachmentUrl, attachmentType } = req.body || {};

  if (!content && !attachmentUrl) {
    return res.status(400).json({ error: 'Message content or attachment required' });
  }

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  // Access control: only participants or admin can send chat
  if (
    role !== 'ADMIN' &&
    !(role === 'PATIENT' && appt.patientId === id) &&
    !(role === 'DOCTOR' && appt.doctorId === id)
  ) {
    return res.status(403).json({ error: 'Chat access denied' });
  }

  // ChatMessage schema requires explicit sender/receiver relations.
  const receiverId =
    id === appt.patientId
      ? appt.doctorId
      : id === appt.doctorId
        ? appt.patientId
        : appt.patientId;

  const msg = await prisma.chatMessage.create({
    data: {
      appointment: { connect: { id: appointmentId } },
      sender: { connect: { id } },
      receiver: { connect: { id: receiverId } },
      senderRole: role,
      content: typeof content === 'string' ? content : '',
      attachmentUrl: attachmentUrl || null,
      attachmentType: attachmentType || null,
    },
  });

  const shaped = {
    id: msg.id,
    appointmentId: msg.appointmentId,
    senderId: msg.senderId,
    senderRole: msg.senderRole,
    content: msg.content,
    timestamp: msg.createdAt.toISOString(),
    isRead: msg.isRead,
    attachmentUrl: msg.attachmentUrl || undefined,
    attachmentType: msg.attachmentType || undefined,
  };

  // Emit real-time chat event to patient, doctor, and admins
  io
    .to(`user:${appt.patientId}`)
    .to(`user:${appt.doctorId}`)
    .to('role:ADMIN')
    .emit('chat:message', shaped);

  res.status(201).json(shaped);
});

const shapeConsultationSummary = (row) => ({
  id: row.id,
  appointmentId: row.appointmentId,
  patientId: row.patientId,
  doctorId: row.doctorId,
  transcript: row.transcript,
  symptoms: row.symptoms,
  possibleCondition: row.possibleCondition,
  keyDiscussionPoints: JSON.parse(row.keyDiscussionPoints || '[]'),
  recommendations: row.recommendations,
  followUpInstructions: row.followUpInstructions,
  disclaimer: row.disclaimer || undefined,
  createdAt: row.createdAt.toISOString(),
});

app.post('/appointments/:appointmentId/ai-summary', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Only doctors can generate consultation summaries' });
  }

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const { appointmentId } = req.params;
  const { transcript } = req.body || {};

  if (typeof transcript !== 'string' || transcript.trim().length < 20) {
    return res.status(400).json({ error: 'Transcript is required and must be at least 20 characters' });
  }

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  if (appt.doctorId !== id) {
    return res.status(403).json({ error: 'Only the assigned doctor can generate this summary' });
  }

  try {
    const aiSummary = await generateMedicalSummaryFromTranscript(transcript.trim());

    const created = await prisma.consultationSummary.create({
      data: {
        appointment: { connect: { id: appt.id } },
        patient: { connect: { id: appt.patientId } },
        doctor: { connect: { id: appt.doctorId } },
        transcript: transcript.trim(),
        symptoms: aiSummary.symptoms,
        possibleCondition: aiSummary.possibleCondition,
        keyDiscussionPoints: JSON.stringify(aiSummary.keyDiscussionPoints || []),
        recommendations: aiSummary.recommendations,
        followUpInstructions: aiSummary.followUpInstructions,
        rawJson: JSON.stringify(aiSummary),
        disclaimer: 'AI-generated assistive summary only. Not a medical diagnosis.',
      },
    });

    return res.status(201).json(shapeConsultationSummary(created));
  } catch (err) {
    console.error('Failed to generate AI consultation summary', err);
    return res.status(500).json({ error: err?.message || 'Failed to generate consultation summary' });
  }
});

app.get('/appointments/:appointmentId/ai-summaries', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { appointmentId } = req.params;
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });

  const canAccess =
    role === 'ADMIN' ||
    (role === 'DOCTOR' && appt.doctorId === id) ||
    (role === 'PATIENT' && appt.patientId === id);

  if (!canAccess) {
    return res.status(403).json({ error: 'Summary access denied' });
  }

  const rows = await prisma.consultationSummary.findMany({
    where: { appointmentId },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(rows.map(shapeConsultationSummary));
});

app.get('/patients/:patientId/ai-summaries', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') {
    return res.status(403).json({ error: 'Only doctors can view patient consultation summaries' });
  }

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const { patientId } = req.params;
  const rawLimit = Number(req.query.limit);
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(50, rawLimit)) : 10;

  const hasRelationship = await prisma.appointment.findFirst({
    where: {
      doctorId: id,
      patientId,
    },
    select: { id: true },
  });

  if (!hasRelationship) {
    return res.status(403).json({ error: 'No appointment relationship with this patient' });
  }

  const rows = await prisma.consultationSummary.findMany({
    where: {
      doctorId: id,
      patientId,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return res.json(rows.map(shapeConsultationSummary));
});

// --- Admin maintenance utilities ---
// Clear all non-admin users and their related data (appointments, metrics, schedules, slots, chat).
// This is protected so that only the owner admin account can trigger it.
app.post('/admin/clear-non-admin-users', authMiddleware, async (req, res) => {
  const { id, role } = req.user;

  // Only allow the configured owner admin to perform this destructive action
  if (role !== 'ADMIN') return res.status(403).json({ error: 'Admin access required' });

  const adminUser = await prisma.user.findUnique({ where: { id } });
  if (!adminUser || adminUser.email !== OWNER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Only the owner admin can clear users' });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete dependent data first to satisfy foreign key constraints
      await tx.consultationSummary.deleteMany({});
      await tx.chatMessage.deleteMany({});
      await tx.healthMetric.deleteMany({});
      await tx.appointment.deleteMany({});
      await tx.timeSlot.deleteMany({});
      await tx.doctorSchedule.deleteMany({});

      // Finally delete all non-admin users
      await tx.user.deleteMany({ where: { role: { not: 'ADMIN' } } });
    });

    res.json({ ok: true, message: 'All non-admin users and related data have been cleared.' });
  } catch (err) {
    console.error('Error clearing non-admin users', err);
    res.status(500).json({ error: 'Failed to clear non-admin users' });
  }
});

// Update a doctor's verification status (PENDING/VERIFIED/REJECTED)
app.patch('/admin/doctors/:id/status', authMiddleware, async (req, res) => {
  const { id: adminId, role } = req.user;
  if (role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const adminUser = await prisma.user.findUnique({ where: { id: adminId } });
  if (!adminUser || adminUser.email !== OWNER_ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Only the owner admin can update doctor status' });
  }

  const { status } = req.body || {};
  if (!status || !['PENDING', 'VERIFIED', 'REJECTED'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status value' });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: { doctorStatus: status },
      include: {
        doctorSchedule: true,
        timeSlots: true,
      },
    });

    const shaped = shapeDoctor(updated);
    io.emit('doctor:updated', shaped);

    return res.json(shaped);
  } catch (err) {
    console.error('Error updating doctor status', err);
    return res.status(500).json({ error: 'Failed to update doctor status' });
  }
});

// --- Agora token generation endpoint ---
app.post('/agora-token', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role === 'DOCTOR') {
    const verification = await ensureVerifiedDoctor(id);
    if (!verification.ok) {
      return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
    }
  }

  const { channelName, uid } = req.body;

  if (!AGORA_APP_ID || !AGORA_APP_CERTIFICATE) {
    return res.status(400).json({ error: 'Agora credentials not configured' });
  }

  if (!channelName || uid === undefined) {
    return res.status(400).json({ error: 'channelName and uid are required' });
  }

  try {
    // Generate token using the correct method
    const expirationTimeInSeconds = 3600; // 1 hour
    const currentTimeInSeconds = Math.floor(Date.now() / 1000);
    const privilegeExpireTs = currentTimeInSeconds + expirationTimeInSeconds;

    const token = RtcTokenBuilder.buildTokenWithUid(
      AGORA_APP_ID,
      AGORA_APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpireTs
    );

    console.log('Generated Agora token for channel:', channelName, 'uid:', uid);
    res.json({ token });
  } catch (err) {
    console.error('Error generating Agora token:', err);
    res.status(500).json({ error: 'Failed to generate token', details: err.message });
  }
});

// --- Socket.IO auth ---
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Unauthorized'));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    return next();
  } catch {
    return next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  const { id, role } = socket.user;
  socket.join(`user:${id}`);
  socket.join(`role:${role}`);

  const becameOnline = markUserConnected(id, socket.id);
  if (becameOnline) {
    io.emit('presence:update', { userId: id, online: true });
  }

  socket.on('chat:typing', async (payload = {}) => {
    const { appointmentId, isTyping } = payload || {};
    if (typeof appointmentId !== 'string' || typeof isTyping !== 'boolean') return;

    try {
      const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
      if (!appt) return;

      const canChat =
        role === 'ADMIN' ||
        (role === 'PATIENT' && appt.patientId === id) ||
        (role === 'DOCTOR' && appt.doctorId === id);

      if (!canChat) return;

      io
        .to(`user:${appt.patientId}`)
        .to(`user:${appt.doctorId}`)
        .to('role:ADMIN')
        .emit('chat:typing', {
          appointmentId,
          senderId: id,
          isTyping,
        });
    } catch (err) {
      console.error('Failed to process typing event', err);
    }
  });

  socket.on('disconnect', () => {
    const becameOffline = markUserDisconnected(id, socket.id);
    if (becameOffline) {
      io.emit('presence:update', { userId: id, online: false });
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`CareXAI realtime server listening on http://localhost:${PORT}`);
  // Ensure the single owner admin user exists on startup
  ensureOwnerAdminUser().catch((err) => {
    console.error('Failed to ensure owner admin user', err);
  });
});
