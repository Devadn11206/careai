import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/carex/AppLayout';
import { useHealth } from '@/services/HealthContext';
import { BackendAPI, BackendDoctor } from '@/services/apiClient';
import { GlassCard } from '@/components/carex/GlassCard';
import { NeonButton } from '@/components/carex/NeonButton';
import { BookingModal } from '@/components/features/BookingModal';
import { 
  Search, Filter, Star, Clock, MapPin, 
  ChevronRight, Stethoscope, Award, 
  Calendar, Video, Sparkles, User, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CareMap } from '@/components/carex/CareMap';

const FindDoctors = () => {
  const { user } = useHealth();
  const [doctors, setDoctors] = useState<BackendDoctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [specialization, setSpecialization] = useState("All");
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState<BackendDoctor | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [emergencyMode, setEmergencyMode] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, [search, specialization]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const data = await BackendAPI.getDoctors({ search, specialization });
      setDoctors(data);
    } catch (err) {
      toast.error("Failed to synchronize with clinical network");
    } finally {
      setLoading(false);
    }
  };

  const filteredDoctors = doctors.filter(d => 
    (specialization === "All" || d.specialization === specialization) &&
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  const specializations = ["All", ...Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean) as string[]))];

  return (
    <AppLayout title="Consult Clinicians" subtitle="Real-time access to the CareXAI specialized medical network">
      <div className="space-y-8 pb-12">
        
        {/* Header Section with Search & Filters */}
        <GlassCard className="p-6 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
            <Sparkles className="h-24 w-24 text-primary" />
          </div>
          
          <div className="flex flex-col md:flex-row gap-6 items-end">
            <div className="flex-1 space-y-4 w-full">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-primary/60 ml-1">Universal Search</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input 
                  type="text" 
                  placeholder="Search by name, specialization, or symptoms..."
                  className="w-full bg-background/50 border border-border/50 rounded-2xl py-4 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all backdrop-blur-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <NeonButton 
                variant={viewMode === 'grid' ? 'primary' : 'outline'} 
                className="h-14 px-6 rounded-2xl"
                onClick={() => setViewMode('grid')}
              >
                Grid
              </NeonButton>
              <NeonButton 
                variant={viewMode === 'map' ? 'primary' : 'outline'} 
                className="h-14 px-6 rounded-2xl"
                onClick={() => setViewMode('map')}
              >
                Live Map
              </NeonButton>
              <NeonButton 
                variant={emergencyMode ? 'primary' : 'outline'} 
                className={cn("h-14 px-6 rounded-2xl", emergencyMode && "bg-destructive border-destructive text-white shadow-glow-destructive")}
                onClick={() => setEmergencyMode(!emergencyMode)}
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Emergency
              </NeonButton>
            </div>
          </div>
        </GlassCard>

        {viewMode === 'map' ? (
          <CareMap 
            emergencyMode={emergencyMode}
            onSelectDoctor={(doc) => {
              setSelectedDoctor(doc);
              setIsBookingOpen(true);
            }}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <GlassCard key={i} className="h-[400px] animate-pulse">
                    <div className="h-48 bg-muted/20 rounded-t-2xl" />
                    <div className="p-6 space-y-4">
                      <div className="h-6 w-2/3 bg-muted/20 rounded" />
                      <div className="h-4 w-1/2 bg-muted/20 rounded" />
                    </div>
                  </GlassCard>
                ))
              ) : filteredDoctors.length > 0 ? (
                filteredDoctors.map((doc, idx) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                  >
                    <GlassCard className="group h-full flex flex-col hover:border-primary/40 transition-all hover:shadow-glow-primary/10">
                      <div className="relative h-40 overflow-hidden rounded-t-2xl bg-gradient-to-br from-primary/10 to-accent/10">
                        {doc.profilePicUrl ? (
                          <img src={doc.profilePicUrl} alt={doc.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="h-16 w-16 text-primary/20" />
                          </div>
                        )}
                        <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 flex items-center gap-1 shadow-xl">
                          <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px] font-black">{doc.rating || '4.8'}</span>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col space-y-4">
                        <h3 className="font-display font-bold text-lg">{doc.name}</h3>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-2 uppercase tracking-widest font-black">
                          <MapPin size={10} className="text-primary" /> {doc.hospital || 'CareXAI Virtual Hub'}
                        </p>
                        <div className="pt-4 mt-auto">
                          <NeonButton 
                            variant="primary" 
                            className="w-full h-11 text-xs font-black uppercase tracking-widest"
                            onClick={() => {
                              setSelectedDoctor(doc);
                              setIsBookingOpen(true);
                            }}
                          >
                            <Calendar className="h-4 w-4 mr-2" /> Book Appointment
                          </NeonButton>
                        </div>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))
              ) : (
                <div className="col-span-full py-24 text-center">
                  <Stethoscope className="h-16 w-16 text-primary/10 mx-auto mb-4" />
                  <h3 className="text-xl font-display font-bold">No clinicians available currently</h3>
                </div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <BookingModal 
        isOpen={isBookingOpen} 
        onClose={() => setIsBookingOpen(false)} 
        initialDoctor={selectedDoctor} 
      />
    </AppLayout>
  );
};

export default FindDoctors;
