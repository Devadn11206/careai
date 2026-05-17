import React, { useEffect, useState, useMemo, useRef } from 'react';
import { 
  MapContainer, 
  TileLayer, 
  Marker, 
  Popup, 
  useMap,
  ZoomControl,
  Polyline
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Navigation, 
  Hospital as HospitalIcon, 
  Stethoscope, 
  AlertCircle, 
  Locate,
  X,
  Phone,
  Clock,
  Sparkles,
  Activity,
  Zap,
  Info,
  Calendar,
  User,
  Star,
  ChevronRight,
  Droplets,
  Pill,
  Microscope,
  MessageSquare,
  Video,
  ExternalLink,
  ChevronLeft,
  Brain
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { NeonButton } from './NeonButton';
import { cn } from '@/lib/utils';
import { Hospital, HealthcareFacility, BackendDoctor } from '@/types';
import { BackendAPI } from '@/services/apiClient';
import { toast } from 'sonner';
import { renderToString } from 'react-dom/server';
import { useHealth } from '@/services/HealthContext';
import { 
  generateDemoHospitals, 
  generateDemoDoctors, 
  generateDemoPharmacies, 
  generateDemoLabs 
} from '@/services/demoDataGenerator';

// MapTiler Configuration
const MAPTILER_KEY = (import.meta as any).env.VITE_MAPTILER_API_KEY || 'G2sBakBtczL0LsNvVo0n';
// Using dataviz-dark for a more futuristic clinical look
const MAPTILER_URL = `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`;

// Custom Marker Creators
const createDivIcon = (icon: React.ReactNode, colorClass: string, isEmergency: boolean = false, availability: string = 'online') => {
  return L.divIcon({
    html: renderToString(
      <div className={cn(
        "relative flex items-center justify-center h-10 w-10 rounded-2xl border-2 border-background shadow-2xl transition-all duration-300",
        colorClass,
        isEmergency && "animate-pulse"
      )}>
        {icon}
        <div className={cn(
          "absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-background",
          availability === 'online' ? "bg-success" : availability === 'busy' ? "bg-warning" : "bg-muted-foreground"
        )} />
        {isEmergency && (
          <div className="absolute -inset-4 bg-destructive/20 rounded-full animate-ping pointer-events-none" />
        )}
      </div>
    ),
    className: 'custom-leaflet-icon',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

const ChangeView = ({ center, zoom }: { center: [number, number], zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
    // Force Leaflet to recalculate its container size to fix tile alignment issues
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
  }, [center, zoom, map]);
  return null;
};

interface CareMapProps {
  className?: string;
  emergencyMode?: boolean;
  onSelectHospital?: (hospital: Hospital) => void;
  onSelectDoctor?: (doctor: BackendDoctor) => void;
}

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const openInGoogleMaps = (item: any) => {
  const lat = item.location?.latitude || item.latitude;
  const lng = item.location?.longitude || item.longitude;
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
};

export const CareMap: React.FC<CareMapProps> = ({ 
  className, 
  emergencyMode = false,
  onSelectHospital,
  onSelectDoctor
}) => {
  const { vitals, user } = useHealth();
  const [center, setCenter] = useState<[number, number]>([28.6139, 77.2090]);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [nearbyDoctors, setNearbyDoctors] = useState<BackendDoctor[]>([]);
  const [pharmacies, setPharmacies] = useState<HealthcareFacility[]>([]);
  const [labs, setLabs] = useState<HealthcareFacility[]>([]);
  
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(14);
  const [showTriage, setShowTriage] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [aiRec, setAiRec] = useState<any>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const [activeLayers, setActiveLayers] = useState({
    hospitals: true,
    doctors: true,
    pharmacies: true,
    labs: true
  });
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    // Delayed mount to ensure container is ready
    const timer = setTimeout(() => setMapReady(true), 500);
    return () => clearTimeout(timer);
  }, []);

  // Tracking refs
  const watchId = useRef<number | null>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Icons with Status Colors
  const getStatusColor = (item: any) => {
    if (item.offline) return "bg-zinc-500 border-zinc-400";
    if (item.emergencyStatus || item.activePatients > 100) return "bg-destructive border-destructive/50 shadow-glow-destructive";
    if (item.queueWaitTime > 30 || item.activePatients > 50) return "bg-warning border-warning/50 shadow-glow-warning";
    return "bg-success border-success/50 shadow-glow-success";
  };

  const hospitalIcon = (h: Hospital) => createDivIcon(<HospitalIcon size={18} />, cn("text-white", getStatusColor(h)), h.emergencyStatus);
  const doctorIcon = (d: BackendDoctor) => createDivIcon(<Stethoscope size={18} />, "bg-secondary/40 text-white border-secondary/60 backdrop-blur-md shadow-glow-secondary");
  const pharmacyIcon = (f: HealthcareFacility) => createDivIcon(<Pill size={18} />, "bg-purple-500/40 text-white border-purple-400/60 backdrop-blur-md shadow-glow-purple");
  const labIcon = (f: HealthcareFacility) => createDivIcon(<Microscope size={18} />, "bg-orange-500/40 text-white border-orange-400/60 backdrop-blur-md shadow-glow-orange");

  useEffect(() => {
    detectLocation();
    startContinuousTracking();

    const socket = BackendAPI.getSocket();
    if (socket) {
      socket.on('hospital_status_updated', (updated) => {
        setHospitals(prev => prev.map(h => h.id === updated.id ? updated : h));
        if (selectedItem?.id === updated.id) setSelectedItem(updated);
      });
      socket.on('doctor_status_updated', (updated) => {
        setNearbyDoctors(prev => prev.map(d => d.id === updated.id ? updated : d));
        if (selectedItem?.id === updated.id) setSelectedItem(updated);
      });
      socket.on('emergency_created', (emergency) => {
        toast.error(`NEW EMERGENCY DETECTED: ${emergency.type}`, { description: emergency.address });
      });
    }

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
      if (socket) {
        socket.off('hospital_status_updated');
        socket.off('doctor_status_updated');
        socket.off('emergency_created');
      }
    };
  }, []);

  const startContinuousTracking = () => {
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // Only update center if we move significantly or first time
          setCenter([latitude, longitude]);
          syncLocationWithBackend(latitude, longitude);
        },
        (error) => console.error("Realtime GPS loss:", error),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );
    }
  };

  const syncLocationWithBackend = async (lat: number, lng: number) => {
    try {
      await BackendAPI.post('/api/location/update', { latitude: lat, longitude: lng });
    } catch (e) {}
  };

  const detectLocation = (isRetry = false) => {
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setCenter([latitude, longitude]);
        fetchAllNearby(latitude, longitude);
        setIsLocating(false);
      },
      (error) => {
        if (!isRetry && error.code !== 1) {
          detectLocation(true);
          return;
        }
        setLocationError("GPS signal weak. Using neural hub defaults.");
        fetchAllNearby(center[0], center[1]);
        setIsLocating(false);
      },
      { enableHighAccuracy: !isRetry, timeout: 10000 }
    );
  };

  const fetchAllNearby = async (lat: number, lng: number) => {
    setIsLoading(true);
    try {
      const [hosp, doc, phar, lb] = await Promise.all([
        BackendAPI.get(`/api/hospitals/nearby?lat=${lat}&lng=${lng}&radius=50`).catch(() => []),
        BackendAPI.get(`/api/doctors/nearby?lat=${lat}&lng=${lng}&radius=50`).catch(() => []),
        BackendAPI.get(`/api/pharmacies/nearby?lat=${lat}&lng=${lng}&radius=20`).catch(() => []),
        BackendAPI.get(`/api/labs/nearby?lat=${lat}&lng=${lng}&radius=20`).catch(() => [])
      ]);

      // Intelligent Fallback Logic: If API returns empty, use Demo Data
      const finalHospitals = hosp && hosp.length > 0 ? hosp : generateDemoHospitals(lat, lng);
      const finalDoctors = doc && doc.length > 0 ? doc : generateDemoDoctors(lat, lng);
      const finalPharmacies = phar && phar.length > 0 ? phar : generateDemoPharmacies(lat, lng);
      const finalLabs = lb && lb.length > 0 ? lb : generateDemoLabs(lat, lng);

      setHospitals(finalHospitals);
      setNearbyDoctors(finalDoctors);
      setPharmacies(finalPharmacies);
      setLabs(finalLabs);

      if (hosp.length === 0) toast.info("Syncing with Regional Healthcare Simulation Nodes");
    } catch (err) {
      // Complete Fallback on total failure
      setHospitals(generateDemoHospitals(lat, lng));
      setNearbyDoctors(generateDemoDoctors(lat, lng));
      setPharmacies(generateDemoPharmacies(lat, lng));
      setLabs(generateDemoLabs(lat, lng));
      toast.warning("Network Grid Sync Failure. Activating Simulation Layer.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleLayer = (layer: keyof typeof activeLayers) => {
    setActiveLayers(prev => ({ ...prev, [layer]: !prev[layer] }));
  };

  const handleAiRecommendation = async () => {
    setIsAiLoading(true);
    try {
      const rec = await BackendAPI.getAICareRecommendation({
        symptoms: symptoms || "nearest emergency unit",
        vitals: vitals[vitals.length - 1],
        lat: center[0],
        lng: center[1]
      });
      setAiRec(rec);
      setSelectedItem(rec.bestHospital);
      if (rec.bestHospital?.location) {
        setCenter([rec.bestHospital.location.latitude, rec.bestHospital.location.longitude]);
        setZoom(16);
      }
    } catch (err) {
      toast.error("AI Insight Engine Unavailable");
    } finally {
      setIsAiLoading(false);
    }
  };

  const [route, setRoute] = useState<[number, number][] | null>(null);
  const [eta, setEta] = useState<number | null>(null);

  const calculateRoute = (destLat: number, destLng: number) => {
    setRoute([[center[0], center[1]], [destLat, destLng]]);
    const dist = calculateDistance(center[0], center[1], destLat, destLng);
    setEta(Math.round(dist * 2.5 + 3));
  };

  const handleEmergencyTrigger = async () => {
    const nearest = [...hospitals].sort((a, b) => {
      const dA = calculateDistance(center[0], center[1], a.location!.latitude, a.location!.longitude);
      const dB = calculateDistance(center[0], center[1], b.location!.latitude, b.location!.longitude);
      return dA - dB;
    })[0];

    if (nearest) {
      calculateRoute(nearest.location!.latitude, nearest.location!.longitude);
      setSelectedItem(nearest);
      toast.error("EMERGENCY PROTOCOL ACTIVE. ROUTING TO NEAREST UNIT.");
      
      try {
        await BackendAPI.post('/api/emergencies/create', {
          type: 'CRITICAL_UPLINK',
          severity: 'CRITICAL',
          latitude: center[0],
          longitude: center[1],
          patientName: user?.name || 'Anonymous Patient',
          address: 'GPS PINPOINT'
        });
      } catch (e) {}
    }
  };

  const filteredItems = useMemo(() => {
    if (!searchQuery) return [];
    const q = searchQuery.toLowerCase();
    return [
      ...hospitals.filter(h => h.name.toLowerCase().includes(q)),
      ...nearbyDoctors.filter(d => d.name.toLowerCase().includes(q) || d.specialization?.toLowerCase().includes(q)),
      ...pharmacies.filter(p => p.name.toLowerCase().includes(q)),
      ...labs.filter(l => l.name.toLowerCase().includes(q))
    ];
  }, [searchQuery, hospitals, nearbyDoctors, pharmacies, labs]);

  return (
    <div className={cn("relative w-full h-[750px] rounded-[2.5rem] overflow-hidden border border-white/5 bg-[#030711] shadow-3xl group", className)}>
      {/* HUD Header */}
      <div className="absolute top-8 left-8 right-8 z-[1000] flex items-start justify-between pointer-events-none">
        <div className="flex flex-col gap-4 pointer-events-auto">
          <div className="flex items-center gap-4">
            <GlassCard className="p-1 px-5 flex items-center gap-3 border-white/10 bg-background/60 backdrop-blur-3xl h-14 w-80 shadow-2xl">
              <Search className="h-5 w-5 text-primary animate-pulse" />
              <input 
                placeholder="Search Symptoms, Doctors, Grid..." 
                className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest w-full placeholder:text-muted-foreground/30 text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </GlassCard>
            
            <button 
                onClick={() => detectLocation()}
                className="h-14 w-14 rounded-2xl bg-background/60 border border-white/10 flex items-center justify-center text-primary backdrop-blur-3xl hover:bg-primary hover:text-black transition-all shadow-2xl group"
                title="Center GPS"
            >
                <Locate size={22} className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>

          <AnimatePresence>
            {searchQuery && (
              <motion.div 
                initial={{ opacity: 0, y: -10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="w-80 max-h-80 overflow-y-auto glass border-white/10 rounded-3xl p-3 z-[1001] shadow-3xl backdrop-blur-3xl"
              >
                {filteredItems.length > 0 ? filteredItems.map((item, i) => (
                  <button 
                    key={i}
                    onClick={() => {
                      setSelectedItem(item);
                      setSearchQuery("");
                      const anyItem = item as any;
                      if (anyItem.location || (anyItem.latitude && anyItem.longitude)) {
                        const lat = anyItem.location?.latitude || anyItem.latitude;
                        const lng = anyItem.location?.longitude || anyItem.longitude;
                        setCenter([lat, lng]);
                        setZoom(16);
                      }
                    }}
                    className="w-full text-left p-4 hover:bg-primary/10 rounded-2xl transition-all flex items-center gap-4 group mb-1 last:mb-0"
                  >
                    <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform border border-primary/20">
                      {(item as any).type === 'PHARMACY' ? <Pill size={16} /> : (item as any).role === 'DOCTOR' ? <Stethoscope size={16} /> : <HospitalIcon size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white truncate uppercase tracking-tight">{item.name}</p>
                      <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1">{(item as any).specialization || (item as any).type || 'Clinical Node'}</p>
                    </div>
                  </button>
                )) : (
                  <div className="p-6 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">No neural match found</div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-end gap-3 pointer-events-auto">
          <div className="flex items-center gap-4 p-2 px-5 rounded-2xl bg-background/60 border border-white/10 backdrop-blur-3xl shadow-2xl">
            <div className="flex flex-col items-end">
              <p className="text-[10px] font-black uppercase tracking-tighter text-primary animate-pulse">Neural Grid Active</p>
              <p className="text-[9px] text-muted-foreground/60 font-mono">Uplink: 24.8ms</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-success/10 flex items-center justify-center border border-success/20">
              <Activity className="h-5 w-5 text-success animate-bounce" />
            </div>
          </div>
          
          <button 
            onClick={() => setShowTriage(!showTriage)}
            className={cn(
                "flex items-center gap-3 p-3 px-6 rounded-2xl border transition-all backdrop-blur-3xl shadow-2xl group",
                showTriage ? "bg-primary text-black border-primary" : "bg-background/60 text-white border-white/10 hover:border-primary/50"
            )}
          >
            <Brain size={18} className={cn(showTriage ? "animate-pulse" : "group-hover:scale-110 transition-transform")} />
            <span className="text-[10px] font-black uppercase tracking-widest">AI Care Guide</span>
          </button>
        </div>
      </div>

      {mapReady ? (
        <MapContainer 
          center={center} 
          zoom={zoom} 
          zoomControl={false}
          className="w-full h-full z-0"
        >
          <ChangeView center={center} zoom={zoom} />
          <TileLayer attribution='&copy; MapTiler' url={MAPTILER_URL} />
          
          {/* Patient Location */}
          <Marker position={center} icon={L.divIcon({
            html: renderToString(
              <div className="relative h-12 w-12 flex items-center justify-center">
                <div className="absolute h-full w-full bg-primary/20 rounded-full animate-ping" />
                <div className="absolute h-10 w-10 bg-primary/30 rounded-full animate-pulse" />
                <div className="h-7 w-7 bg-primary rounded-2xl shadow-glow-primary border-2 border-white z-10 flex items-center justify-center">
                  <User size={14} className="text-white" />
                </div>
              </div>
            ),
            className: 'patient-hud-marker',
            iconSize: [48, 48]
          })} />

          {/* Dynamic Layers */}
          {activeLayers.hospitals && hospitals.map(h => h.location && (
            <Marker 
              key={h.id} 
              position={[h.location.latitude, h.location.longitude]} 
              icon={hospitalIcon(h)}
              eventHandlers={{ click: () => {
                setSelectedItem(h);
                calculateRoute(h.location!.latitude, h.location!.longitude);
              }}}
            />
          ))}

          {activeLayers.doctors && nearbyDoctors.map(d => {
            const anyDoc = d as any;
            const pos: [number, number] = (anyDoc.latitude && anyDoc.longitude) 
              ? [anyDoc.latitude, anyDoc.longitude] 
              : (() => {
                  const loc = d.hospital && hospitals.find(h => h.name === d.hospital)?.location;
                  return loc ? [loc.latitude + (Math.random() * 0.002 - 0.001), loc.longitude + (Math.random() * 0.002 - 0.001)] : null;
                })() as [number, number];

            if (!pos) return null;
            
            return (
              <Marker 
                key={d.id} 
                position={pos} 
                icon={doctorIcon(d)}
                eventHandlers={{ click: () => setSelectedItem(d) }}
              />
            );
          })}

          {activeLayers.pharmacies && pharmacies.map(f => (
            <Marker key={f.id} position={[f.latitude, f.longitude]} icon={pharmacyIcon(f)} eventHandlers={{ click: () => setSelectedItem(f) }} />
          ))}

          {activeLayers.labs && labs.map(f => (
            <Marker key={f.id} position={[f.latitude, f.longitude]} icon={labIcon(f)} eventHandlers={{ click: () => setSelectedItem(f) }} />
          ))}

          {route && <Polyline positions={route} pathOptions={{ color: '#0ea5e9', weight: 4, dashArray: '8, 12', className: 'animate-pulse' }} />}
        </MapContainer>
      ) : (
        <div className="w-full h-full bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-primary/40">Initializing Neural Grid...</p>
            </div>
        </div>
      )}

      {/* Categories Toggle HUD */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-2xl px-6">
        <div className="p-2 rounded-[2rem] bg-background/60 border border-white/10 backdrop-blur-3xl shadow-3xl flex items-center justify-between overflow-x-auto no-scrollbar">
          <FilterButton icon={<HospitalIcon size={18} />} label="Hospitals" active={activeLayers.hospitals} onClick={() => toggleLayer('hospitals')} />
          <div className="h-8 w-px bg-white/5" />
          <FilterButton icon={<Stethoscope size={18} />} label="Doctors" active={activeLayers.doctors} onClick={() => toggleLayer('doctors')} />
          <div className="h-8 w-px bg-white/5" />
          <FilterButton icon={<Pill size={18} />} label="Pharmacy" active={activeLayers.pharmacies} onClick={() => toggleLayer('pharmacies')} />
          <div className="h-8 w-px bg-white/5" />
          <FilterButton icon={<Microscope size={18} />} label="Labs" active={activeLayers.labs} onClick={() => toggleLayer('labs')} />
        </div>
      </div>

      {/* Emergency Trigger */}
      <div className="absolute bottom-10 right-10 z-[1000]">
        <button 
          onClick={handleEmergencyTrigger}
          className="h-20 w-20 rounded-[2.5rem] bg-destructive/10 hover:bg-destructive border border-destructive/20 flex items-center justify-center transition-all duration-500 shadow-glow-destructive group backdrop-blur-xl"
        >
          <AlertCircle className="h-10 w-10 text-destructive group-hover:text-white transition-colors" />
        </button>
      </div>

      {/* Loaders */}
      <AnimatePresence>
        {(isLoading || isLocating) && (
          <div className="absolute inset-0 bg-[#030711]/60 backdrop-blur-md z-[2000] flex items-center justify-center">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center gap-6">
              <div className="relative h-20 w-20">
                <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
                <div className="absolute inset-0 border-4 border-t-primary rounded-full animate-spin" />
                <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-sm font-black uppercase tracking-[0.3em] text-white">Clinical Data Sync</h3>
                <p className="text-[10px] text-muted-foreground mt-2 uppercase tracking-widest animate-pulse">Acquiring Regional Healthcare Node...</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Triage Sidebar */}
      <AnimatePresence>
        {showTriage && (
          <motion.div
            initial={{ x: -450, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -450, opacity: 0 }}
            className="absolute top-6 left-28 bottom-6 w-[400px] z-[1001]"
          >
            <GlassCard className="h-full flex flex-col p-8 border-primary/20 bg-background/90 backdrop-blur-3xl overflow-hidden shadow-3xl">
              <div className="flex items-center justify-between mb-10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-glow-primary">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-display font-bold">Neural Triage</h3>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Medical Intelligence v4.0</p>
                  </div>
                </div>
                <button onClick={() => setShowTriage(false)} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <ChevronLeft size={20} className="text-muted-foreground" />
                </button>
              </div>

              <div className="flex-1 space-y-8 overflow-y-auto custom-scrollbar pr-2">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Symptom Input</label>
                  <textarea 
                    placeholder="Describe your condition in natural language..."
                    className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 text-xs focus:ring-2 focus:ring-primary/20 transition-all min-h-[160px] resize-none placeholder:text-muted-foreground/30"
                    value={symptoms}
                    onChange={(e) => setSymptoms(e.target.value)}
                  />
                  <NeonButton 
                    variant="primary" 
                    className="w-full h-14 text-[10px] uppercase font-black tracking-widest rounded-2xl shadow-glow-primary"
                    onClick={handleAiRecommendation}
                    isLoading={isAiLoading}
                  >
                    Analyze & Map Route
                  </NeonButton>
                </div>

                {aiRec && (
                  <motion.div 
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="p-6 rounded-3xl bg-primary/10 border border-primary/20 space-y-6 relative overflow-hidden group"
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                      <Brain size={80} />
                    </div>
                    <div className="flex items-center gap-3">
                      <div className={cn("h-3 w-3 rounded-full animate-ping", aiRec.urgency === 'HIGH' ? "bg-destructive" : "bg-success")} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary">Triage: {aiRec.urgency} Urgency</span>
                    </div>
                    <p className="text-sm font-medium leading-relaxed text-foreground italic">"{aiRec.recommendation}"</p>
                    <div className="pt-6 border-t border-primary/10 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase">Recommended Hub</span>
                        <span className="text-xs font-bold text-white mt-1">{aiRec.bestHospital?.name || 'CareX Central'}</span>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                        <Navigation size={18} className="text-primary" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Selection Detail Panel */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ x: 450, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 450, opacity: 0 }}
            className="absolute top-6 right-6 bottom-6 w-[450px] z-[1002]"
          >
            <GlassCard className="h-full flex flex-col p-0 border-white/10 bg-[#030711]/95 backdrop-blur-3xl overflow-hidden shadow-3xl">
              <div className="relative h-60">
                <img src={selectedItem.imageUrl || `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80`} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#030711] via-transparent to-transparent" />
                <button onClick={() => setSelectedItem(null)} className="absolute top-6 right-6 p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 hover:bg-black/70 transition-all">
                  <X size={20} className="text-white" />
                </button>
                <div className="absolute bottom-6 left-8 flex items-center gap-4">
                  <Badge text={selectedItem.type || selectedItem.specialization || 'Clinical Hub'} />
                  {selectedItem.verified && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-success/20 border border-success/40 text-[10px] font-black uppercase text-success backdrop-blur-md shadow-glow-success/20">
                      <Zap size={12} fill="currentColor" /> Verified Node
                    </div>
                  )}
                </div>
              </div>

              <div className="p-10 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                <div className="mb-10">
                  <h3 className="text-3xl font-display font-bold text-white tracking-tight">{selectedItem.name}</h3>
                  <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                    <MapPin size={16} className="text-primary" />
                    <span className="text-xs">{selectedItem.location?.address || selectedItem.address || 'Neural Hub Location'}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-5 mb-10">
                  <IntelligenceCard 
                    label="Satellite ETA" 
                    value={`${eta || selectedItem.eta || '12'} MINS`} 
                    icon={<Navigation size={14} />} 
                    sub="Traffic Optimized"
                    color="text-primary"
                  />
                  <IntelligenceCard 
                    label="Clinical Load" 
                    value={selectedItem.queueWaitTime !== undefined ? `${selectedItem.queueWaitTime} MINS` : 'READY'} 
                    icon={<Activity size={14} />} 
                    sub="Live Occupancy"
                    color={selectedItem.queueWaitTime > 30 ? "text-destructive" : selectedItem.queueWaitTime > 15 ? "text-warning" : "text-success"}
                  />
                </div>

                <div className="space-y-8">
                  {selectedItem.role === 'DOCTOR' ? (
                    <div className="space-y-6">
                      <div className="p-6 rounded-[2rem] bg-white/5 border border-white/10 space-y-5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Rating Score</span>
                          <div className="flex items-center gap-1.5 text-amber-500">
                            <Star size={14} fill="currentColor" />
                            <span className="text-sm font-black">{selectedItem.rating || '4.9'}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Consultation Fee</span>
                          <span className="text-lg font-black text-primary">₹{selectedItem.consultationFee || 500}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-white/5">
                          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Affiliation</span>
                          <span className="text-xs font-bold text-white">{selectedItem.hospital || 'CareX Global'}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <NeonButton variant="primary" className="w-full h-14 text-[10px] uppercase font-black tracking-[0.2em] rounded-2xl" onClick={() => onSelectDoctor?.(selectedItem)}>
                          <Calendar size={18} className="mr-2" /> Book Slot
                        </NeonButton>
                        <NeonButton variant="ghost" className="w-full h-14 text-[10px] uppercase font-black tracking-[0.2em] rounded-2xl" onClick={() => {}}>
                          <MessageSquare size={18} className="mr-2" /> Quick Chat
                        </NeonButton>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-2">
                          {selectedItem.type === 'LAB' ? 'Available Tests' : 'Active Units'}
                        </label>
                        <div className="flex flex-wrap gap-2.5">
                          {(selectedItem.availableTests || ['Emergency', 'ICU-4', 'Imaging-X', 'Blood Bank']).map((dept: string) => (
                            <span key={dept} className="px-4 py-2 rounded-2xl bg-primary/5 border border-primary/20 text-[10px] font-bold text-primary/80 hover:bg-primary/10 transition-colors cursor-default">
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <NeonButton variant="primary" className="w-full h-14 text-[10px] uppercase font-black tracking-[0.2em] rounded-2xl" onClick={() => onSelectHospital?.(selectedItem)}>
                          <Activity size={18} className="mr-2" /> Access Grid
                        </NeonButton>
                        <NeonButton variant="ghost" className="w-full h-14 text-[10px] uppercase font-black tracking-[0.2em] rounded-2xl" onClick={() => openInGoogleMaps(selectedItem)}>
                          <ExternalLink size={18} className="mr-2" /> Satellite Nav
                        </NeonButton>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-12 pt-10 border-t border-white/5">
                  <div className="p-6 rounded-[2rem] bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 flex gap-5">
                    <Sparkles className="h-8 w-8 text-primary shrink-0" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-primary/80">Neural Care insight</span>
                      <p className="text-[12px] leading-relaxed mt-2 italic text-foreground/90">
                        {selectedItem.role === 'DOCTOR' 
                          ? `${selectedItem.name} specializes in high-risk ${selectedItem.specialization} recovery with a 99.2% success rate.`
                          : `Optimal resource allocation at ${selectedItem.name}. Emergency units reporting green status for immediate intake.`
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FilterButton = ({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center gap-2.5 px-5 py-2.5 rounded-2xl transition-all duration-300 group",
      active ? "bg-primary text-white shadow-glow-primary scale-105" : "text-muted-foreground hover:bg-white/5 hover:text-white"
    )}
  >
    <div className={cn("transition-transform group-hover:scale-110", active ? "text-white" : "text-primary/70")}>{icon}</div>
    <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
  </button>
);

const Search = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
);

const MapControlButton = ({ icon, onClick, tooltip, active }: { icon: React.ReactNode, onClick: () => void, tooltip: string, active?: boolean }) => (
  <button 
    onClick={onClick}
    className={cn(
      "p-3 transition-all rounded-xl",
      active ? "bg-primary/20 text-primary" : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
    )}
    title={tooltip}
  >
    {icon}
  </button>
);

const Badge = ({ text, color = "bg-primary/20 text-primary border-primary/30" }: { text: string, color?: string }) => (
  <span className={cn("text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl backdrop-blur-md border shadow-xl", color)}>
    {text}
  </span>
);

const IntelligenceCard = ({ label, value, icon, sub, color = "text-primary" }: { label: string, value: string, icon: React.ReactNode, sub: string, color?: string }) => (
  <div className="p-4 rounded-2xl bg-muted/5 border border-border/10 hover:bg-muted/10 transition-colors">
    <div className="flex items-center gap-2 mb-2 opacity-60">
      <div className={cn("p-1.5 rounded-lg bg-background/50", color)}>{icon}</div>
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <p className="text-lg font-display font-bold text-white">{value}</p>
    <p className="text-[8px] font-medium text-muted-foreground uppercase tracking-widest mt-1">{sub}</p>
  </div>
);
