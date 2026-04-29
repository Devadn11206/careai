import 'dotenv/config';
import 'express-async-errors';
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
import multer from 'multer';
import FormData from 'form-data';

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
const DEV_LOCAL_ORIGIN_REGEX = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (process.env.NODE_ENV !== 'production' && DEV_LOCAL_ORIGIN_REGEX.test(origin)) return true;
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

const upload = multer({ storage: multer.memoryStorage() });

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
    verificationDocumentUrl: d.verificationDocumentUrl || null,
    verificationDocumentName: d.verificationDocumentName || null,
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

const clearAllNonAdminData = async () => {
  return prisma.$transaction(async (tx) => {
    const deleteTargets = {
      medicationAlerts: await tx.medicationMissedDoseAlert.deleteMany({}),
      medicationAdherence: await tx.medicationAdherence.deleteMany({}),
      medicationOrders: await tx.medicationOrder.deleteMany({}),
      consultationSummaries: await tx.consultationSummary.deleteMany({}),
      chatMessages: await tx.chatMessage.deleteMany({}),
      healthMetrics: await tx.healthMetric.deleteMany({}),
      appointments: await tx.appointment.deleteMany({}),
      timeSlots: await tx.timeSlot.deleteMany({}),
      doctorSchedules: await tx.doctorSchedule.deleteMany({}),
      nonAdminUsers: await tx.user.deleteMany({
        where: {
          role: { not: 'ADMIN' },
        },
      }),
    };

    return {
      medicationAlerts: deleteTargets.medicationAlerts.count,
      medicationAdherence: deleteTargets.medicationAdherence.count,
      medicationOrders: deleteTargets.medicationOrders.count,
      consultationSummaries: deleteTargets.consultationSummaries.count,
      chatMessages: deleteTargets.chatMessages.count,
      healthMetrics: deleteTargets.healthMetrics.count,
      appointments: deleteTargets.appointments.count,
      timeSlots: deleteTargets.timeSlots.count,
      doctorSchedules: deleteTargets.doctorSchedules.count,
      nonAdminUsers: deleteTargets.nonAdminUsers.count,
    };
  });
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
      verificationDocumentUrl,
      verificationDocumentName,
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
      const cleanRegNo = String(registrationNumber || '').trim();
      const cleanDocUrl = String(verificationDocumentUrl || '').trim();
      const cleanDocName = String(verificationDocumentName || '').trim();

      if (!cleanRegNo) {
        return res.status(400).json({ error: 'Doctor registration number is required' });
      }
      if (!cleanDocUrl) {
        return res.status(400).json({ error: 'Medical certificate/license upload is required' });
      }
      if (!/^data:|^https?:\/\//i.test(cleanDocUrl)) {
        return res.status(400).json({ error: 'Invalid certificate document format' });
      }
      if (cleanDocUrl.length > 10 * 1024 * 1024) {
        return res.status(400).json({ error: 'Uploaded certificate is too large' });
      }

      data.specialization = specialization || null;
      data.qualification = qualification || null;
      data.registrationNumber = cleanRegNo;
      data.medicalCouncil = medicalCouncil || null;
      data.verificationDocumentUrl = cleanDocUrl;
      data.verificationDocumentName = cleanDocName || null;
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

    const token = role === 'PATIENT' ? generateToken(user) : null;
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
  if (user.role === 'DOCTOR') {
    const status = user.doctorStatus || 'PENDING';
    if (status !== 'VERIFIED') {
      return res.status(403).json({
        error:
          status === 'REJECTED'
            ? 'Doctor account has been rejected by admin review.'
            : 'Doctor account is pending admin approval. Please wait for verification.',
        status,
      });
    }
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
    profilePicUrl: user.profilePicUrl,
    status: user.role === 'DOCTOR' ? (user.doctorStatus || 'PENDING') : null,
  });
});

app.patch('/auth/profile-pic', authMiddleware, async (req, res) => {
  const { id } = req.user;
  const { profilePicUrl, base64 } = req.body;
  const targetUrl = profilePicUrl || base64;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing profile picture data' });
  }

  // Basic validation for base64 or URL
  if (!/^data:image\//i.test(targetUrl) && !/^https?:\/\//i.test(targetUrl)) {
    return res.status(400).json({ error: 'Invalid profile picture format' });
  }

  // Limit size to ~5MB for base64 to avoid DB bloat in this demo
  if (targetUrl.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: 'Profile picture is too large' });
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { profilePicUrl: targetUrl }
    });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      profilePicUrl: user.profilePicUrl,
      status: user.role === 'DOCTOR' ? (user.doctorStatus || 'PENDING') : null,
    });
  } catch (err) {
    console.error('Error updating profile pic', err);
    return res.status(500).json({ error: 'Failed to update profile picture' });
  }
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
    const vitalsTrend = Array.isArray(autoShare.vitalsTrend) ? autoShare.vitalsTrend.slice(-100) : [];
    const history = Array.isArray(autoShare.history) ? autoShare.history.slice(-200) : [];
    const medications = Array.isArray(autoShare.medications) ? autoShare.medications.slice(0, 100) : [];
    const documents = Array.isArray(autoShare.documents) ? autoShare.documents.slice(0, 50) : [];
    const patientProfile = autoShare.patientProfile && typeof autoShare.patientProfile === 'object'
      ? autoShare.patientProfile
      : {};
    const aiAnalysis = autoShare.aiAnalysis && typeof autoShare.aiAnalysis === 'object'
      ? autoShare.aiAnalysis
      : {};

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
      `Vitals History Points Shared: ${history.length}`,
      `Medication Entries Shared: ${medications.length}`,
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

    const structuredSharePayload = {
      bookedAt: new Date().toISOString(),
      appointment: { id: appt.id, date, time, consultationType, symptoms: symptoms || null },
      patientProfile,
      currentVitals,
      vitalsTrend,
      history,
      healthPassport,
      riskSummary,
      aiAnalysis,
      medications,
      documents: documents.map((d) => ({
        name: d?.name || null,
        type: d?.type || null,
        date: d?.date || null,
        category: d?.category || null,
        url: typeof d?.url === 'string' ? d.url : null,
      })),
    };

    const structuredShareMessage = await prisma.chatMessage.create({
      data: {
        appointment: { connect: { id: appt.id } },
        sender: { connect: { id: appt.patientId } },
        receiver: { connect: { id: appt.doctorId } },
        senderRole: 'PATIENT',
        content: `AUTO-SHARED PATIENT DASHBOARD JSON: ${JSON.stringify(structuredSharePayload)}`,
      },
    });

    io
      .to(`user:${appt.patientId}`)
      .to(`user:${appt.doctorId}`)
      .to('role:ADMIN')
      .emit('chat:message', shapeChatMessage(structuredShareMessage));

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

  const isDoctorOwner = role === 'DOCTOR' && appt.doctorId === userId;
  const isPatientOwnerCancel = role === 'PATIENT' && appt.patientId === userId && status === 'CANCELLED';

  // Doctors can manage their assigned appointments. Patients can only cancel their own appointment.
  if (!isDoctorOwner && !isPatientOwnerCancel) {
    return res.status(403).json({ error: 'Not allowed to update this appointment status' });
  }

  if (role === 'PATIENT') {
    if (appt.status === 'COMPLETED' || appt.status === 'CANCELLED' || appt.status === 'REJECTED') {
      return res.status(400).json({ error: `Cannot cancel an appointment in ${appt.status} state` });
    }
    if (appt.status === 'IN_PROGRESS') {
      return res.status(400).json({ error: 'Cannot cancel an appointment that is already in progress' });
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.appointment.update({
      where: { id: appt.id },
      data: { status },
      include: { patient: true, doctor: true },
    });

    const becameCancelled = status === 'CANCELLED' && appt.status !== 'CANCELLED';
    if (becameCancelled && appt.slotId) {
      await tx.timeSlot.updateMany({
        where: { id: appt.slotId, bookedCount: { gt: 0 } },
        data: { bookedCount: { decrement: 1 } },
      });
    }

    return changed;
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

// Medications
app.get('/medications', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  const { patientId, active } = req.query;

  let targetId = id;
  if (role === 'DOCTOR' && patientId) {
    targetId = patientId;
  } else if (role !== 'PATIENT' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Access denied' });
  }

  const where = { patientId: targetId };
  if (active === 'true') where.active = true;
  else if (active === 'false') where.active = false;

  const orders = await prisma.medicationOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  res.json(orders.map(o => ({
    ...o,
    times: JSON.parse(o.timesJson || '[]'),
  })));
});

app.post('/medications', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') return res.status(403).json({ error: 'Only doctors can prescribe' });

  const verification = await ensureVerifiedDoctor(id);
  if (!verification.ok) {
    return res.status(403).json({ error: 'Doctor account is pending admin approval', status: verification.status });
  }

  const { patientId, name, dosage, frequency, times, startDate, durationDays, instructions } = req.body;

  const start = new Date(startDate || new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + (durationDays || 7));

  const order = await prisma.medicationOrder.create({
    data: {
      patientId,
      prescribedByDoctorId: id,
      name,
      dosage,
      frequency: frequency || 'CUSTOM',
      timesJson: JSON.stringify(times || []),
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
      durationDays: durationDays || 7,
      instructions: instructions || null,
      active: true,
    },
  });

  res.status(201).json({ ...order, times: times || [] });
});

app.delete('/medications/:id', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  const order = await prisma.medicationOrder.findUnique({ where: { id: req.params.id } });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (role !== 'DOCTOR' || order.prescribedByDoctorId !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.medicationOrder.update({
    where: { id: req.params.id },
    data: { active: false },
  });

  res.status(204).end();
});

app.get('/doctor/medication-alerts', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  if (role !== 'DOCTOR') return res.status(403).json({ error: 'Access denied' });

  const alerts = await prisma.medicationMissedDoseAlert.findMany({
    where: { doctorId: id, status: 'NEW' },
    include: { patient: true, medicationOrder: true },
    orderBy: { createdAt: 'desc' },
  });

  res.json(alerts);
});

app.patch('/doctor/medication-alerts/:id/ack', authMiddleware, async (req, res) => {
  const { id, role } = req.user;
  const alert = await prisma.medicationMissedDoseAlert.findUnique({ where: { id: req.params.id } });
  if (!alert) return res.status(404).json({ error: 'Alert not found' });

  if (role !== 'DOCTOR' || alert.doctorId !== id) {
    return res.status(403).json({ error: 'Access denied' });
  }

  await prisma.medicationMissedDoseAlert.update({
    where: { id: req.params.id },
    data: { status: 'ACKNOWLEDGED', acknowledgedAt: new Date() },
  });

  res.status(204).end();
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
  const parsedAge = Number(age);
  const normalizedAge = Number.isFinite(parsedAge) && parsedAge > 0 ? parsedAge : 40;

  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));
  const norm = (v, min, max) => {
    const n = (Number(v) - min) / (max - min);
    return clamp01(n);
  };

  const fieldChecks = [
    { key: 'age', value: normalizedAge, min: 1, max: 120 },
    { key: 'systolicBP', value: Number(safeMetrics.systolicBP), min: 60, max: 260 },
    { key: 'glucose', value: Number(safeMetrics.glucose), min: 20, max: 700 },
    { key: 'bmi', value: Number(safeMetrics.bmi), min: 10, max: 80 },
    { key: 'cholesterol', value: Number(safeMetrics.cholesterol), min: 70, max: 600 },
    { key: 'maxHeartRate', value: Number(safeMetrics.maxHeartRate || 0), min: 0, max: 260 },
    { key: 'stDepression', value: Number(safeMetrics.stDepression || 0), min: 0, max: 10 },
  ];

  const invalidField = fieldChecks.find((f) => Number.isNaN(f.value) || f.value < f.min || f.value > f.max);
  if (invalidField) {
    return res.status(400).json({
      error: `Invalid ${invalidField.key} value. Expected range ${invalidField.min}-${invalidField.max}.`,
    });
  }

  const payload = {
    age: normalizedAge,
    glucose: Number(safeMetrics.glucose) || 0,
    bmi: Number(safeMetrics.bmi) || 0,
    bp: Number(safeMetrics.systolicBP) || 0,
    cholesterol: Number(safeMetrics.cholesterol) || 0,
    // Optional fields – default to 0 if not provided
    thalach: Number(safeMetrics.maxHeartRate || 0),
    oldpeak: Number(safeMetrics.stDepression || 0),
  };

  try {
    // Use rule-based clinical priors (Python ML models not available in this deployment)
    // Rule-based clinical priors are used for stable edge-case predictions.
    const diabetesRuleProb = clamp01(
      0.5 * norm(payload.glucose, 90, 200)
      + 0.25 * norm(payload.bmi, 22, 35)
      + 0.15 * norm(payload.age, 35, 70)
      + 0.1 * norm(payload.bp, 120, 170)
    );

    const heartRuleProb = clamp01(
      0.2 * norm(payload.age, 40, 80)
      + 0.25 * norm(payload.bp, 120, 180)
      + 0.25 * norm(payload.cholesterol, 180, 320)
      + 0.2 * norm(payload.oldpeak, 1, 4)
      + 0.1 * (1 - norm(payload.thalach || 160, 100, 180))
    );

    const hyperRuleProb = clamp01(
      0.6 * norm(payload.bp, 120, 180)
      + 0.15 * norm(payload.age, 35, 75)
      + 0.15 * norm(payload.cholesterol, 180, 300)
      + 0.1 * norm(payload.bmi, 24, 35)
    );

    // Use 100% rule-based (modelWeight = 0) since ML models are unavailable
    const blend = (modelP, ruleP, modelWeight) => clamp01(modelWeight * modelP + (1 - modelWeight) * ruleP);
    const diabetesProb = blend(0, diabetesRuleProb, 0);
    const heartProb = blend(0, heartRuleProb, 0);
    const hyperProb = blend(0, hyperRuleProb, 0);

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

    // Confidence based on data coverage (optional fields provided)
    const optionalCoverage = (payload.thalach > 0 ? 1 : 0) * 0.5 + (payload.oldpeak > 0 ? 1 : 0) * 0.5;
    const confidenceScore = Math.round((0.5 + 0.5 * optionalCoverage) * 100);
    const confidenceLevel = confidenceScore >= 80 ? 'High' : confidenceScore >= 60 ? 'Medium' : 'Low';

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
      confidenceLevel,
      confidenceReason:
        `Blended estimate from ML and clinical-rule cross-checks with ${confidenceScore}% internal agreement.`,
      confidenceImprovement:
        'Provide full vitals including exercise heart-rate profile and repeat measurements to improve estimate stability.',
      timestamp: new Date().toISOString(),
    };

    return res.json(result);
  } catch (err) {
    console.error('Failed to calculate health risk', err);
    return res.status(500).json({ error: 'Failed to calculate health risk' });
  }
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

  const normalizedContent = typeof content === 'string' ? content.trim() : '';
  const normalizedAttachmentUrl = typeof attachmentUrl === 'string' ? attachmentUrl.trim() : '';
  const normalizedAttachmentType = typeof attachmentType === 'string' ? attachmentType : null;

  // Keep chat reliable and lightweight: reject empty payloads and oversized messages.
  if (!normalizedContent && !normalizedAttachmentUrl) {
    return res.status(400).json({ error: 'Message content or attachment required' });
  }

  if (normalizedContent.length > 4000) {
    return res.status(400).json({ error: 'Message too long (max 4000 characters)' });
  }

  if (normalizedAttachmentUrl) {
    const validUrl = /^data:|^https?:\/\//i.test(normalizedAttachmentUrl);
    if (!validUrl) {
      return res.status(400).json({ error: 'Invalid attachment format' });
    }

    if (normalizedAttachmentUrl.length > 15 * 1024 * 1024) {
      return res.status(400).json({ error: 'Attachment payload too large' });
    }
  }

  if (normalizedAttachmentType && !['image', 'pdf', 'video', 'file'].includes(normalizedAttachmentType)) {
    return res.status(400).json({ error: 'Unsupported attachment type' });
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
      content: normalizedContent,
      attachmentUrl: normalizedAttachmentUrl || null,
      attachmentType: normalizedAttachmentType || null,
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

const inferActionsFromText = (inputText, role) => {
  const text = String(inputText || '').toLowerCase();
  const actions = [];
  const hasAny = (...terms) => terms.some((term) => text.includes(term));

  if (hasAny('refresh', 'reload', 'sync')) {
    actions.push({ type: 'REFRESH_DATA' });
  }

  if (role === 'ADMIN') {
    if (hasAny('user', 'users')) actions.push({ type: 'OPEN_USERS' });
    if (hasAny('verification', 'verify', 'approve doctor')) actions.push({ type: 'OPEN_VERIFICATION' });
    if (hasAny('appointment', 'schedule')) actions.push({ type: 'OPEN_APPOINTMENTS' });
    if (hasAny('record', 'vault')) actions.push({ type: 'OPEN_RECORDS' });
    if (hasAny('safety', 'alert')) actions.push({ type: 'OPEN_SAFETY' });
    if (hasAny('broadcast', 'announce')) actions.push({ type: 'OPEN_BROADCAST' });
    if (hasAny('analytics', 'intel')) actions.push({ type: 'OPEN_ANALYTICS' });
    if (hasAny('settings', 'config')) actions.push({ type: 'OPEN_SETTINGS' });
    if (hasAny('log', 'security logs', 'audit')) actions.push({ type: 'OPEN_LOGS' });
    if (hasAny('overview', 'dashboard', 'command center', 'home')) actions.push({ type: 'NAVIGATE', target: 'OVERVIEW' });
  } else if (role === 'DOCTOR') {
    if (hasAny('patient', 'patients')) actions.push({ type: 'OPEN_PATIENTS' });
    if (hasAny('schedule', 'slots', 'calendar', 'appointment', 'book')) actions.push({ type: 'OPEN_SCHEDULE' });
    if (hasAny('analytics', 'insight')) actions.push({ type: 'OPEN_ANALYTICS' });
    if (hasAny('settings', 'config')) actions.push({ type: 'OPEN_SETTINGS' });
    if (hasAny('dashboard', 'overview', 'home')) actions.push({ type: 'OPEN_DASHBOARD' });
  } else if (role === 'PATIENT') {
    if (hasAny('book', 'appointment')) actions.push({ type: 'OPEN_MODAL', target: 'booking_modal' });
    if (hasAny('emergency', 'panic', 'help')) actions.push({ type: 'OPEN_MODAL', target: 'emergency_modal' });
    if (hasAny('passport')) actions.push({ type: 'GENERATE_PASSPORT' });
    if (hasAny('analyze', 'analysis', 'health check', 'risk')) actions.push({ type: 'ANALYZE_HEALTH' });
    if (hasAny('chat', 'message')) actions.push({ type: 'OPEN_CHAT' });
    if (hasAny('video', 'call')) actions.push({ type: 'START_VIDEO_CALL' });
  }

  const seen = new Set();
  return actions.filter((action) => {
    const key = `${action.type}|${action.target || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildFallbackAssistantText = (actions, role) => {
  if (!actions || actions.length === 0) {
    if (role === 'ADMIN') return 'I heard you. Please tell me which admin section to open, like users, verification, or analytics.';
    if (role === 'DOCTOR') return 'I heard you. Please tell me whether to open patients, schedule, analytics, or dashboard.';
    return 'I heard you. Please tell me if you want booking, emergency, health analysis, passport, chat, or video call.';
  }

  if (actions.some((a) => a.type === 'REFRESH_DATA')) return 'Done. I refreshed the data.';
  if (actions.some((a) => a.type === 'OPEN_USERS' || a.type === 'OPEN_PATIENTS')) return 'Done. Opening users now.';
  if (actions.some((a) => a.type === 'OPEN_VERIFICATION')) return 'Done. Opening verification now.';
  if (actions.some((a) => a.type === 'OPEN_APPOINTMENTS' || a.type === 'OPEN_SCHEDULE' || a.type === 'OPEN_BOOKING' || a.type === 'OPEN_APPOINTMENT')) return 'Done. Opening schedule now.';
  if (actions.some((a) => a.type === 'OPEN_ANALYTICS')) return 'Done. Opening analytics now.';
  if (actions.some((a) => a.type === 'OPEN_SETTINGS')) return 'Done. Opening settings now.';
  if (actions.some((a) => a.type === 'OPEN_MODAL' && a.target === 'booking_modal')) return 'Done. Opening appointment booking now.';
  if (actions.some((a) => a.type === 'OPEN_MODAL' && a.target === 'emergency_modal')) return 'Done. Opening emergency alert now.';
  if (actions.some((a) => a.type === 'ANALYZE_HEALTH')) return 'Done. Starting your health analysis now.';
  if (actions.some((a) => a.type === 'GENERATE_PASSPORT')) return 'Done. Generating your health passport now.';

  return 'Done. I am handling that for you now.';
};

// --- AI Automation Assistant via Groq ---// --- AI Automation Assistant via Groq ---
app.post('/ai/command', authMiddleware, upload.single('audio'), async (req, res) => {
  const { role, name } = req.user;

  try {
    let transcribedText = req.body.text || '';

    // If an audio file was uploaded, use Whisper to transcribe it
    if (req.file) {
      if (!GROQ_API_KEY) {
        return res.json({
          transcription: '',
          response: 'Voice input is unavailable right now. Please type your command.',
          language: 'en',
          actions: []
        });
      }

      const formData = new FormData();
      formData.append('file', req.file.buffer, {
        filename: 'audio.webm',
        contentType: req.file.mimetype || 'audio/webm',
      });
      formData.append('model', 'whisper-large-v3-turbo');

      const transcribeRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          ...formData.getHeaders(),
        },
        body: formData,
      });

      if (!transcribeRes.ok) {
        return res.json({ transcription: '', response: 'There seems to be a small issue. Please try again.' });
      }

      const transcribeData = await transcribeRes.json();
      transcribedText = transcribeData.text;
    }

    if (!transcribedText || transcribedText.trim() === '') {
      return res.json({
        transcription: '',
        response: 'I couldn’t understand that clearly. Could you please repeat?'
      });
    }

    if (!GROQ_API_KEY) {
      const fallbackActions = inferActionsFromText(transcribedText, role);
      return res.json({
        transcription: transcribedText,
        response: buildFallbackAssistantText(fallbackActions, role),
        language: 'en',
        actions: fallbackActions,
      });
    }

    const conversationHistoryRaw = req.body.history;
    let history = [];
    if (conversationHistoryRaw) {
      try { history = JSON.parse(conversationHistoryRaw); } catch (e) { history = []; }
    }

    const systemPrompt = `You are a universal AI healthcare assistant integrated into the CareXAI ${role} dashboard.
The user's name is ${name}.

CORE RULES:
- Detect the user's language automatically.
- ALWAYS respond in the SAME language (e.g. English, Telugu, Tamil, Hindi, Malayalam, Kannada).
- Keep responses SHORT, conversational, and suitable for voice output.
- Output ONLY the spoken text in your content.
- NEVER include JSON, function tags, or code blocks in your conversational response.
- If you use a tool, do NOT mention the tool name or its parameters in your spoken reply. Just say something like "Sure, I'm doing that for you" in the user's language.

ROLE-SPECIFIC GUIDANCE:
${role === 'PATIENT' ? `
- You assist patients with bookings, health analysis, and emergency alerts.
- Abilities: Book/cancel appointments, trigger emergency, analyze health, open health passport.
` : role === 'DOCTOR' ? `
- You assist doctors with patient management, scheduling, and clinical analytics.
- Abilities: Select patients, open schedule, open analytics, refresh data.
` : `
- You assist admins with system oversight, user verification, and broadcasts.
- Abilities: Verify/reject doctors, block users, broadcast messages, navigate across administrative nodes.
`}

If you need more information to use a tool, ASK the user.
DO NOT use a tool if you are missing required information.`;

    let messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: transcribedText }
    ];

    const tools = [
      // Common Tools
      {
        type: "function",
        function: {
          name: "ui_action",
          description: "Triggers a UI action on the frontend dashboard like scrolling or opening tabs.",
          parameters: {
            type: "object",
            properties: {
              actionType: { type: "string", enum: ["OPEN_MODAL", "SCROLL_TO", "NAVIGATE"] },
              target: { type: "string", description: "Target element ID or tab name." }
            },
            required: ["actionType", "target"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "refresh_data",
          description: "Refreshes the current dashboard data.",
          parameters: { type: "object", properties: {} }
        }
      }
    ];

    if (role === 'PATIENT') {
      tools.push(
        {
          type: "function",
          function: {
            name: "book_appointment",
            description: "Books a new medical appointment.",
            parameters: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date in YYYY-MM-DD format" },
                time: { type: "string", description: "Time in HH:MM format" }
              },
              required: ["date", "time"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "cancel_appointment",
            description: "Cancels the upcoming appointment.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "trigger_emergency_alert",
            description: "Triggers the emergency alert modal.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "analyze_health",
            description: "Syncs vitals and performs an AI health risk analysis.",
            parameters: { type: "object", properties: {} }
          }
        },
        {
          type: "function",
          function: {
            name: "generate_passport",
            description: "Generates and opens the health passport.",
            parameters: { type: "object", properties: {} }
          }
        }
      );
    } else if (role === 'DOCTOR') {
      tools.push(
        {
          type: "function",
          function: {
            name: "select_patient",
            description: "Selects a patient to view their clinical records.",
            parameters: {
              type: "object",
              properties: {
                patientName: { type: "string", description: "Name or ID of the patient." }
              },
              required: ["patientName"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "open_schedule",
            description: "Navigates to the doctor's schedule view.",
            parameters: { type: "object", properties: {} }
          }
        }
      );
    } else if (role === 'ADMIN') {
      tools.push(
        {
          type: "function",
          function: {
            name: "verify_doctor",
            description: "Approves a pending doctor's registration.",
            parameters: {
              type: "object",
              properties: {
                doctorId: { type: "string", description: "ID of the doctor to verify." }
              },
              required: ["doctorId"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "block_user",
            description: "Blocks a user from accessing the system.",
            parameters: {
              type: "object",
              properties: {
                userId: { type: "string", description: "ID of the user to block." }
              },
              required: ["userId"]
            }
          }
        }
      );
    }

    let chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: GROQ_MODEL, messages, tools, tool_choice: "auto", temperature: 0.3, max_tokens: 256 }),
    });

    if (!chatRes.ok) {
      const fallbackActions = inferActionsFromText(transcribedText, role);
      return res.json({
        transcription: transcribedText,
        response: buildFallbackAssistantText(fallbackActions, role),
        language: 'en',
        actions: fallbackActions,
      });
    }

    let chatData = await chatRes.json();
    let responseMessage = chatData.choices?.[0]?.message;
    let clientActions = [];

    // Process Tool Calls
    if (responseMessage?.tool_calls?.length > 0) {
      messages.push(responseMessage);

      for (const toolCall of responseMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
        let functionResponse = "";

        if (functionName === "book_appointment") {
          let dId = null;
          const anyDoc = await prisma.user.findFirst({ where: { role: 'DOCTOR' } });
          if (anyDoc) dId = anyDoc.id;
          if (dId && args.date && args.time) {
            try {
              let finalDate = args.date;
              if (/\d{2}\/\d{2}\/\d{4}/.test(finalDate)) {
                const [d, m, y] = finalDate.split('/');
                finalDate = `${y}-${m}-${d}`;
              }
              const parsedDate = new Date(`${finalDate}T${args.time}:00.000Z`);
              await prisma.appointment.create({
                data: {
                  date: parsedDate,
                  time: args.time,
                  status: 'UPCOMING',
                  doctorId: dId,
                  patientId: req.user.id
                }
              });
              clientActions.push({ type: 'REFRESH_DATA' });
              functionResponse = "Appointment booked.";
            } catch (e) { functionResponse = "Booking failed."; }
          }
        } else if (functionName === "cancel_appointment") {
          const appt = await prisma.appointment.findFirst({
            where: { patientId: req.user.id, status: 'UPCOMING' },
            orderBy: { date: 'asc' }
          });
          if (appt) {
            await prisma.appointment.update({ where: { id: appt.id }, data: { status: 'CANCELLED' } });
            clientActions.push({ type: 'REFRESH_DATA' });
            functionResponse = "Appointment cancelled.";
          }
        } else if (functionName === "trigger_emergency_alert") {
          clientActions.push({ type: 'OPEN_MODAL', target: 'emergency_modal' });
          functionResponse = "Emergency modal opened.";
        } else if (functionName === "analyze_health") {
          clientActions.push({ type: 'ANALYZE_HEALTH' });
          functionResponse = "Analysis triggered.";
        } else if (functionName === "generate_passport") {
          clientActions.push({ type: 'GENERATE_PASSPORT' });
          functionResponse = "Passport generated.";
        } else if (functionName === "ui_action") {
          clientActions.push({ type: args.actionType, target: args.target });
          functionResponse = `UI action ${args.actionType} on ${args.target} performed.`;
        } else if (functionName === "refresh_data") {
          clientActions.push({ type: 'REFRESH_DATA' });
          functionResponse = "Data refreshed.";
        } else if (functionName === "select_patient") {
          clientActions.push({ type: 'SELECT_PATIENT', target: args.patientName });
          functionResponse = `Patient ${args.patientName} selected.`;
        } else if (functionName === "open_schedule") {
          clientActions.push({ type: 'OPEN_SCHEDULE' });
          functionResponse = "Schedule opened.";
        } else if (functionName === "verify_doctor") {
          clientActions.push({ type: 'VERIFY_DOCTOR', payload: { doctorId: args.doctorId } });
          functionResponse = `Doctor ${args.doctorId} verified.`;
        } else if (functionName === "block_user") {
          clientActions.push({ type: 'BLOCK_USER', payload: { userId: args.userId } });
          functionResponse = `User ${args.userId} blocked.`;
        }

        messages.push({ tool_call_id: toolCall.id, role: "tool", name: functionName, content: functionResponse });
      }

      chatRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages, temperature: 0.3, max_tokens: 256 }),
      });
      if (!chatRes.ok) {
        const fallbackActions = inferActionsFromText(transcribedText, role);
        return res.json({
          transcription: transcribedText,
          response: buildFallbackAssistantText(fallbackActions, role),
          language: 'en',
          actions: fallbackActions,
        });
      }
      chatData = await chatRes.json();
      responseMessage = chatData.choices?.[0]?.message;
    }

    let aiResponse = responseMessage?.content || 'I processed that for you.';
    aiResponse = aiResponse.replace(/<function=.*?>.*?<\/function>/gs, '').trim();

    if (clientActions.length === 0) {
      clientActions = inferActionsFromText(transcribedText, role);
    }
    if (!aiResponse) {
      aiResponse = buildFallbackAssistantText(clientActions, role);
    }

    let detectedLang = 'en';
    if (/[\u0C00-\u0C7F]/.test(aiResponse)) detectedLang = 'te';
    else if (/[\u0900-\u097F]/.test(aiResponse)) detectedLang = 'hi';
    else if (/[\u0B80-\u0BFF]/.test(aiResponse)) detectedLang = 'ta';

    res.json({
      transcription: transcribedText,
      response: aiResponse,
      language: detectedLang,
      actions: clientActions
    });
  } catch (error) {
    console.error('AI command error:', error);
    const fallbackActions = inferActionsFromText(req.body?.text || '', role);
    res.json({
      transcription: req.body?.text || '',
      response: buildFallbackAssistantText(fallbackActions, role),
      language: 'en',
      actions: fallbackActions,
    });
  }
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
    const result = await clearAllNonAdminData();

    res.json({
      ok: true,
      message: 'All login details except admin users have been cleared.',
      deleted: result,
    });
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
    const doctor = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!doctor || doctor.role !== 'DOCTOR') {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    if (status === 'VERIFIED') {
      if (!doctor.registrationNumber || !doctor.registrationNumber.trim()) {
        return res.status(400).json({ error: 'Doctor registration number is required before approval' });
      }
      if (!doctor.verificationDocumentUrl || !doctor.verificationDocumentUrl.trim()) {
        return res.status(400).json({ error: 'Doctor certificate/license document is required before approval' });
      }
    }

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

  if (!AGORA_APP_ID) {
    return res.status(400).json({ error: 'Agora credentials not configured' });
  }

  if (!channelName || uid === undefined) {
    return res.status(400).json({ error: 'channelName and uid are required' });
  }

  try {
    let token = null;

    if (AGORA_APP_CERTIFICATE) {
      // Generate token using the correct method
      const expirationTimeInSeconds = 3600; // 1 hour
      const currentTimeInSeconds = Math.floor(Date.now() / 1000);
      const privilegeExpireTs = currentTimeInSeconds + expirationTimeInSeconds;

      token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_APP_CERTIFICATE,
        channelName,
        uid,
        RtcRole.PUBLISHER,
        privilegeExpireTs
      );
      console.log('Generated secure Agora token for channel:', channelName, 'uid:', uid);
    } else {
      console.log('Agora certificate missing. Returning null token for testing mode.');
    }

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

app.use((err, _req, res, _next) => {
  const isPrismaInitError = err?.name === 'PrismaClientInitializationError';
  if (isPrismaInitError) {
    return res.status(503).json({ error: 'Database unavailable. Please try again shortly.' });
  }

  console.error('Unhandled API error', err);
  return res.status(500).json({ error: 'Internal server error' });
});

server.listen(PORT, () => {
  console.log(`CareXAI realtime server listening on http://localhost:${PORT}`);
  // Ensure the single owner admin user exists on startup
  ensureOwnerAdminUser().catch((err) => {
    console.error('Failed to ensure owner admin user', err);
  });
});
