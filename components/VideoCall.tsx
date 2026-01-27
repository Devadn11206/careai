
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import AgoraRTC, {
  IAgoraRTCClient,
  ILocalAudioTrack,
  ILocalVideoTrack,
  IRemoteUser,
} from 'agora-rtc-sdk-ng';

interface Props {
  appointmentId: string;
  otherUserName: string;
  onClose: () => void;
}

// IMPORTANT: Agora configuration
// Reads App ID from environment. Token is fetched from backend.
const AGORA_APP_ID = (import.meta as any).env.VITE_AGORA_APP_ID || '29050961d46b46bb93ea3981ceed1741';
const API_BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || 'http://localhost:4000';

export const VideoCall: React.FC<Props> = ({ appointmentId, otherUserName, onClose }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localContainerRef = useRef<HTMLDivElement | null>(null);
  const remoteContainerRef = useRef<HTMLDivElement | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<ILocalAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ILocalVideoTrack | null>(null);

  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [status, setStatus] = useState('Connecting...');
  const [duration, setDuration] = useState(0);
  const [remoteUser, setRemoteUser] = useState<IRemoteUser | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);

  // Shared channel name based on appointment ID
  const channelName = useMemo(
    () => `carexai_appointment_${appointmentId}`,
    [appointmentId]
  );

  useEffect(() => {
    let stream: MediaStream | null = null;

    const startVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setTimeout(() => setStatus('Connected'), 1500);
      } catch (err) {
        console.error("Error accessing media devices.", err);
        setStatus('Camera access denied. Check permissions.');
      }
    };

    startVideo();

    // Call timer
    const timer = setInterval(() => {
      setDuration(prev => prev + 1);
    }, 1000);

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      clearInterval(timer);
    };
  }, []);

  // Agora initialization and join logic
  useEffect(() => {
    const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
    clientRef.current = client;

    const handleUserPublished = async (user: IRemoteUser, mediaType: 'audio' | 'video') => {
      try {
        await client.subscribe(user, mediaType);

        if (mediaType === 'video' && user.videoTrack && remoteContainerRef.current) {
          user.videoTrack.play(remoteContainerRef.current);
        }

        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }

        setRemoteUser(user);
      } catch (err) {
        console.error('Failed to subscribe to remote user', err);
      }
    };

    const handleUserUnpublished = (user: IRemoteUser, mediaType: 'audio' | 'video') => {
      if (mediaType === 'video') {
        setRemoteUser((current) => (current && current.uid === user.uid ? null : current));
      }
    };

    const handleUserLeft = (user: IRemoteUser) => {
      setRemoteUser((current) => (current && current.uid === user.uid ? null : current));
    };

    client.on('user-published', handleUserPublished);
    client.on('user-unpublished', handleUserUnpublished);
    client.on('user-left', handleUserLeft);
    client.on('connection-state-change', (cur, _prev) => {
      if (cur === 'CONNECTED') setStatus('Connected');
      else if (cur === 'RECONNECTING') setStatus('Reconnecting...');
      else if (cur === 'DISCONNECTED') setStatus('Disconnected');
    });

    const startCall = async () => {
      try {
        if (!AGORA_APP_ID) {
          console.warn('Agora App ID not configured. Set VITE_AGORA_APP_ID to enable video calls.');
          setStatus('Video calling is not configured for this environment.');
          return;
        }

        setStatus('Connecting...');

        // Use a single UID for both token generation and join
        const uid = Math.floor(Math.random() * 2147483647); // Random UID within 32-bit range

        // Fetch token from backend
        const authToken = localStorage.getItem('carexai_token');
        if (!authToken) {
          setStatus('Authentication required. Please log in.');
          return;
        }

        const response = await fetch(`${API_BASE_URL}/agora-token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({
            channelName: channelName,
            uid,
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to get Agora token: ${response.statusText}`);
        }

        const { token } = await response.json();
        setAgoraToken(token);

        // Join with the same UID used to generate the token
        await client.join(AGORA_APP_ID, channelName, token, uid);

        const [micTrack, camTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
        localAudioTrackRef.current = micTrack;
        localVideoTrackRef.current = camTrack;

        await client.publish([micTrack, camTrack]);

        if (localContainerRef.current) {
          camTrack.play(localContainerRef.current);
        }

        setStatus('Connected');
      } catch (err) {
        console.error('Error starting Agora call', err);
        setStatus('Unable to start call. Check console.');
      }
    };

    startCall();

    return () => {
      // Cleanup on component unmount
      const cleanup = async () => {
        try {
          if (localAudioTrackRef.current) {
            localAudioTrackRef.current.close();
            localAudioTrackRef.current = null;
          }
          if (localVideoTrackRef.current) {
            localVideoTrackRef.current.close();
            localVideoTrackRef.current = null;
          }
          if (clientRef.current) {
            clientRef.current.removeAllListeners();
            await clientRef.current.leave();
            clientRef.current = null;
          }
        } catch (err) {
          console.error('Error cleaning up Agora client', err);
        }
      };

      cleanup();
    };
  }, [channelName]);

  const toggleMute = async () => {
    const track = localAudioTrackRef.current;
    if (!track) return;

    try {
      const next = !isMuted;
      // When "muted" is true, the track should be disabled
      await track.setEnabled(!next);
      setIsMuted(next);
    } catch (err) {
      console.error('Failed to toggle mute', err);
    }
  };

  const toggleVideo = async () => {
    const track = localVideoTrackRef.current;
    if (!track) return;

    try {
      const next = !isVideoOff;
      // When "isVideoOff" is true, the track should be disabled
      await track.setEnabled(!next);
      setIsVideoOff(next);
    } catch (err) {
      console.error('Failed to toggle video', err);
    }
  };

  const handleEndCall = async () => {
    try {
      if (localAudioTrackRef.current) {
        localAudioTrackRef.current.close();
        localAudioTrackRef.current = null;
      }
      if (localVideoTrackRef.current) {
        localVideoTrackRef.current.close();
        localVideoTrackRef.current = null;
      }
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        await clientRef.current.leave();
        clientRef.current = null;
      }
    } catch (err) {
      console.error('Error ending call', err);
    } finally {
      onClose();
    }
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-teal-950 to-slate-900 flex flex-col items-center justify-center overflow-hidden text-white">
      {/* Remote Video (Simulated for this frontend demo) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10"></div>

        <div className="text-center relative z-10">
          <div className="w-32 h-32 bg-white/10 backdrop-blur-md rounded-full mx-auto mb-6 flex items-center justify-center text-5xl font-bold shadow-2xl border border-white/20 text-teal-200">
            {otherUserName.charAt(0)}
          </div>
          <h3 className="text-3xl font-bold tracking-tight mb-2 text-white drop-shadow-md">{otherUserName}</h3>
          <p className={`text-lg font-medium tracking-wide ${status === 'Connected' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}>
            {status === 'Connected' ? formatDuration(duration) : status}
          </p>
          <p className="text-white/40 text-xs mt-2 uppercase tracking-widest font-semibold">End-to-End Encrypted</p>
        </div>

        {/* Animated background waves for active call */}
        {status === 'Connected' && (
          <>
            <div className="absolute w-[600px] h-[600px] bg-teal-500/10 rounded-full blur-[100px] animate-pulse"></div>
            <div className="absolute w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[80px] animate-pulse delay-75"></div>
          </>
        )}
      </div>

      {/* Local Video (Self View) */}
      <motion.div
        drag
        dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
        dragElastic={0.1}
        className="absolute top-6 right-6 w-36 h-52 md:w-48 md:h-72 bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-white/10 cursor-grab active:cursor-grabbing z-20 group ring-1 ring-black/20"
      >
        <video
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-500 ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
        />
        {isVideoOff && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-800">
            <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            </div>
            <span className="text-xs text-slate-400 font-medium">Camera Off</span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 text-white text-[10px] font-bold bg-black/40 px-2 py-1 rounded backdrop-blur-sm border border-white/10">
          You {isMuted && '(Muted)'}
        </div>
      </motion.div>

      {/* Controls Bar */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 flex items-center gap-6 bg-black/30 backdrop-blur-2xl p-4 px-8 rounded-full border border-white/10 shadow-2xl z-20">
        <button
          onClick={toggleMute}
          className={`p-4 rounded-full transition-all duration-300 ${isMuted ? 'bg-white text-slate-900 shadow-lg scale-110' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" stroke="currentColor" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
          )}
        </button>

        <button
          onClick={onClose}
          className="p-5 rounded-full bg-red-500 text-white hover:bg-red-600 shadow-xl shadow-red-500/40 scale-110 transform transition-all hover:scale-125 mx-4 border-4 border-transparent hover:border-red-400/30 bg-clip-padding"
          title="End Call"
        >
          <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C2.74 9.57 7.17 8 12 8c4.83 0 9.26 1.57 11.71 3.66.39.39.39 1.03 0 1.42l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.66-1.85.995.995 0 0 1-.57-.9v-3.1C15.15 9.25 13.6 9 12 9z" /></svg>
        </button>

        <button
          onClick={toggleVideo}
          className={`p-4 rounded-full transition-all duration-300 ${isVideoOff ? 'bg-white text-slate-900 shadow-lg scale-110' : 'bg-white/10 text-white hover:bg-white/20'}`}
          title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
        >
          {isVideoOff ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          )}
        </button>
      </div>
    </div>
  );
};
