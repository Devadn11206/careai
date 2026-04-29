import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/carex/AppLayout';
import { HealthPassport } from '@/components/features/HealthPassport';
import { useHealth } from '@/services/HealthContext';
import { BackendAPI } from '@/services/apiClient';
import { HealthPassportData, UserRole, HealthMetrics } from '@/types';
import { Loader2, FileText } from 'lucide-react';
import { GlassCard } from '@/components/carex/GlassCard';

const PassportPage = () => {
  const { user, vitals, alerts, medications } = useHealth();
  const [passportData, setPassportData] = useState<HealthPassportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const generatePassport = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        // Generate structured data for the passport
        const latestVitals: HealthMetrics = vitals[vitals.length - 1] || {
          systolicBP: 120,
          diastolicBP: 80,
          heartRate: 72,
          glucose: 100,
          temperature: 36.6,
          oxygenLevel: 98,
          respiratoryRate: 16,
          bmi: 22,
          cholesterol: 180,
          smoking: false,
          activityLevel: 'Moderate',
          timestamp: new Date().toISOString()
        };

        // Fetch AI analysis for the passport
        const aiAnalysis = await BackendAPI.analyzeHealthRisk({
          metrics: latestVitals,
          age: 40, // Demo age
          gender: 'Male' // Demo gender
        });

        const data: HealthPassportData = {
          generatedDate: new Date().toISOString(),
          patientId: user.id,
          patientName: user.name,
          patientAge: 40,
          patientGender: 'Male',
          bloodGroup: 'B+',
          clinicalSummary: "Patient exhibits stable vitals with moderate activity levels. AI analysis suggests maintaining current lifestyle with focus on cardiovascular health.",
          metrics: latestVitals,
          aiAnalysis: aiAnalysis,
          history: vitals.slice(-5),
          medications: medications
        };

        setPassportData(data);
      } catch (err) {
        console.error("Failed to generate health passport", err);
      } finally {
        setLoading(false);
      }
    };

    generatePassport();
  }, [user, vitals, medications]);

  return (
    <AppLayout title="Health Passport" subtitle="Comprehensive clinical summary and medical records">
      <div className="h-[calc(100vh-200px)] flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        ) : passportData ? (
          <div className="w-full h-full">
             <HealthPassport 
                data={passportData} 
                onClose={() => window.location.href = '/dashboard'}
             />
          </div>
        ) : (
          <GlassCard className="p-12 text-center max-w-md border-dashed">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-20 text-primary" />
            <h3 className="text-xl font-display font-bold mb-2">Error Generating Passport</h3>
            <p className="text-muted-foreground text-sm">
              We encountered an issue while aggregating your clinical data. Please try refreshing the page.
            </p>
          </GlassCard>
        )}
      </div>
    </AppLayout>
  );
};

export default PassportPage;
