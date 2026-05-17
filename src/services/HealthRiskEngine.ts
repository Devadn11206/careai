import { HealthMetrics, AIAnalysisResult, AiInsight } from '../types';

export interface WellnessScoreResult {
  wellness_score: number;
  status: 'Excellent' | 'Good' | 'Moderate' | 'High Risk';
  risk_breakdown: {
    diabetes: number;
    hypertension: number;
    heart: number;
  };
}

export const HealthRiskEngine = {
  calculateWellnessScore: (
    metrics: HealthMetrics,
    aiResult: AIAnalysisResult | null,
    persistedInsight: AiInsight | null = null
  ): WellnessScoreResult | string => {
    // If we have a persisted insight with risk data, use it as fallback
    if (!aiResult && persistedInsight && persistedInsight.diabetesRisk !== undefined) {
      const diabetesRisk = persistedInsight.diabetesRisk || 0;
      const hypertensionRisk = persistedInsight.hypertensionRisk || 0;
      const heartRisk = persistedInsight.heartDiseaseRisk || 0;
      
      // Calculate score based on persisted risks
      let score = persistedInsight.ai_wellness_score;
      
      // Still apply real-time metric adjustments if metrics are fresh
      if (metrics.systolicBP > 140 || metrics.diastolicBP > 90) score -= 2; // Smaller penalty for "live" deviations
      
      const clampedScore = Math.max(0, Math.min(100, Math.round(score)));
      
      let status: WellnessScoreResult['status'] = 'High Risk';
      if (clampedScore >= 85) status = 'Excellent';
      else if (clampedScore >= 70) status = 'Good';
      else if (clampedScore >= 50) status = 'Moderate';

      return {
        wellness_score: clampedScore,
        status,
        risk_breakdown: {
          diabetes: Math.round(diabetesRisk),
          hypertension: Math.round(hypertensionRisk),
          heart: Math.round(heartRisk)
        }
      };
    }

    if (!aiResult || !aiResult.predictions || aiResult.predictions.length === 0) {
      return "insufficient data";
    }

    // 1. Extract risks from predictions
    const getRisk = (condition: string): number => {
      const pred = aiResult.predictions.find(p => p.condition === condition);
      return pred ? pred.probability : 0;
    };

    const diabetesRisk = getRisk('Diabetes');
    const hypertensionRisk = getRisk('Hypertension');
    const heartRisk = getRisk('Heart Disease');

    // 2. Weighted Scoring (ML-based)
    // Wellness Score = 100 - ((Diabetes Risk × 0.35) + (Hypertension Risk × 0.30) + (Heart Risk × 0.35))
    let score = 100 - (
      (diabetesRisk * 0.35) +
      (hypertensionRisk * 0.30) +
      (heartRisk * 0.35)
    );

    // 3. Dynamic Adjustments (Real-time Metric based)
    // Penalties
    if (metrics.systolicBP > 140 || metrics.diastolicBP > 90) score -= 5;
    if (metrics.glucose > 180) score -= 5;
    if (metrics.bmi > 30) score -= 5;
    if (metrics.smoking) score -= 5;
    if (metrics.cholesterol > 240) score -= 3;

    // Rewards
    if (metrics.activityLevel === 'High') score += 5;
    if (metrics.activityLevel === 'Moderate') score += 2;
    if (!metrics.smoking) score += 3;

    // Clamp score
    score = Math.max(0, Math.min(100, Math.round(score)));

    // 4. Determine Status
    let status: WellnessScoreResult['status'] = 'High Risk';
    if (score >= 85) status = 'Excellent';
    else if (score >= 70) status = 'Good';
    else if (score >= 50) status = 'Moderate';

    return {
      wellness_score: score,
      status,
      risk_breakdown: {
        diabetes: Math.round(diabetesRisk),
        hypertension: Math.round(hypertensionRisk),
        heart: Math.round(heartRisk)
      }
    };
  }
};
