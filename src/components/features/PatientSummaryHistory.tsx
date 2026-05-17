import React, { useState, useEffect } from 'react';
import { BackendAPI } from '@/services/apiClient';
import { ConsultationSummary } from '@/types';
import { GlassCard } from '@/components/carex/GlassCard';
import { Loader2, FileText, Calendar, ChevronRight, Stethoscope, Pill, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface PatientSummaryHistoryProps {
  patientId: string;
  patientName: string;
}

export const PatientSummaryHistory: React.FC<PatientSummaryHistoryProps> = ({ patientId, patientName }) => {
  const [summaries, setSummaries] = useState<ConsultationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await BackendAPI.getPatientConsultationSummaries(patientId);
        setSummaries(data);
      } catch (err) {
        console.error("Failed to load patient summaries", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [patientId]);

  if (loading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>;

  if (summaries.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-border rounded-2xl">
        <FileText className="mx-auto mb-3 opacity-20" size={32} />
        <p className="text-sm text-muted-foreground">No previous consultation summaries found for {patientName}.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Stethoscope className="text-primary" size={16} />
        <h3 className="text-sm font-bold uppercase tracking-wider">Previous Consultation History</h3>
      </div>
      
      {summaries.map((summary) => (
        <GlassCard 
          key={summary.id} 
          className={`overflow-hidden transition-all duration-300 ${selectedId === summary.id ? 'border-primary/50 ring-1 ring-primary/20' : 'hover:border-white/20'}`}
        >
          <div 
            className="p-4 cursor-pointer flex items-center justify-between"
            onClick={() => setSelectedId(selectedId === summary.id ? null : summary.id)}
          >
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar size={20} />
              </div>
              <div>
                <p className="font-bold text-sm">{new Date(summary.createdAt).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                <p className="text-xs text-muted-foreground">ID: {summary.appointmentId.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            <ChevronRight 
              className={`text-muted-foreground transition-transform duration-300 ${selectedId === summary.id ? 'rotate-90' : ''}`} 
              size={20} 
            />
          </div>

          <AnimatePresence>
            {selectedId === summary.id && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 pt-2 border-t border-white/5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-primary uppercase">
                        <Activity size={12} /> Symptoms
                      </div>
                      <p className="text-sm text-text-main/90 bg-white/5 p-2 rounded-lg">{summary.symptoms}</p>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-secondary uppercase">
                        <Brain size={12} /> Possible Condition
                      </div>
                      <p className="text-sm text-text-main/90 bg-white/5 p-2 rounded-lg">{summary.diagnosis || summary.possibleCondition}</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 uppercase">
                      <Pill size={12} /> Medications & Recommendations
                    </div>
                    <p className="text-sm text-text-main/90 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded-lg">
                      {summary.medicines || summary.recommendations}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-400 uppercase">
                      <Info size={12} /> Advice & Follow-up
                    </div>
                    <p className="text-sm text-text-main/90 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg">
                      {summary.advice || summary.followUpInstructions}
                    </p>
                  </div>

                  {summary.keyDiscussionPoints && summary.keyDiscussionPoints.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Key Discussion Points</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {summary.keyDiscussionPoints.map((point, i) => (
                          <li key={i} className="text-xs flex items-start gap-2 text-text-muted bg-white/5 p-2 rounded-md">
                            <span className="w-1 h-1 rounded-full bg-primary mt-1.5 shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </GlassCard>
      ))}
    </div>
  );
};
