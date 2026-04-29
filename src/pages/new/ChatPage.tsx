import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/carex/AppLayout';
import { ChatSystem } from '@/components/features/ChatSystem';
import { useHealth } from '@/services/HealthContext';
import { BackendAPI } from '@/services/apiClient';
import { Appointment, UserRole } from '@/types';
import { Loader2, MessageSquare } from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';

const ChatPage = () => {
  const { user } = useHealth();
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadChat = async () => {
      try {
        const appts = await BackendAPI.getAppointments();
        // Filter for active or most recent appointment
        const sorted = appts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const latest = sorted[0];
        if (latest) {
          setActiveAppointment(latest);
        }
      } catch (err) {
        console.error("Failed to load appointments for chat", err);
      } finally {
        setLoading(false);
      }
    };
    loadChat();
  }, []);

  return (
    <AppLayout title="Clinical Messaging" subtitle="Secure end-to-end encrypted health communication">
      <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : activeAppointment ? (
          <div className="w-full h-full relative">
            <ChatSystem
              currentUserId={user?.id || ''}
              currentUserRole={user?.role || UserRole.PATIENT}
              appointmentId={activeAppointment.id}
              otherUserId={user?.role === UserRole.DOCTOR ? activeAppointment.patientId : activeAppointment.doctorId}
              otherUserName={user?.role === UserRole.DOCTOR ? activeAppointment.patientName : activeAppointment.doctorName}
              onClose={() => {}} // No-op for the full page chat
              onVideoCall={() => window.location.href = '/consult'}
            />
          </div>
        ) : (
          <GlassCard className="p-12 text-center max-w-md border-dashed">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20 text-primary" />
            <h3 className="text-xl font-display font-bold mb-2">No Active Conversations</h3>
            <p className="text-muted-foreground text-sm">
              You haven't scheduled any appointments yet. Conversations are enabled once a consultation is booked.
            </p>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
};

export default ChatPage;
