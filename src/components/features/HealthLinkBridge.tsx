import React, { useEffect, useMemo, useState } from 'react';
import { Appointment, HealthMetrics, Medication, PatientProfile } from '@/types';
import { BackendAPI } from '@/services/apiClient';
import { GeminiService } from '@/services/geminiService';
import { NeonButton as Button } from '@/components/carex/NeonButton';
import { GlassCard as Card } from '@/components/carex/GlassCard';

type BridgeLanguage = 'en-IN' | 'hi-IN' | 'te-IN' | 'ta-IN' | 'kn-IN' | 'ml-IN';

interface ReminderDraft {
  id: string;
  name: string;
  time: string;
  dosage?: string;
  active: boolean;
}

interface HealthLinkBridgeProps {
  patient: PatientProfile;
  appointments: Appointment[];
  metrics: HealthMetrics;
  medications: Medication[];
}

const uiText: Record<BridgeLanguage, {
  title: string;
  subtitle: string;
  symptomsLabel: string;
  notesLabel: string;
  remindersLabel: string;
  sendButton: string;
}> = {
  'en-IN': {
    title: 'Health Link',
    subtitle: 'Create a structured patient update for your doctor',
    symptomsLabel: 'Symptoms',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medication reminders',
    sendButton: 'Send To Doctor',
  },
  'hi-IN': {
    title: 'Health Link',
    subtitle: 'Doctor ke liye structured update bhejein',
    symptomsLabel: 'Lakshan',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medicine reminders',
    sendButton: 'Doctor Ko Bhejein',
  },
  'te-IN': {
    title: 'Health Link',
    subtitle: 'Doctor ki structured update pampandi',
    symptomsLabel: 'Symptoms',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medicine reminders',
    sendButton: 'Doctor ki pampandi',
  },
  'ta-IN': {
    title: 'Health Link',
    subtitle: 'Doctor-kku structured update anuppungal',
    symptomsLabel: 'Symptoms',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medicine reminders',
    sendButton: 'Doctor-kku anuppu',
  },
  'kn-IN': {
    title: 'Health Link',
    subtitle: 'Doctor-ge structured update kalisi',
    symptomsLabel: 'Symptoms',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medicine reminders',
    sendButton: 'Doctor-ge kalisi',
  },
  'ml-IN': {
    title: 'Health Link',
    subtitle: 'Doctor-ne structured update ayakkuka',
    symptomsLabel: 'Symptoms',
    notesLabel: 'Additional notes',
    remindersLabel: 'Medicine reminders',
    sendButton: 'Doctor-ne ayakkuka',
  },
};

const buildRiskFlag = (metrics: HealthMetrics): string => {
  const highBP = metrics.systolicBP >= 140 || metrics.diastolicBP >= 90;
  const highGlucose = metrics.glucose >= 180;
  if (highBP && highGlucose) return 'HIGH';
  if (highBP || highGlucose) return 'MODERATE';
  return 'LOW';
};

export const HealthLinkBridge: React.FC<HealthLinkBridgeProps> = ({
  patient,
  appointments,
  metrics,
  medications,
}) => {
  const [language, setLanguage] = useState<BridgeLanguage>('en-IN');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedAppointmentId, setSelectedAppointmentId] = useState('');
  const [reminders, setReminders] = useState<ReminderDraft[]>([]);
  const [newReminderName, setNewReminderName] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newReminderDosage, setNewReminderDosage] = useState('');
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const text = uiText[language] || uiText['en-IN'];

  const activeAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS'),
    [appointments],
  );

  useEffect(() => {
    if (!selectedAppointmentId && activeAppointments.length > 0) {
      setSelectedAppointmentId(activeAppointments[0].id);
    }
  }, [activeAppointments, selectedAppointmentId]);

  useEffect(() => {
    const key = `health_l_reminders_${patient.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setReminders(parsed.filter(Boolean));
      }
    } catch {
      setReminders([]);
    }
  }, [patient.id]);

  useEffect(() => {
    const key = `health_l_reminders_${patient.id}`;
    localStorage.setItem(key, JSON.stringify(reminders));
  }, [patient.id, reminders]);

  const addReminder = () => {
    if (!newReminderName.trim() || !newReminderTime.trim()) return;
    const item: ReminderDraft = {
      id: `${Date.now()}`,
      name: newReminderName.trim(),
      time: newReminderTime,
      dosage: newReminderDosage.trim() || undefined,
      active: true,
    };
    setReminders((prev) => [...prev, item]);
    setNewReminderName('');
    setNewReminderTime('');
    setNewReminderDosage('');
  };

  const removeReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const handleSend = async () => {
    if (!selectedAppointmentId || !symptoms.trim()) {
      setStatus('Select an appointment and add symptoms before sending.');
      return;
    }

    const target = activeAppointments.find((a) => a.id === selectedAppointmentId);
    if (!target) {
      setStatus('Selected appointment is not active anymore.');
      return;
    }

    setSending(true);
    setStatus(null);

    try {
      const summary = await GeminiService.generatePatientSummary(patient, metrics, null, medications);
      const payload = {
        language,
        symptoms: symptoms.trim(),
        notes: notes.trim(),
        reminderCount: reminders.length,
        reminders,
        vitals: {
          systolicBP: metrics.systolicBP,
          diastolicBP: metrics.diastolicBP,
          glucose: metrics.glucose,
          bmi: metrics.bmi,
          cholesterol: metrics.cholesterol,
        },
        riskFlag: buildRiskFlag(metrics),
        generatedAt: new Date().toISOString(),
      };

      const message = [
        'HEALTH_L BRIEF:',
        `Patient: ${patient.name}`,
        `Language: ${language}`,
        `Risk Flag: ${payload.riskFlag}`,
        `Symptoms: ${payload.symptoms}`,
        `Notes: ${payload.notes || 'None'}`,
        `Vitals: BP ${metrics.systolicBP}/${metrics.diastolicBP}, Glucose ${metrics.glucose}, BMI ${metrics.bmi}, Cholesterol ${metrics.cholesterol}`,
        `Reminders: ${reminders.length}`,
        `AI Summary: ${summary}`,
        `HEALTH_L JSON: ${JSON.stringify(payload)}`,
      ].join('\n');

      await BackendAPI.sendChatMessage({
        appointmentId: target.id,
        content: message,
      });

      setStatus(`Brief sent to Dr. ${target.doctorName}.`);
      setSymptoms('');
      setNotes('');
    } catch (error: any) {
      setStatus(error?.message || 'Failed to send Health Link brief.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Card title={text.title} className="border-neon-500/10 glass-card-dark">
      <p className="text-xs text-slate-400 mb-4">{text.subtitle}</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
        <div className="md:col-span-2">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Appointment</label>
          <select
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 outline-none"
            value={selectedAppointmentId}
            onChange={(e) => setSelectedAppointmentId(e.target.value)}
          >
            <option value="">Select active appointment</option>
            {activeAppointments.map((a) => (
              <option key={a.id} value={a.id}>
                {a.date} {a.time} - {a.doctorName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">Language</label>
          <select
            className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 outline-none"
            value={language}
            onChange={(e) => setLanguage(e.target.value as BridgeLanguage)}
          >
            <option value="en-IN">English</option>
            <option value="hi-IN">Hindi</option>
            <option value="te-IN">Telugu</option>
            <option value="ta-IN">Tamil</option>
            <option value="kn-IN">Kannada</option>
            <option value="ml-IN">Malayalam</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 mb-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{text.symptomsLabel}</label>
          <textarea
            className="w-full min-h-[82px] p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 outline-none"
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Describe symptoms for this consultation"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-2">{text.notesLabel}</label>
          <textarea
            className="w-full min-h-[68px] p-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 outline-none"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional context to help your doctor"
          />
        </div>
      </div>

      <div className="rounded-xl border border-white/10 p-3 bg-white/5 mb-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] mb-3">{text.remindersLabel}</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
          <input
            className="md:col-span-2 p-2.5 rounded-lg bg-space-900/70 border border-white/10 text-slate-200 text-sm"
            value={newReminderName}
            onChange={(e) => setNewReminderName(e.target.value)}
            placeholder="Medication name"
          />
          <input
            type="time"
            className="p-2.5 rounded-lg bg-space-900/70 border border-white/10 text-slate-200 text-sm"
            value={newReminderTime}
            onChange={(e) => setNewReminderTime(e.target.value)}
          />
          <input
            className="p-2.5 rounded-lg bg-space-900/70 border border-white/10 text-slate-200 text-sm"
            value={newReminderDosage}
            onChange={(e) => setNewReminderDosage(e.target.value)}
            placeholder="Dosage"
          />
        </div>
        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" onClick={addReminder}>Add Reminder</Button>
        </div>

        <div className="space-y-2 max-h-36 overflow-y-auto">
          {reminders.length === 0 && (
            <p className="text-xs text-slate-500">No reminders yet.</p>
          )}
          {reminders.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-xs bg-space-900/60 border border-white/10 rounded-lg px-3 py-2">
              <span className="text-slate-300">{r.name} {r.dosage ? `(${r.dosage})` : ''} at {r.time}</span>
              <button onClick={() => removeReminder(r.id)} className="text-rose-400 hover:text-rose-300 font-bold">Remove</button>
            </div>
          ))}
        </div>
      </div>

      {status && <p className="text-xs text-slate-300 mb-3">{status}</p>}

      <Button variant="neon" className="w-full" onClick={handleSend} isLoading={sending}>
        {text.sendButton}
      </Button>
    </Card>
  );
};
