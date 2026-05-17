import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { BackendAPI } from '@/services/apiClient';
import { Hospital } from '@/types';
import { 
  Activity, 
  Shield, 
  Radio, 
  HeartPulse, 
  Zap, 
  Navigation, 
  Layers, 
  Eye, 
  EyeOff,
  AlertTriangle,
  Crosshair,
  Map as MapIcon
} from 'lucide-react';
import { 
  generateDemoHospitals, 
  generateDemoDoctors, 
  generateDemoAmbulances, 
  generateDemoEmergencies, 
  generateDemoRiskZones 
} from '@/services/demoDataGenerator';

// --- Custom Markers ---
const createPulseIcon = (color: string, size = 20, isEmergency = false) => L.divIcon({
  className: 'custom-pulse-icon',
  html: `<div class="pulse-container" style="width: ${size}px; height: ${size}px;">
           <div class="pulse-ring ${isEmergency ? 'emergency-ring' : ''}" style="border-color: ${color}"></div>
           <div class="pulse-dot" style="background-color: ${color}; width: ${size/2.5}px; height: ${size/2.5}px; top: ${size/3.3}px; left: ${size/3.3}px;"></div>
         </div>`,
  iconSize: [size, size],
  iconAnchor: [size/2, size/2]
});

const hospitalIcon = (status: string) => {
  const color = status === 'CRITICAL' ? '#ff006e' : status === 'BUSY' ? '#f59e0b' : '#00ff9f';
  return L.divIcon({
    className: 'custom-indicator',
    html: `<div class="indicator-bg border border-white/20 flex items-center justify-center rounded-lg shadow-2xl pulse-glow" style="background: ${color}22; color: ${color}; box-shadow: 0 0 20px ${color}55;">
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
           </div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const ambulanceIcon = L.divIcon({
  className: 'ambulance-marker',
  html: `<div class="w-10 h-10 bg-blue-500 rounded-xl border-2 border-white/50 flex items-center justify-center shadow-[0_0_25px_rgba(59,130,246,0.8)] animate-bounce-subtle">
           <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10l-2 2-2-2"/><path d="M14 14l2-2 2 2"/><path d="M21 15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M7 7h10"/><path d="M9 17v1"/><path d="M15 17v1"/></svg>
         </div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20]
});

interface AdminCommandMapProps {
  className?: string;
}

export const AdminCommandMap: React.FC<AdminCommandMapProps> = ({ className }) => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [emergencies, setEmergencies] = useState<any[]>([]);
  const [ambulances, setAmbulances] = useState<any[]>([]);
  const [riskZones, setRiskZones] = useState<any[]>([]);
  const [intelligenceFeed, setIntelligenceFeed] = useState<any[]>([]);
  const [center] = useState<[number, number]>([17.3850, 78.4867]); 
  
  // Layer Visibility
  const [layers, setLayers] = useState({
    hospitals: true,
    doctors: true,
    emergencies: true,
    ambulances: true,
    riskZones: true
  });

  const [isSyncing, setIsSyncing] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsSyncing(true);
        const [h, d, e, a, r] = await Promise.all([
          BackendAPI.get('/api/hospitals/live'),
          BackendAPI.get('/api/doctors/live'),
          BackendAPI.get('/api/emergencies/live'),
          BackendAPI.get('/api/ambulances/live'),
          BackendAPI.get('/api/analytics/risk-zones')
        ]);

        // Fallback Logic: If APIs return empty, use Demo Data
        const finalHospitals = h && h.length > 0 ? h : generateDemoHospitals(center[0], center[1]).map((hosp, i) => ({
          ...hosp,
          name: ["CareX Central Trauma", "Apollo Nexus", "MedCore Emergency", "NeuroLife Institute", "CityCare Medical", "AI Health Grid"][i] || hosp.name
        }));
        
        setHospitals(finalHospitals);
        setDoctors(d && d.length > 0 ? d : generateDemoDoctors(center[0], center[1]));
        setEmergencies(e && e.length > 0 ? e : generateDemoEmergencies(center[0], center[1]));
        setAmbulances(a && a.length > 0 ? a : generateDemoAmbulances(center[0], center[1]));
        setRiskZones(r && r.length > 0 ? r : generateDemoRiskZones(center[0], center[1]));

        // Generate Demo Intelligence Feed
        setIntelligenceFeed([
          { id: 1, type: 'CRITICAL', msg: 'Emergency escalation at CareX Central', time: 'LIVE' },
          { id: 2, type: 'ANOMALY', msg: 'AI anomaly detected in Zone 3', time: '2m ago' },
          { id: 3, type: 'LOAD', msg: 'ICU load exceeds 82% at Apollo Nexus', time: '5m ago' },
          { id: 4, type: 'ROUTE', msg: 'Ambulance AX-01 rerouted to Trauma Center', time: '8m ago' },
        ]);

      } catch (error) {
        console.error('Failed to fetch command map data', error);
      } finally {
        setIsSyncing(false);
      }
    };

    fetchData();

    // Simulation: Move Ambulances every 3 seconds
    const interval = setInterval(() => {
      setAmbulances(prev => prev.map(amb => ({
        ...amb,
        latitude: amb.latitude + (Math.random() - 0.5) * 0.002,
        longitude: amb.longitude + (Math.random() - 0.5) * 0.002
      })));
    }, 3000);

    const socket = BackendAPI.getSocket();
    if (socket) {
      socket.on('hospital_status_updated', (h: Hospital) => {
        setHospitals(prev => prev.map(item => item.id === h.id ? h : item));
      });
      socket.on('emergency_created', (e: any) => {
        setEmergencies(prev => [e, ...prev]);
        setIntelligenceFeed(prev => [{ id: Date.now(), type: 'EMERGENCY', msg: `New ${e.type} reported`, time: 'JUST NOW' }, ...prev.slice(0, 5)]);
      });
      socket.on('ambulance_location_updated', (a: any) => {
        setAmbulances(prev => prev.map(item => item.id === a.id ? a : item));
      });
    }

    return () => {
      clearInterval(interval);
      if (socket) {
        socket.off('hospital_status_updated');
        socket.off('emergency_created');
        socket.off('ambulance_location_updated');
      }
    };
  }, [center]);

  return (
    <div className={`relative h-[750px] rounded-[40px] overflow-hidden border border-white/10 bg-space-950 shadow-3xl ${className}`}>
      <style>{`
        .leaflet-container { background: #05060a !important; font-family: 'Space Grotesk', sans-serif; cursor: crosshair !important; }
        .pulse-container { position: relative; }
        .pulse-ring { 
          position: absolute; border: 2px solid; border-radius: 50%; height: 100%; width: 100%; 
          animation: pulse 2.5s cubic-bezier(0.24, 0, 0.38, 1) infinite; 
        }
        .emergency-ring { animation: pulse 1s cubic-bezier(0.24, 0, 0.38, 1) infinite !important; border-width: 3px; }
        .pulse-dot { 
          position: absolute; border-radius: 50%; 
          box-shadow: 0 0 20px currentColor;
        }
        @keyframes pulse {
          0% { transform: scale(0.3); opacity: 0.8; }
          100% { transform: scale(3.5); opacity: 0; }
        }
        .indicator-bg { width: 32px; height: 32px; backdrop-filter: blur(12px); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
        .pulse-glow { animation: glow 2s ease-in-out infinite alternate; }
        @keyframes glow {
          from { filter: brightness(1) drop-shadow(0 0 5px currentColor); }
          to { filter: brightness(1.5) drop-shadow(0 0 20px currentColor); }
        }
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
        .animate-bounce-subtle { animation: bounce-subtle 2s infinite; }
        .custom-popup .leaflet-popup-content-wrapper { 
          background: rgba(5, 6, 10, 0.95) !important; 
          border: 1px solid rgba(255, 255, 255, 0.15) !important;
          backdrop-filter: blur(30px) !important;
          color: white !important;
          border-radius: 24px !important;
          padding: 4px !important;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5) !important;
        }
        .custom-popup .leaflet-popup-tip { background: rgba(5, 6, 10, 0.95) !important; }
      `}</style>
      
      <MapContainer 
        center={center} 
        zoom={13} 
        className="h-full w-full"
        zoomControl={false}
      >
        <TileLayer
          url="https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=G2sBakBtczL0LsNvVo0n"
          attribution='&copy; MapTiler'
        />

        {/* AI Risk Zones */}
        {layers.riskZones && riskZones.map((zone, i) => (
          <Circle
            key={`risk-${zone.id}`}
            center={[zone.lat, zone.lng]}
            radius={zone.radius || 600}
            pathOptions={{
              fillColor: zone.level === 'CRITICAL' ? '#ff006e' : zone.level === 'ELEVATED' ? '#f59e0b' : '#00ff9f',
              fillOpacity: 0.15,
              color: zone.level === 'CRITICAL' ? '#ff006e' : 'transparent',
              weight: 2,
              dashArray: '5, 10'
            }}
          />
        ))}

        {/* Emergencies */}
        {layers.emergencies && emergencies.map((e: any) => (
          <Marker 
            key={e.id} 
            position={[e.latitude, e.longitude]} 
            icon={createPulseIcon('#ff006e', 45, true)}
          >
            <Popup className="custom-popup">
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-3 text-pulse-400">
                  <div className="p-2 bg-pulse-500/20 rounded-lg animate-pulse">
                    <HeartPulse size={20} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70">Active Crisis</p>
                    <p className="text-lg font-bold text-white tracking-tight">{e.type}</p>
                  </div>
                </div>
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Risk Level</p>
                  <p className="text-sm font-bold text-pulse-400">CRITICAL ESCALATION</p>
                </div>
                <button className="w-full h-10 bg-pulse-500 hover:bg-pulse-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Dispatch Nexus Unit</button>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Hospitals */}
        {layers.hospitals && hospitals.map((h: any) => h.location && (
          <Marker 
            key={h.id} 
            position={[h.location.latitude, h.location.longitude]} 
            icon={hospitalIcon(h.activePatients > 80 ? 'CRITICAL' : h.activePatients > 50 ? 'BUSY' : 'NORMAL')}
          >
            <Popup className="custom-popup">
              <div className="p-4 min-w-[240px] space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-white font-orbitron">{h.name}</h3>
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${h.emergencyStatus ? 'bg-pulse-500 text-white animate-pulse' : 'bg-bio-500/20 text-bio-400'}`}>
                    {h.emergencyStatus ? 'Crisis' : 'Stable'}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">Occupancy</p>
                    <p className="text-xl font-bold text-white">{h.activePatients}%</p>
                    <div className="h-1 w-full bg-white/10 rounded-full mt-2 overflow-hidden">
                      <div className={`h-full ${h.activePatients > 80 ? 'bg-pulse-500' : 'bg-bio-400'}`} style={{ width: `${h.activePatients}%` }} />
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1">ICU Load</p>
                    <p className="text-xl font-bold text-neon-400">{Math.floor(h.activePatients * 0.8)}%</p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 pt-2 border-t border-white/5">
                  <span>ACTIVE DOCTORS</span>
                  <span className="text-white">12 Available</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Ambulances */}
        {layers.ambulances && ambulances.map((a: any) => (
          <Marker 
            key={a.id} 
            position={[a.latitude, a.longitude]} 
            icon={ambulanceIcon}
          >
            <Popup className="custom-popup">
              <div className="p-3 min-w-[180px]">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400">
                    <Navigation size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Ambulance</p>
                    <p className="text-sm font-bold text-white">{a.plateNumber}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">STATUS</span>
                    <span className="text-blue-400">{a.status}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500">SPEED</span>
                    <span className="text-white">{Math.floor(a.speed || 65)} km/h</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Doctors */}
        {layers.doctors && doctors.map((d: any) => d.latitude && (
          <Marker 
            key={d.id} 
            position={[d.latitude, d.longitude]} 
            icon={createPulseIcon('#00d4ff', 24)}
          >
            <Popup className="custom-popup">
              <div className="p-3 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-space-950 border border-white/10 flex items-center justify-center font-bold text-lg text-neon-400 shadow-neon">
                  {d.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{d.name}</p>
                  <p className="text-[10px] text-neon-400 font-black uppercase tracking-widest">{d.specialization}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-bio-400 animate-pulse" />
                    <span className="text-[9px] font-bold text-slate-500 uppercase">Online</span>
                  </div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Control Overlays */}
      <div className="absolute top-8 left-8 z-[1000] flex flex-col gap-4 pointer-events-none">
        {/* Layer Toggles */}
        <div className="glass-card-dark border border-white/10 p-2 rounded-[24px] shadow-3xl backdrop-blur-3xl pointer-events-auto flex flex-col gap-1">
          {[
            { key: 'hospitals', icon: HeartPulse, color: 'text-bio-400' },
            { key: 'doctors', icon: Activity, color: 'text-neon-400' },
            { key: 'ambulances', icon: Navigation, color: 'text-blue-400' },
            { key: 'emergencies', icon: AlertTriangle, color: 'text-pulse-400' },
            { key: 'riskZones', icon: Crosshair, color: 'text-purple-400' }
          ].map((layer) => (
            <button
              key={layer.key}
              onClick={() => setLayers(prev => ({ ...prev, [layer.key]: !prev[layer.key] }))}
              className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all ${
                layers[layer.key as keyof typeof layers] 
                  ? 'bg-white/10 ' + layer.color 
                  : 'bg-transparent text-slate-600 grayscale hover:grayscale-0'
              }`}
            >
              <layer.icon size={18} />
            </button>
          ))}
        </div>

        {/* Telemetry */}
        <div className="glass-card-dark border border-white/10 p-6 rounded-[32px] shadow-3xl backdrop-blur-3xl min-w-[260px] pointer-events-auto border-l-4 border-l-neon-400">
          <div className="flex items-center gap-3 mb-5">
            <Radio size={16} className="text-neon-400 animate-pulse" />
            <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">Command Telemetry</h4>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center group">
              <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">HEALTH NODES</span>
              <span className="text-xs font-black text-white font-mono">{hospitals.length + doctors.length}</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">ACTIVE CRISES</span>
              <span className="text-xs font-black text-pulse-400 font-mono animate-pulse">{emergencies.length}</span>
            </div>
            <div className="flex justify-between items-center group">
              <span className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">AMBULANCES</span>
              <span className="text-xs font-black text-blue-400 font-mono">{ambulances.length}</span>
            </div>
            <div className="pt-3 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">AI Confidence</span>
                <span className="text-[10px] font-black text-bio-400">98.4%</span>
              </div>
              <div className="h-1 w-full bg-white/5 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-bio-400 shadow-[0_0_10px_#00ff9f]" style={{ width: '98.4%' }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Intelligence Feed */}
      <div className="absolute top-8 right-8 bottom-8 z-[1000] w-80 pointer-events-none">
        <div className="h-full glass-card-dark border border-white/10 rounded-[40px] shadow-3xl backdrop-blur-3xl flex flex-col pointer-events-auto overflow-hidden">
          <div className="p-8 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-white flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-neon-400 animate-ping" />
              Intelligence Feed
            </h4>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neon-400/10 border border-neon-400/30 text-[8px] font-black uppercase text-neon-400">
              Live
            </div>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
            {intelligenceFeed.map(item => (
              <div key={item.id} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all group">
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-[8px] font-black px-2 py-0.5 rounded-md tracking-tighter ${
                    item.type === 'CRITICAL' ? 'bg-pulse-500/20 text-pulse-400' :
                    item.type === 'ANOMALY' ? 'bg-purple-500/20 text-purple-400' :
                    'bg-neon-400/20 text-neon-400'
                  }`}>{item.type}</span>
                  <span className="text-[9px] text-slate-600 font-bold uppercase">{item.time}</span>
                </div>
                <p className="text-xs font-bold text-white group-hover:text-neon-400 transition-colors leading-relaxed">
                  {item.msg}
                </p>
              </div>
            ))}
          </div>
          <div className="p-6 bg-white/[0.02] border-t border-white/5">
             <button className="w-full h-12 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 transition-all flex items-center justify-center gap-3">
               <Radio size={14} /> Full Grid Archive
             </button>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="absolute bottom-8 left-8 z-[1000]">
        <div className="bg-black/90 backdrop-blur-3xl border border-white/10 px-6 py-3 rounded-2xl flex items-center gap-4 shadow-3xl">
          <div className="relative">
            <Zap size={14} className="text-neon-400" />
            <div className="absolute inset-0 text-neon-400 animate-ping opacity-50"><Zap size={14} /></div>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-white tracking-widest">NEXUS GRID ACTIVE</span>
            <span className="text-[8px] text-slate-500 font-bold uppercase">Telemetry link established</span>
          </div>
        </div>
      </div>
      
      {/* Map Branding */}
      <div className="absolute bottom-8 right-96 z-[1000]">
        <div className="flex flex-col items-end opacity-40">
          <h2 className="text-2xl font-black text-white font-orbitron tracking-tighter">CAREXAI</h2>
          <p className="text-[8px] text-white font-black uppercase tracking-[0.5em]">Command Division</p>
        </div>
      </div>
    </div>
  );
};
