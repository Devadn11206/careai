import React, { useEffect } from 'react';
import { toast } from 'sonner';
import { BackendAPI } from '@/services/apiClient';
import { useHealth } from '@/services/HealthContext';
import { useNavigate } from 'react-router-dom';
import { Bell, Video, Calendar } from 'lucide-react';

export const GlobalNotifications: React.FC = () => {
  const { user } = useHealth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    const socket = BackendAPI.getSocket();
    if (!socket) return;

    // Requirement 2: 15-minute Reminder System
    const handleReminder = (data: {
      appointmentId: string;
      title: string;
      message: string;
      doctorName?: string;
      patientName?: string;
      startTime: string;
      type: string;
    }) => {
      console.log('Received appointment reminder:', data);
      
      // Trigger sound (Requirement 2)
      try {
        const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'); // A clean beep/alert sound
        audio.play().catch(e => console.warn('Audio play blocked by browser', e));
      } catch (e) {
        console.warn('Failed to play reminder sound', e);
      }

      // Show UI popup (Requirement 2)
      toast.info(data.title, {
        description: data.message,
        duration: 10000,
        icon: data.type === 'VIDEO' ? <Video className="text-primary" size={18} /> : <Calendar className="text-primary" size={18} />,
        action: {
          label: 'Join Now',
          onClick: () => {
            if (data.type === 'VIDEO') navigate('/consult');
            else navigate('/dashboard');
          }
        }
      });
    };

    // Requirement 1: Real-time Appointment Creation Notification
    const handleNewAppointment = (appt: any) => {
      const isRecipient = (user.role === 'DOCTOR' && appt.doctorId === user.id) || 
                          (user.role === 'PATIENT' && appt.patientId === user.id);
      
      if (!isRecipient) return;

      toast.success('New Appointment Scheduled', {
        description: `${appt.consultationType === 'VIDEO' ? 'Video' : 'In-person'} consultation on ${appt.date} at ${appt.time}`,
        icon: <Bell className="text-emerald-400" size={18} />,
      });
    };

    socket.on('appointment:reminder', handleReminder);
    socket.on('appointment:created', handleNewAppointment);

    return () => {
      socket.off('appointment:reminder', handleReminder);
      socket.off('appointment:created', handleNewAppointment);
    };
  }, [user, navigate]);

  return null;
};
