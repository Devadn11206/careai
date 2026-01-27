
import { GoogleGenAI, Type } from "@google/genai";
import { HealthMetrics, AIAnalysisResult, PatientProfile, HealthPassportData, DoctorProfile, DoctorNote, EmergencyGuidance, ExtractedParameter } from '../types';

// In a real app, this key comes from the backend to avoid exposure.
// For this frontend-only demo, read it from Vite env if present.
const GEMINI_API_KEY: string = (import.meta as any).env.VITE_GEMINI_API_KEY || '';
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Helper to strip Markdown code blocks
const cleanJSON = (text: string): string => {
  return text.replace(/```json\n|\n```|```/g, '').trim();
};

export const GeminiService = {
  // NEW: Helper to map dynamic list to fixed metrics for UI display
  mapExtractedToMetrics: (params: ExtractedParameter[]): Partial<HealthMetrics> => {
    const metrics: Partial<HealthMetrics> = {};
    
    params.forEach(p => {
      const name = p.testName.toLowerCase();
      // Remove non-numeric characters except decimal point
      const valStr = p.value.toString().replace(/[^0-9.]/g, '');
      const val = parseFloat(valStr);
      
      if (isNaN(val)) return;

      if (name.includes('systolic') || (name.includes('bp') && name.includes('sys'))) {
        metrics.systolicBP = val;
      } else if (name.includes('diastolic') || (name.includes('bp') && name.includes('dia'))) {
        metrics.diastolicBP = val;
      } else if (name.includes('glucose') || name.includes('sugar') || name.includes('bsl') || name.includes('fbs') || name.includes('ppbs')) {
        metrics.glucose = val;
      } else if (name.includes('cholesterol') || name.includes('lipid')) {
        metrics.cholesterol = val;
      } else if (name.includes('weight')) {
        metrics.weight = val;
      } else if (name.includes('height')) {
        metrics.height = val;
      } else if (name.includes('bmi') || name.includes('body mass')) {
        metrics.bmi = val;
      } else if (name.includes('creatinine')) {
        metrics.serumCreatinine = val;
      } else if (name.includes('tsh') || name.includes('thyroid')) {
        metrics.tshLevel = val;
      }
    });
    
    // Auto-calculate BMI if missing but height/weight exist
    if (!metrics.bmi && metrics.weight && metrics.height) {
        // Assume cm for height if > 3 (unlikely to be meters if > 3)
        const h = metrics.height > 3 ? metrics.height / 100 : metrics.height;
        metrics.bmi = parseFloat((metrics.weight / (h * h)).toFixed(1));
    }

    return metrics;
  },

  // NEW: Dynamic Analysis based on Extracted Parameters
  analyzeHealthRisks: async (
    metrics: HealthMetrics, 
    age: number, 
    gender: string,
    symptomProfile?: { bpRisk: string; glucoseRisk: string },
    dynamicData?: ExtractedParameter[]
  ): Promise<AIAnalysisResult> => {
    try {
      if (!GEMINI_API_KEY) {
        console.warn("No API Key provided. Returning mock AI response.");
        return getMockAIResponse();
      }

      let clinicalDataContext = "";
      
      // LOGIC: Build context from whatever data is available
      if (dynamicData && dynamicData.length > 0) {
          clinicalDataContext = `
            DATA SOURCE: Uploaded Medical Report (Extracted Text).
            The following parameters were found in the document:
            ${JSON.stringify(dynamicData, null, 2)}
            
            INSTRUCTION: 
            1. Search this list for values relevant to Blood Pressure (Systolic, Diastolic), Diabetes (Glucose, HbA1c), and general health.
            2. If specific values (like BP) are missing in the report, explicitly state that you are estimating risk based on the provided Symptoms or other indirect markers (like BMI or Kidney function) if available.
            3. Do not assume values exist if they are not in the list.
          `;
      } else if (metrics.systolicBP > 0 || metrics.glucose > 0) {
          // Fallback to manual entry if dynamic data is empty but manual metrics exist
          clinicalDataContext = `
            DATA SOURCE: Manual Vitals Entry.
            - Systolic BP: ${metrics.systolicBP}
            - Diastolic BP: ${metrics.diastolicBP}
            - Glucose: ${metrics.glucose}
            - Cholesterol: ${metrics.cholesterol}
          `;
      } else {
          // Symptom only
          clinicalDataContext = `
            DATA SOURCE: Symptom Screening Only.
            No numeric report data available.
            - BP Symptom Risk: ${symptomProfile?.bpRisk || 'Unknown'}
            - Diabetes Symptom Risk: ${symptomProfile?.glucoseRisk || 'Unknown'}
          `;
      }

      const prompt = `
        Act as a Clinical Decision Support AI.
        
        PATIENT: Age ${age}, ${gender}, BMI ${metrics.bmi}.
        ${metrics.smoking ? 'Smoker.' : 'Non-smoker.'} 
        ${metrics.familyHistory ? 'Family history of diabetes.' : ''}

        ${clinicalDataContext}

        TASK:
        Perform a dynamic risk assessment for:
        1. **Heart Disease**
        2. **Hypertension**
        3. **Diabetes**

        RULES:
        - If the report contains relevant values (e.g., specific Glucose value), use them for high-confidence prediction.
        - If the report is missing a specific value (e.g., no BP found), use the ${symptomProfile ? 'Symptom Profile' : 'demographics'} to estimate the risk level, but lower the confidence score.
        - In the 'topFactors' array, explicitly mention which specific test from the report (or which symptom) caused the risk assessment.

        Output JSON matching the schema.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              predictions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    condition: { type: Type.STRING, enum: ["Heart Disease", "Hypertension", "Diabetes"] },
                    probability: { type: Type.NUMBER, description: "0-100 percentage" },
                    riskLevel: { type: Type.STRING, enum: ["Low", "Moderate", "High"] },
                    confidenceScore: { type: Type.NUMBER, description: "Model confidence 0-100" },
                    recommendation: { type: Type.STRING },
                    topFactors: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          factor: { type: Type.STRING, description: "Specific test name or symptom extracted" },
                          impact: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
                          direction: { type: Type.STRING, enum: ["Increase", "Decrease"] },
                          description: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              },
              // Backward compatibility
              diabetesRisk: { type: Type.NUMBER },
              hypertensionRisk: { type: Type.NUMBER },
              heartDiseaseRisk: { type: Type.NUMBER },
              ckdRiskLevel: { type: Type.STRING, enum: ["Low", "Medium", "High"] },
              strokeRiskScore: { type: Type.NUMBER },
              thyroidAnalysis: { type: Type.STRING },
              keyFactors: { type: Type.ARRAY, items: { type: Type.STRING } },
              explanation: { type: Type.STRING },
              confidenceLevel: { type: Type.STRING, enum: ["High", "Medium", "Low"] },
              confidenceReason: { type: Type.STRING },
              confidenceImprovement: { type: Type.STRING },
              lifestyleRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("No response from AI");
      
      const result = JSON.parse(cleanJSON(text)) as AIAnalysisResult;
      return { ...result, timestamp: new Date().toISOString() };

    } catch (error) {
      console.error("AI Analysis failed", error);
      return getMockAIResponse();
    }
  },

  // NEW: Completely dynamic extraction. No hardcoded fields.
  extractMetricsFromReport: async (
    fileBase64: string,
    mimeType: string
  ): Promise<ExtractedParameter[]> => {
    try {
      if (!GEMINI_API_KEY) {
        throw new Error("No API Key");
      }

      // Prompt specifically asks for a generic list of findings
      const prompt = `
        Analyze this medical document image/PDF.
        Identify ALL medical tests, biomarkers, vital signs, and measurements present in the document.
        
        For each detected item, extract:
        1. 'testName': The name exactly as it appears (e.g., "Hemoglobin", "Total Cholesterol", "TSH").
        2. 'value': The numerical or string result.
        3. 'unit': The unit of measurement (e.g., "mg/dL", "mmHg").
        4. 'flag': If the report explicitly marks it as High/Low/Abnormal, capture that. Otherwise 'Normal'.

        If you find 'Height' and 'Weight', include them.
        Return a simple JSON array of these objects.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview', 
        contents: [
          {
            inlineData: {
              mimeType: mimeType,
              data: fileBase64
            }
          },
          { text: prompt }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                testName: { type: Type.STRING },
                value: { type: Type.STRING, description: "Keep as string to preserve symbols like < or >" },
                unit: { type: Type.STRING },
                flag: { type: Type.STRING, enum: ["High", "Low", "Normal", "Abnormal"] }
              }
            }
          }
        }
      });

      if (response.text) {
        const data = JSON.parse(cleanJSON(response.text)) as ExtractedParameter[];
        return data;
      }
      throw new Error("Could not parse report");
    } catch (error) {
      console.error("Report extraction failed", error);
      throw error;
    }
  },

  // Helper to check the dynamic list for height/weight and calc BMI
  calculateDynamicBMI: (params: ExtractedParameter[]): number | null => {
      const heightItem = params.find(p => p.testName.toLowerCase().includes('height'));
      const weightItem = params.find(p => p.testName.toLowerCase().includes('weight'));

      if (heightItem && weightItem) {
          let h = parseFloat(heightItem.value.toString());
          let w = parseFloat(weightItem.value.toString());
          
          // Basic unit normalization assumptions for demo
          if (heightItem.unit.includes('cm')) h = h / 100;
          if (heightItem.unit.includes('in')) h = h * 0.0254;
          if (weightItem.unit.includes('lb')) w = w * 0.453592;

          if (h > 0 && w > 0) {
              return parseFloat((w / (h * h)).toFixed(1));
          }
      }
      return null;
  },

  generateClinicalSummary: async (history: HealthMetrics[], patient: PatientProfile): Promise<string> => {
    return "Clinical summary unavailable."; 
  },

  generateHealthPassport: async (
    patient: PatientProfile,
    metrics: HealthMetrics,
    aiResult: AIAnalysisResult,
    history: HealthMetrics[],
    doctor?: DoctorProfile
  ): Promise<HealthPassportData> => {
      return getMockHealthPassport(patient, metrics, aiResult, history, doctor);
  },

  generateEmergencyGuidance: async (
    patientName: string,
    riskFactors: string[],
    locationAvailable: boolean
  ): Promise<EmergencyGuidance> => {
      return {
        safetyMessage: "Stay calm.",
        supportOptions: "Call doctor.",
        nearbyHelp: "Enable location.",
        checklist: { dos: [], donts: [] },
        reassurance: "Help is available."
      };
  }
};

const getMockAIResponse = (): AIAnalysisResult => ({
  predictions: [
    {
      condition: "Heart Disease",
      probability: 25,
      riskLevel: "Low",
      confidenceScore: 90,
      recommendation: "Maintain current cardiovascular activity.",
      topFactors: [
        { factor: "Normal BP", impact: "High", direction: "Decrease", description: "Blood pressure is optimal" },
        { factor: "Non-Smoker", impact: "Medium", direction: "Decrease", description: "Absence of smoking reduces risk" }
      ]
    },
    {
      condition: "Hypertension",
      probability: 30,
      riskLevel: "Moderate",
      confidenceScore: 85,
      recommendation: "Monitor salt intake and stress levels.",
      topFactors: [
        { factor: "Age", impact: "Medium", direction: "Increase", description: "Age factor slightly increases risk" },
        { factor: "Activity Level", impact: "Medium", direction: "Decrease", description: "Activity helps manage BP" }
      ]
    },
    {
      condition: "Diabetes",
      probability: 45,
      riskLevel: "Moderate",
      confidenceScore: 88,
      recommendation: "Reduce refined sugars and carbohydrates.",
      topFactors: [
        { factor: "BMI", impact: "High", direction: "Increase", description: "Higher BMI correlates with insulin resistance" },
        { factor: "Glucose", impact: "High", direction: "Increase", description: "Glucose levels are borderline" }
      ]
    }
  ],
  diabetesRisk: 45,
  hypertensionRisk: 30,
  heartDiseaseRisk: 25,
  ckdRiskLevel: 'Low',
  strokeRiskScore: 15,
  thyroidAnalysis: "Normal",
  keyFactors: ["Moderately high BMI", "Sedentary lifestyle"],
  explanation: "Mock Data: AI Service Unavailable.",
  lifestyleRecommendations: [
    "Increase aerobic exercise",
    "Reduce sodium intake",
    "Monitor carbs"
  ],
  confidenceLevel: "Medium",
  confidenceReason: "Mock Data",
  confidenceImprovement: "Connect API",
  timestamp: new Date().toISOString()
});

const getMockHealthPassport = (p: any, m: any, a: any, h: any, d: any) => {
    return {} as HealthPassportData; // Simplified for this file update
};
