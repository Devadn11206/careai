import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/carex/AppLayout';
import { VideoCall } from '@/components/features/VideoCall';
import { useHealth } from '@/services/HealthContext';
import { BackendAPI } from '@/services/apiClient';
import { Appointment, UserRole } from '@/types';
import { Loader2, VideoOff } from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';
import { useNavigate } from 'react-router-dom';

const ConsultPage = () => {
  const { user } = useHealth();
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadConsultation = async () => {
      try {
        const appts = await BackendAPI.getAppointments();
        // Filter for scheduled or in-progress appointments today
        const today = new Date().toISOString().split('T')[0];
        const active = appts.find(a => 
          (a.status === 'SCHEDULED' || a.status === 'IN_PROGRESS' || a.status === 'PENDING') && 
          a.date === today &&
          a.consultationType === 'VIDEO'
        );
        
        setActiveAppointment(active || null);
      } catch (err) {
        console.error("Failed to load appointments for consultation", err);
      } finally {
        setLoading(false);
      }
    };
    loadConsultation();
  }, []);

  return (
    <AppLayout title="Video Consultation" subtitle="Secure telemedicine channel with real-time AI assistance">
      <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : activeAppointment ? (
          <VideoCall
            appointmentId={activeAppointment.id}
            otherUserName={user?.role === UserRole.DOCTOR ? activeAppointment.patientName : activeAppointment.doctorName}
            currentUserRole={user?.role || UserRole.PATIENT}
            onClose={async () => {
              navigate('/dashboard');
            }}
          />
        ) : (
          <GlassCard className="p-12 text-center max-w-md border-dashed">
            <VideoOff className="h-12 w-12 mx-auto mb-4 opacity-20 text-primary" />
            <h3 className="text-xl font-display font-bold mb-2">No Active Consultation</h3>
            <p className="text-muted-foreground text-sm">
              You don't have any video consultations scheduled for today. Check your appointments list for upcoming sessions.
            </p>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
};

export default ConsultPage;
