import { Brain, Lightbulb, FileText, Upload, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/carex/AppLayout";
import { MLRiskAssessor } from "@/components/carex/MLRiskAssessor";
import { useState, useEffect } from "react";
import { useHealth } from "@/services/HealthContext";
import { HealthMetrics, AIAnalysisResult } from "@/types";

const Insights = () => {
  const { vitals } = useHealth();
  const [localMetrics, setLocalMetrics] = useState<HealthMetrics>(
    vitals[vitals.length - 1] || {
      systolicBP: 120,
      diastolicBP: 80,
      glucose: 100,
      bmi: 22,
      cholesterol: 180,
      smoking: false,
      activityLevel: 'Moderate',
      timestamp: new Date().toISOString()
    }
  );
  const [predictionResult, setPredictionResult] = useState<AIAnalysisResult | null>(null);

  useEffect(() => {
    if (vitals.length > 0 && !predictionResult) {
      setLocalMetrics(vitals[vitals.length - 1]);
    }
  }, [vitals, predictionResult]);

  return (
    <AppLayout title="AI Predictive Insights" subtitle="Neural risk assessment generated via machine learning">
      <div className="max-w-7xl mx-auto">
        {/* ML Risk Assessor Section - Now the primary focus */}
        <MLRiskAssessor 
          metrics={localMetrics}
          onUpdateMetrics={setLocalMetrics}
          onAnalyzeComplete={setPredictionResult}
        />
      </div>
    </AppLayout>
  );
};

export default Insights;

