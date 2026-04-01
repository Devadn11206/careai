import { io as createSocket } from 'socket.io-client';

const API = 'http://localhost:4000';
const OWNER_EMAIL = process.env.OWNER_ADMIN_EMAIL || 'ddnandu3@gmail.com';
const OWNER_PASSWORD = process.env.OWNER_ADMIN_PASSWORD || '123456';

const fail = (msg) => {
  throw new Error(msg);
};

async function request(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${res.status} ${data?.error || ''}`.trim());
  }
  return data;
}

function waitForSocketEvent(socket, eventName, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timeout waiting for socket event '${eventName}'`));
    }, timeoutMs);

    const onEvent = (payload) => {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

async function main() {
  console.log('Running chat end-to-end test...');

  const stamp = Date.now();
  const patientEmail = `patient_${stamp}@carexai.local`;
  const doctorEmail = `doctor_${stamp}@carexai.local`;
  const password = 'Pass@1234';

  const patientReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Patient ${stamp}`,
      email: patientEmail,
      password,
      role: 'PATIENT',
    }),
  });

  if (!patientReg?.token) fail('Patient registration did not return token');
  const patientToken = patientReg.token;

  const doctorReg = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: `Doctor ${stamp}`,
      email: doctorEmail,
      password,
      role: 'DOCTOR',
      specialization: 'General Medicine',
      qualification: 'MBBS',
      registrationNumber: `REG-${stamp}`,
      medicalCouncil: 'Test Council',
      experienceYears: 5,
      verificationDocumentUrl: 'data:text/plain;base64,VEVTVA==',
      verificationDocumentName: 'license.txt',
    }),
  });

  if (!doctorReg?.user?.id) fail('Doctor registration failed to return user id');

  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: OWNER_EMAIL, password: OWNER_PASSWORD }),
  });
  const adminToken = adminLogin?.token;
  if (!adminToken) fail('Owner admin login failed, cannot verify doctor');

  await request(`/admin/doctors/${doctorReg.user.id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'VERIFIED' }),
  }, adminToken);

  const doctorLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: doctorEmail, password }),
  });
  const doctorToken = doctorLogin?.token;
  if (!doctorToken) fail('Doctor login failed after verification');

  const doctors = await request('/doctors', { method: 'GET' }, patientToken);
  const doctor = doctors.find((d) => d.email === doctorEmail);
  if (!doctor) fail('Registered doctor not visible to patient');

  const apptDate = '2030-01-01';
  const appointment = await request('/appointments', {
    method: 'POST',
    body: JSON.stringify({
      doctorId: doctor.id,
      date: apptDate,
      time: '09:00',
      type: 'Chat Consultation',
      consultationType: 'VIDEO',
      symptoms: 'Headache and mild fever',
      autoShare: {
        currentVitals: { systolicBP: 125, diastolicBP: 80, glucose: 100, bmi: 23, cholesterol: 170, timestamp: new Date().toISOString() },
      },
    }),
  }, patientToken);

  if (!appointment?.id) fail('Appointment creation failed');

  const patientSocket = createSocket(API, {
    auth: { token: patientToken },
    transports: ['websocket'],
    timeout: 5000,
  });

  const doctorSocket = createSocket(API, {
    auth: { token: doctorToken },
    transports: ['websocket'],
    timeout: 5000,
  });

  await new Promise((resolve, reject) => {
    let connected = 0;
    const onConnect = () => {
      connected += 1;
      if (connected === 2) resolve();
    };
    const onError = (err) => reject(err);
    patientSocket.once('connect', onConnect);
    doctorSocket.once('connect', onConnect);
    patientSocket.once('connect_error', onError);
    doctorSocket.once('connect_error', onError);
  });

  const patientText = 'Hello doctor, sharing my symptoms.';
  const doctorText = 'Got it. Please rest and hydrate, we will monitor.';
  const attachmentOnlyText = '';
  const attachmentUrl = 'data:text/plain;base64,SGVsbG8gQ2FyZVhBSSBDaGF0IEF0dGFjaG1lbnQ=';
  const attachmentType = 'file';

  const patientEventPromise = waitForSocketEvent(patientSocket, 'chat:message', 6000);
  const doctorEventPromise = waitForSocketEvent(doctorSocket, 'chat:message', 6000);

  const msg1 = await request(`/appointments/${appointment.id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ content: patientText }),
  }, patientToken);

  if (!msg1?.id) fail('Patient message failed');

  const [evtForPatient1, evtForDoctor1] = await Promise.all([patientEventPromise, doctorEventPromise]);
  if (evtForPatient1?.content !== patientText || evtForDoctor1?.content !== patientText) {
    fail('Socket broadcast failed for patient->doctor message');
  }

  const patientEventPromise2 = waitForSocketEvent(patientSocket, 'chat:message', 6000);
  const doctorEventPromise2 = waitForSocketEvent(doctorSocket, 'chat:message', 6000);

  const msg2 = await request(`/appointments/${appointment.id}/chat`, {
    method: 'POST',
    body: JSON.stringify({ content: doctorText }),
  }, doctorToken);

  if (!msg2?.id) fail('Doctor reply failed');

  const [evtForPatient2, evtForDoctor2] = await Promise.all([patientEventPromise2, doctorEventPromise2]);
  if (evtForPatient2?.content !== doctorText || evtForDoctor2?.content !== doctorText) {
    fail('Socket broadcast failed for doctor->patient message');
  }

  const patientEventPromise3 = waitForSocketEvent(patientSocket, 'chat:message', 6000);
  const doctorEventPromise3 = waitForSocketEvent(doctorSocket, 'chat:message', 6000);

  const msg3 = await request(`/appointments/${appointment.id}/chat`, {
    method: 'POST',
    body: JSON.stringify({
      content: attachmentOnlyText,
      attachmentUrl,
      attachmentType,
    }),
  }, patientToken);

  if (!msg3?.id) fail('Attachment message failed');
  if (msg3?.attachmentType !== attachmentType || msg3?.attachmentUrl !== attachmentUrl) {
    fail('Attachment message response is missing attachment details');
  }

  const [evtForPatient3, evtForDoctor3] = await Promise.all([patientEventPromise3, doctorEventPromise3]);
  if (evtForPatient3?.attachmentType !== attachmentType || evtForDoctor3?.attachmentType !== attachmentType) {
    fail('Socket broadcast failed for attachment message type');
  }
  if (evtForPatient3?.attachmentUrl !== attachmentUrl || evtForDoctor3?.attachmentUrl !== attachmentUrl) {
    fail('Socket broadcast failed for attachment message URL');
  }

  const historyForPatient = await request(`/appointments/${appointment.id}/chat`, { method: 'GET' }, patientToken);
  const historyForDoctor = await request(`/appointments/${appointment.id}/chat`, { method: 'GET' }, doctorToken);

  const patientHasBoth = historyForPatient.some((m) => m.content === patientText) && historyForPatient.some((m) => m.content === doctorText);
  const doctorHasBoth = historyForDoctor.some((m) => m.content === patientText) && historyForDoctor.some((m) => m.content === doctorText);

  if (!patientHasBoth || !doctorHasBoth) {
    fail('Message history is inconsistent between patient and doctor');
  }

  const patientHasAttachment = historyForPatient.some((m) => m.attachmentType === attachmentType && m.attachmentUrl === attachmentUrl);
  const doctorHasAttachment = historyForDoctor.some((m) => m.attachmentType === attachmentType && m.attachmentUrl === attachmentUrl);
  if (!patientHasAttachment || !doctorHasAttachment) {
    fail('Attachment history is inconsistent between patient and doctor');
  }

  patientSocket.disconnect();
  doctorSocket.disconnect();

  console.log('PASS: Chat communication works for patient and doctor (text + attachment, REST + real-time sockets + history).');
}

main().catch((err) => {
  console.error('FAIL:', err.message || err);
  process.exit(1);
});
