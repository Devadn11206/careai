import React, { useEffect, useMemo, useRef, useState } from 'react';
import AgoraRTC, { IAgoraRTCClient, ILocalAudioTrack, ILocalVideoTrack } from 'agora-rtc-sdk-ng';
import { Button } from './ui/Button';
import { BackendAPI } from '../services/apiClient';
import { ConsultationSummary, UserRole } from '../types';

interface VideoCallProps {
  appointmentId: string;
  otherUserName: string;
  currentUserRole?: UserRole;
  onClose: () => void;
}

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export const VideoCall: React.FC<VideoCallProps> = ({ appointmentId, otherUserName, currentUserRole, onClose }) => {
  const appId = (import.meta as any).env?.VITE_AGORA_APP_ID as string | undefined;
  const channelName = useMemo(() => `carexai-${appointmentId}`.replace(/[^a-zA-Z0-9_-]/g, '-'), [appointmentId]);
  const localVideoRef = useRef<HTMLDivElement | null>(null);
  const remoteVideoRef = useRef<HTMLDivElement | null>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTracksRef = useRef<[ILocalAudioTrack, ILocalVideoTrack] | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const [status, setStatus] = useState('Initializing secure video...');
  const [error, setError] = useState<string | null>(null);

  const [speechSupported, setSpeechSupported] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');

  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [generatedSummary, setGeneratedSummary] = useState<ConsultationSummary | null>(null);

  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false);

  const isDoctor = currentUserRole === UserRole.DOCTOR;

  useEffect(() => {
    const ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setSpeechSupported(!!ctor);
  }, []);

  const stopTranscription = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsTranscribing(false);
  };

  const startTranscription = () => {
    if (!isDoctor) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) {
      setSpeechError('Speech recognition is not supported in this browser.');
      return;
    }

    if (!recognitionRef.current) {
      const recognition: BrowserSpeechRecognition = new Ctor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        let finalChunk = '';
        let interimChunk = '';

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const segment = event.results[i]?.[0]?.transcript || '';
          if (event.results[i].isFinal) finalChunk += `${segment} `;
          else interimChunk += segment;
        }

        if (finalChunk.trim()) {
          setTranscript((prev) => `${prev}${finalChunk}`.trim());
        }
        setInterimTranscript(interimChunk.trim());
      };

      recognition.onerror = (event: any) => {
        const msg = event?.error ? `Speech recognition error: ${event.error}` : 'Speech recognition failed.';
        setSpeechError(msg);
      };

      recognition.onend = () => {
        setIsTranscribing(false);
      };

      recognitionRef.current = recognition;
    }

    try {
      setSpeechError(null);
      recognitionRef.current.start();
      setIsTranscribing(true);
    } catch (err: any) {
      setSpeechError(err?.message || 'Unable to start speech recognition.');
    }
  };

  const handleGenerateSummary = async () => {
    if (!isDoctor) return;
    const finalTranscript = `${transcript} ${interimTranscript}`.trim();
    if (finalTranscript.length < 20) {
      setSpeechError('Transcript is too short. Capture more conversation before generating summary.');
      return;
    }

    try {
      setIsGeneratingSummary(true);
      setSpeechError(null);
      const summary = await BackendAPI.generateConsultationSummary({
        appointmentId,
        transcript: finalTranscript,
      });
      setGeneratedSummary(summary);
    } catch (err: any) {
      setSpeechError(err?.message || 'Failed to generate AI summary.');
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const toggleVideo = async () => {
    if (localTracksRef.current && localTracksRef.current[1]) {
      const videoTrack = localTracksRef.current[1];
      const newState = !isVideoEnabled;
      await videoTrack.setEnabled(newState);
      setIsVideoEnabled(newState);
    }
  };

  const toggleAudio = async () => {
    if (localTracksRef.current && localTracksRef.current[0]) {
      const audioTrack = localTracksRef.current[0];
      const newState = !isAudioEnabled;
      await audioTrack.setEnabled(newState);
      setIsAudioEnabled(newState);
    }
  };

  const toggleLowBandwidth = async () => {
    if (localTracksRef.current && localTracksRef.current[1]) {
      const videoTrack = localTracksRef.current[1];
      const newState = !isLowBandwidthMode;
      
      try {
        if (newState) {
          // Drop resolution and bitrate heavily for low bandwidth
          await videoTrack.setEncoderConfiguration({ width: 320, height: 240, frameRate: 15, bitrateMax: 150 });
        } else {
          // Restore to standard/higher resolution
          await videoTrack.setEncoderConfiguration({ width: 640, height: 480, frameRate: 30 });
        }
        setIsLowBandwidthMode(newState);
      } catch (err) {
        console.error("Failed to set encoder configuration", err);
      }
    }
  };

  useEffect(() => {
    let disposed = false;

    const startCall = async () => {
      if (!appId) {
        setError('Agora is not configured. Please set VITE_AGORA_APP_ID in frontend environment.');
        return;
      }

      try {
        setStatus('Requesting secure access token...');
        const uid = Math.floor(Math.random() * 1_000_000_000);
        const { token } = await BackendAPI.getAgoraToken({ channelName, uid });

        if (disposed) return;

        const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
        clientRef.current = client;

        client.on('user-published', async (remoteUser, mediaType) => {
          await client.subscribe(remoteUser, mediaType);
          if (mediaType === 'video' && remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = '';
            remoteUser.videoTrack?.play(remoteVideoRef.current);
          }
          if (mediaType === 'audio') {
            remoteUser.audioTrack?.play();
          }
          setStatus(`${otherUserName} joined the consultation.`);
        });

        client.on('user-unpublished', () => {
          if (remoteVideoRef.current) {
            remoteVideoRef.current.innerHTML = '';
          }
          setStatus(`Waiting for ${otherUserName} to join...`);
        });

        setStatus('Joining consultation room...');
        await client.join(appId, channelName, token, uid);

        setStatus('Starting camera and microphone...');
        const tracks = await AgoraRTC.createMicrophoneAndCameraTracks();
        localTracksRef.current = tracks;

        if (localVideoRef.current) {
          localVideoRef.current.innerHTML = '';
          tracks[1].play(localVideoRef.current);
        }

        await client.publish(tracks);
        setStatus(`Connected. Waiting for ${otherUserName}...`);
      } catch (err: any) {
        console.error('Failed to start video consultation', err);
        setError(err?.message || 'Failed to start video consultation.');
      }
    };

    startCall();

    return () => {
      disposed = true;
      stopTranscription();
      const cleanup = async () => {
        try {
          const tracks = localTracksRef.current;
          if (tracks) {
            tracks[0].stop();
            tracks[0].close();
            tracks[1].stop();
            tracks[1].close();
            localTracksRef.current = null;
          }
          if (clientRef.current) {
            await clientRef.current.leave();
            clientRef.current.removeAllListeners();
            clientRef.current = null;
          }
        } catch (cleanupErr) {
          console.error('Video call cleanup failed', cleanupErr);
        }
      };
      cleanup();
    };
  }, [appId, channelName, otherUserName]);

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-4xl rounded-3xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <div>
            <h2 className="text-lg font-bold">Video Consultation</h2>
            <p className="text-xs text-slate-400">Appointment: {appointmentId}</p>
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-700 bg-slate-800/50 aspect-video overflow-hidden">
              <div ref={remoteVideoRef} className="w-full h-full" />
            </div>
            <div className="rounded-2xl border border-slate-700 bg-slate-800/70 aspect-video overflow-hidden">
              <div ref={localVideoRef} className="w-full h-full" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3">
            <p className="text-sm font-semibold">{status}</p>
            {error && <p className="text-xs text-rose-300 mt-1">{error}</p>}
          </div>

          {isDoctor && (
            <div className="rounded-xl border border-slate-700 bg-slate-800/40 p-4 space-y-3">
              <div className="flex flex-wrap gap-2">
                {!isTranscribing ? (
                  <Button variant="outline" onClick={startTranscription}>
                    Start Speech Capture
                  </Button>
                ) : (
                  <Button variant="outline" onClick={stopTranscription}>
                    Stop Speech Capture
                  </Button>
                )}
                <Button variant="secondary" onClick={handleGenerateSummary} isLoading={isGeneratingSummary}>
                  Generate AI Summary
                </Button>
              </div>
              {!speechSupported && (
                <p className="text-xs text-amber-300">Speech recognition is not available in this browser. Use Chrome/Edge for in-call transcription.</p>
              )}
              {speechError && <p className="text-xs text-rose-300">{speechError}</p>}
              <div className="rounded-lg bg-slate-900/70 border border-slate-700 p-3 min-h-[88px] max-h-40 overflow-y-auto">
                <p className="text-[11px] text-slate-400 mb-1">Transcript</p>
                <p className="text-xs whitespace-pre-wrap text-slate-200">{`${transcript} ${interimTranscript}`.trim() || 'No transcript yet.'}</p>
              </div>
              {generatedSummary && (
                <div className="rounded-lg bg-emerald-950/30 border border-emerald-700/40 p-3 space-y-1">
                  <p className="text-xs font-bold text-emerald-300">AI Consultation Summary Saved</p>
                  <p className="text-xs text-slate-200"><span className="font-semibold">Symptoms:</span> {generatedSummary.symptoms}</p>
                  <p className="text-xs text-slate-200"><span className="font-semibold">Possible condition:</span> {generatedSummary.possibleCondition}</p>
                  <p className="text-xs text-slate-200"><span className="font-semibold">Recommendations:</span> {generatedSummary.recommendations}</p>
                  <p className="text-[10px] text-amber-300">AI-generated assistive summary only. Not a medical diagnosis.</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-800/80 p-4 rounded-xl border border-slate-700 gap-4">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center md:justify-start">
              <Button 
                variant={isVideoEnabled ? "primary" : "secondary"} 
                onClick={toggleVideo}
                className={!isVideoEnabled ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30" : ""}
              >
                {isVideoEnabled ? '📹 Camera On' : '🚫 Camera Off (Voice Only)'}
              </Button>
              <Button 
                variant={isAudioEnabled ? "primary" : "secondary"} 
                onClick={toggleAudio}
                className={!isAudioEnabled ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30" : ""}
              >
                {isAudioEnabled ? '🎙️ Mic On' : '🔇 Mic Muted'}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-center md:justify-end">
              <Button 
                variant={isLowBandwidthMode ? "neon" : "outline"} 
                onClick={toggleLowBandwidth}
                className={isLowBandwidthMode ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]" : ""}
              >
                {isLowBandwidthMode ? '⚡ Low Bandwidth: ON' : '📶 Low Bandwidth: OFF'}
              </Button>
              <Button variant="secondary" onClick={onClose} className="bg-red-500/10 text-red-400 hover:bg-red-500/20 border-red-500/30">End Call</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
