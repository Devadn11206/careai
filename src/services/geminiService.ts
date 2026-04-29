
import { GoogleGenAI, Type } from "@google/genai";
import { HealthMetrics, AIAnalysisResult, PatientProfile, HealthPassportData, DoctorProfile, DoctorNote, EmergencyGuidance, ExtractedParameter, PrescriptionOcrResult, NutritionPlan, Medication } from '../types';

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

  // Generate a very short, patient-friendly medical summary
  // combining lab/vital values, predicted risks, and medications.
  generatePatientSummary: async (
    patient: PatientProfile,
    metrics: HealthMetrics,
    aiResult: AIAnalysisResult | null,
    medications: Medication[]
  ): Promise<string> => {
    try {
      const topPreds = aiResult?.predictions || [];
      const mainRisk = topPreds[0];

      // Fallback summary without external AI
      const buildFallback = (): string => {
        if (!mainRisk) {
          return `Your current readings look generally stable. We will keep tracking your blood pressure, sugar, and weight over time to protect your heart and overall health.`;
        }
        const cond = mainRisk.condition.toLowerCase();
        let phrase = `Your results show a ${mainRisk.riskLevel.toLowerCase()} chance of ${cond}. `;

        const abnormalBits: string[] = [];
        if ((metrics.systolicBP || 0) >= 140 || (metrics.diastolicBP || 0) >= 90) {
          abnormalBits.push(`your blood pressure reading of ${metrics.systolicBP}/${metrics.diastolicBP} mmHg is higher than the ideal range`);
        }
        if ((metrics.glucose || 0) >= 140) {
          abnormalBits.push(`your blood sugar value of ${metrics.glucose} mg/dL is above the healthy target`);
        }
        if ((metrics.cholesterol || 0) >= 200) {
          abnormalBits.push(`your cholesterol value of ${metrics.cholesterol} mg/dL is on the higher side`);
        }

        if (abnormalBits.length) {
          phrase += `This is mainly because ${abnormalBits.join(' and ')}. `;
        } else {
          phrase += `This comes from the overall pattern of your blood pressure, sugar, weight, and other details. `;
        }

        const hasMeds = medications && medications.length > 0;
        if (hasMeds) {
          phrase += `The medicines and lifestyle changes suggested by your doctor are aimed at gently bringing these numbers closer to normal and lowering your long‑term risk.`;
        } else {
          phrase += `Simple steps like regular walking, home‑cooked low‑salt meals, and good sleep can slowly bring these numbers closer to normal and lower your long‑term risk.`;
        }
        return phrase;
      };

      if (!GEMINI_API_KEY) {
        return buildFallback();
      }

      const riskSummary = topPreds
        .map(p => `${p.condition}: ${p.riskLevel} (${Math.round(p.probability)}%)`)
        .join('; ');

      const medsSummary = medications.slice(0, 4).map(m => m.name).join(', ') || 'none recorded';

      const prompt = `You are a clinician explaining results to a non-medical patient.

PATIENT DETAILS
- Name: ${patient.name}
- Age: ${patient.age}
- Gender: ${patient.gender}

KEY NUMBERS
- Blood pressure: ${metrics.systolicBP || '--'}/${metrics.diastolicBP || '--'} mmHg
- Blood sugar (glucose): ${metrics.glucose || '--'} mg/dL
- Cholesterol: ${metrics.cholesterol || '--'} mg/dL
- BMI: ${metrics.bmi || '--'}

PREDICTED RISKS
${riskSummary || 'No structured risk predictions available.'}

CURRENT MEDICINES (names only)
${medsSummary}

TASK
Write a very short explanation (2–3 sentences max) in simple, friendly language that:
- Mentions any clearly abnormal values (high blood pressure, sugar, or cholesterol) only if present.
- Briefly connects these numbers to overall risks like heart disease, diabetes, or high blood pressure.
- Reassures the patient that medicines and lifestyle steps (like healthy food, walking, and sleep) can improve things over time.

RULES
- Use non-technical words.
- Be clear, calm, and reassuring.
- Do NOT list exact treatment plans or doses.
- Output ONLY the final explanation text, no headings or bullet points.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
      });

      const text = response.text?.trim();
      if (!text) return buildFallback();
      return text;
    } catch (error) {
      console.error('generatePatientSummary failed', error);
      // Last-resort safe fallback summary
      return 'Your results suggest some areas we should watch closely, but there are clear steps with medicines and lifestyle changes that can help bring your numbers closer to normal over time. Stay in touch with your doctor, and keep up small daily habits like walking, balanced home food, and good sleep.';
    }
  },

  // Generate a personalized nutrition plan with emphasis on Indian foods.
  generateNutritionPlan: async (
    patient: PatientProfile,
    metrics: HealthMetrics,
    aiResult: AIAnalysisResult | null
  ): Promise<NutritionPlan> => {
    try {
      if (!GEMINI_API_KEY) {
        console.warn("No API Key provided. Returning mock nutrition plan.");
        return getMockNutritionPlan(patient, metrics, aiResult || getMockAIResponse());
      }

      const riskSummary = aiResult?.predictions?.map(p => `${p.condition}: ${p.riskLevel} (${p.probability}%)`).join("; ") || "No structured risk data available";

      const prompt = `You are a clinical dietitian in India.
Patient details:
- Name: ${patient.name}
- Age: ${patient.age}
- Gender: ${patient.gender}
- BMI: ${metrics.bmi || "NA"}
- Blood pressure: ${metrics.systolicBP || "--"}/${metrics.diastolicBP || "--"} mmHg
- Fasting/Random glucose: ${metrics.glucose || "--"} mg/dL
- Cholesterol: ${metrics.cholesterol || "--"} mg/dL
- Activity level: ${metrics.activityLevel}
- Smoking: ${metrics.smoking ? "Yes" : "No"}

Predicted disease risks from the clinical AI engine:
${riskSummary}

TASK:
Design a ONE-DAY nutrition plan focused on Indian foods that supports the patient's risk profile (e.g., heart disease, diabetes, hypertension) and general wellness.

OUTPUT REQUIREMENTS:
- Use common Indian foods (idli, dosa, upma, poha, chapati, dal, sabzi, curd, buttermilk, millet-based dishes, sprouts, lentils, etc.).
- Prefer heart-healthy and diabetes-friendly options where needed (high fiber, low refined sugar, limited saturated fat, controlled oil and salt).
- Include 3 main meals and 2–3 snacks with approximate times.
- Add lifestyle and hydration guidance tailored to the risks.

Return JSON ONLY that matches this TypeScript-like shape:
{
  "id": string,
  "patientId": string,
  "createdAt": string,
  "overallGoal": string,
  "dailyCaloriesRange": string,
  "meals": [
    {
      "mealType": string,
      "timeOfDay": string,
      "items": [
        { "name": string, "portion": string, "calories": number, "notes": string, "cuisineTag": string }
      ],
      "notes": string
    }
  ],
  "guidance": {
    "focusAreas": string[],
    "foodsToInclude": string[],
    "foodsToLimit": string[],
    "lifestyleTips": string[],
    "hydrationTips": string,
    "activityGuidance": string
  },
  "riskAlignmentSummary": string,
  "disclaimer": string
}

STRICT RULES:
- Always prioritize Indian dishes.
- Use patient risks to justify food choices (e.g., "for diabetes risk, we avoid refined sugar and use low-GI options").
- Do NOT mention medications.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              patientId: { type: Type.STRING },
              createdAt: { type: Type.STRING },
              overallGoal: { type: Type.STRING },
              dailyCaloriesRange: { type: Type.STRING },
              meals: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    mealType: { type: Type.STRING },
                    timeOfDay: { type: Type.STRING },
                    notes: { type: Type.STRING },
                    items: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          portion: { type: Type.STRING },
                          calories: { type: Type.NUMBER },
                          notes: { type: Type.STRING },
                          cuisineTag: { type: Type.STRING }
                        }
                      }
                    }
                  }
                }
              },
              guidance: {
                type: Type.OBJECT,
                properties: {
                  focusAreas: { type: Type.ARRAY, items: { type: Type.STRING } },
                  foodsToInclude: { type: Type.ARRAY, items: { type: Type.STRING } },
                  foodsToLimit: { type: Type.ARRAY, items: { type: Type.STRING } },
                  lifestyleTips: { type: Type.ARRAY, items: { type: Type.STRING } },
                  hydrationTips: { type: Type.STRING },
                  activityGuidance: { type: Type.STRING }
                }
              },
              riskAlignmentSummary: { type: Type.STRING },
              disclaimer: { type: Type.STRING }
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No text response received from Gemini for nutrition plan.");
      }

      const data = JSON.parse(cleanJSON(text)) as NutritionPlan;

      // Ensure required identifiers are present/fallbacks
      return {
        ...data,
        id: data.id || `nutrition-${Date.now()}`,
        patientId: data.patientId || patient.id,
        createdAt: data.createdAt || new Date().toISOString(),
      };
    } catch (error) {
      console.error("Nutrition plan generation failed", error);
      return getMockNutritionPlan(patient, metrics, aiResult || getMockAIResponse());
    }
  },

  // Analyze potential drug–drug interactions for a patient's active medicines.
  // This is decision support only and MUST NOT replace formal interaction checks.
  analyzeDrugInteractions: async (
    medications: Medication[]
  ): Promise<{
    severity: 'LOW' | 'MODERATE' | 'HIGH';
    summary: string;
    pairs: { drugA: string; drugB: string; severity: 'LOW' | 'MODERATE' | 'HIGH'; risk: string; note: string }[];
    disclaimer: string;
  }> => {
    const baseDisclaimer = 'This is an AI-assisted summary based on general drug-interaction principles and is not exhaustive. Always verify important interactions with up-to-date clinical references and your local guidelines before changing therapy.';

    // Simple, safe fallback if no AI key or too few medicines
    const fallback = () => {
      if (!medications || medications.length <= 1) {
        return {
          severity: 'LOW' as const,
          summary: 'Only one or no active medicine recorded; clinically significant drug–drug interactions are unlikely from this list alone.',
          pairs: [],
          disclaimer: baseDisclaimer,
        };
      }

      const count = medications.length;
      const sev: 'LOW' | 'MODERATE' | 'HIGH' = count > 5 ? 'HIGH' : count >= 4 ? 'MODERATE' : 'LOW';

      return {
        severity: sev,
        summary: `This patient currently has ${count} active medicines. Polypharmacy increases the chance of drug–drug interactions and adverse effects.`,
        pairs: [],
        disclaimer: baseDisclaimer,
      };
    };

    try {
      if (!GEMINI_API_KEY) {
        console.warn('[GeminiService] No API key for analyzeDrugInteractions; returning fallback summary.');
        return fallback();
      }

      if (!medications || medications.length === 0) {
        return fallback();
      }

      const medList = medications.map(m => `${m.name} (${m.dosage || 'dose N/A'}, ${m.time || 'schedule N/A'})`).join('\n');

      const prompt = `You are helping a clinician quickly review possible drug–drug issues.

PATIENT MEDICATION LIST (one per line):
${medList}

TASK
- Look only at this list and use your general medical knowledge of common drug classes.
- Identify a few of the most clinically RELEVANT potential interaction pairs or duplicate-therapy concerns.
- Focus on:
  • clear interaction signals (e.g., similar drug class duplication, QT-prolonging combinations, additive bleeding risk, NSAID + ACEI + diuretic, etc.)
  • polypharmacy risk when many medicines are present, even if individual interactions are uncertain.

OUTPUT JSON ONLY with this structure:
{
  "severity": "LOW" | "MODERATE" | "HIGH",
  "summary": string,
  "pairs": [
    {
      "drugA": string,
      "drugB": string,
      "severity": "LOW" | "MODERATE" | "HIGH",
      "risk": string,
      "note": string
    }
  ],
  "disclaimer": string
}

RULES
- If you are unsure about specific named drugs or they are not recognizable generics, focus on class-level and polypharmacy comments.
- Do NOT invent guideline names or numbered recommendations.
- Do NOT provide detailed management plans or dosing changes – only brief risk descriptions.
- Always include a disclaimer reminding the doctor to verify with formal interaction checkers and local guidelines.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING, enum: ['LOW', 'MODERATE', 'HIGH'] },
              summary: { type: Type.STRING },
              disclaimer: { type: Type.STRING },
              pairs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    drugA: { type: Type.STRING },
                    drugB: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ['LOW', 'MODERATE', 'HIGH'] },
                    risk: { type: Type.STRING },
                    note: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const text = response.text;
      if (!text) {
        console.warn('analyzeDrugInteractions: empty AI response; using fallback.');
        return fallback();
      }

      const parsed = JSON.parse(cleanJSON(text)) as {
        severity?: 'LOW' | 'MODERATE' | 'HIGH';
        summary?: string;
        pairs?: { drugA: string; drugB: string; severity: 'LOW' | 'MODERATE' | 'HIGH'; risk: string; note: string }[];
        disclaimer?: string;
      };

      return {
        severity: parsed.severity || 'LOW',
        summary: parsed.summary || fallback().summary,
        pairs: Array.isArray(parsed.pairs) ? parsed.pairs : [],
        disclaimer: parsed.disclaimer || baseDisclaimer,
      };
    } catch (error) {
      console.error('analyzeDrugInteractions failed', error);
      return fallback();
    }
  },

  // Suggest a clinical reply for doctors inside the secure chat.
  // This is not auto-sent; the doctor can review and edit.
  suggestClinicalReply: async (conversationSummary: string): Promise<string> => {
    try {
      if (!GEMINI_API_KEY) {
        console.warn('No API Key provided. Returning empty suggestion.');
        return '';
      }

      const prompt = `You are a clinical decision support assistant.
The following is a brief transcript of a patient-doctor chat in a secure clinical context.

TRANSCRIPT:
${conversationSummary}

TASK:
- Draft a concise, empathetic, and medically safe reply that a licensed doctor might send.
- Do NOT include placeholders like [patient name].
- Avoid prescribing specific drugs or doses; focus on guidance, next steps, and safety advice.
- Keep it under 4 sentences.

Return ONLY the suggested reply text, with no extra commentary.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
      });

      const text = response.text?.trim() || '';
      return text;
    } catch (error) {
      console.error('AI chat suggestion failed', error);
      return '';
    }
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
  },

  analyzePrescriptionFromBase64: async (
    fileBase64: string,
    mimeType: string
  ): Promise<PrescriptionOcrResult> => {
    if (!GEMINI_API_KEY) {
      console.warn("[GeminiService] No VITE_GEMINI_API_KEY configured. Returning mock prescription OCR result.");
      return getMockPrescriptionOcrResult();
    }

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            inlineData: {
              mimeType,
              data: fileBase64
            }
          },
          {
            text: `You are an AI-powered handwritten prescription recognition system.
Your task is to process a doctor's handwritten prescription image and convert it into structured digital medical information.

Core Logic Steps:
1. OCR Recognition: Perform handwritten text recognition to extract raw text, handling background noise and unclear handwriting.
2. Medical Text Extraction: Identify medicine names, dosage values (e.g., 500mg, 5ml), frequency (e.g., 1-0-1, morning/night, BID), duration (e.g., 5 days, 1 week), and special instructions (e.g., after food).
3. Spelling Correction & Validation: Correct spelling errors using a medical drug dictionary context (e.g., correct "Paracetmol" to "Paracetamol"). Do not guess completely unreadable words; mark them as "[Unreadable]".
4. Structured Output: Return the final prescription data in the specified JSON format.

Extract the following:
- Medicines List (Name, Dosage, Frequency, Duration, Notes)
- Doctor's Name and Patient's Name
- Additional Instructions or Summary (e.g., "Drink plenty of water")
- Confidence Score (0-100)`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              medicines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    dosage: { type: Type.STRING },
                    frequency: { type: Type.STRING },
                    duration: { type: Type.STRING },
                    notes: { type: Type.STRING }
                  },
                  required: ["name", "dosage", "frequency"]
                }
              },
              confidenceScore: { type: Type.INTEGER },
              doctorName: { type: Type.STRING },
              patientName: { type: Type.STRING },
              date: { type: Type.STRING },
              summary: { type: Type.STRING }
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("No text response received from Gemini for prescription OCR.");
      }

      const data = JSON.parse(cleanJSON(text)) as PrescriptionOcrResult;
      if (!data.medicines) {
        data.medicines = [];
      }
      return data;
    } catch (error) {
      console.error("Error during prescription OCR:", error);
      throw error;
    }
  },

  // Suggest a general chat response
  chat: async (userMessage: string, context: string): Promise<string> => {
    try {
      if (!GEMINI_API_KEY) {
        return "CareXAI Demo: AI is in offline mode. Please configure VITE_GEMINI_API_KEY to enable live neural link.";
      }

      const prompt = `You are CareXAI, an advanced healthcare co-pilot.
CONTEXT:
${context}

USER MESSAGE:
${userMessage}

TASK:
Provide a helpful, clinical, yet accessible response. If the user asks for a summary, use the provided context. If they ask about symptoms, provide guidance but remind them you are an AI.
Keep the response concise and formatted in clean text.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ text: prompt }],
      });

      return response.text?.trim() || "I'm sorry, I couldn't process that command.";
    } catch (error) {
      console.error("Gemini chat failed", error);
      return "An error occurred in the neural link. Please try again.";
    }
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

const getMockNutritionPlan = (
  patient: PatientProfile,
  metrics: HealthMetrics,
  aiResult: AIAnalysisResult
): NutritionPlan => ({
  id: `nutrition-mock-${Date.now()}`,
  patientId: patient.id,
  createdAt: new Date().toISOString(),
  overallGoal: "Balanced Indian diet focusing on cardiometabolic risk reduction.",
  dailyCaloriesRange: "1500-1800 kcal (approx.)",
  meals: [
    {
      mealType: "Breakfast",
      timeOfDay: "8:00 AM",
      items: [
        {
          name: "Vegetable upma (rava or millet)",
          portion: "1 medium bowl",
          calories: 250,
          notes: "Use minimal oil, add carrots, beans, peas.",
          cuisineTag: "South Indian"
        },
        {
          name: "Plain low-fat curd",
          portion: "1 small katori",
          calories: 60,
          notes: "Helps gut health.",
          cuisineTag: "Indian"
        }
      ],
      notes: "Good fiber and protein to start the day, suitable for diabetes and BP control."
    },
    {
      mealType: "Lunch",
      timeOfDay: "1:00 PM",
      items: [
        {
          name: "2 phulka/chapati (without ghee)",
          portion: "2 medium",
          calories: 220,
          notes: "Use whole wheat or millet flour.",
          cuisineTag: "North Indian"
        },
        {
          name: "Mixed dal",
          portion: "1 katori",
          calories: 160,
          notes: "High protein, low fat.",
          cuisineTag: "Indian"
        },
        {
          name: "Stir-fried sabzi",
          portion: "1 katori",
          calories: 120,
          notes: "Use seasonal vegetables with minimal oil and salt.",
          cuisineTag: "Indian"
        }
      ],
      notes: "Balanced plate with complex carbs, protein and fiber."
    },
    {
      mealType: "Dinner",
      timeOfDay: "8:00 PM",
      items: [
        {
          name: "Vegetable khichdi (rice + moong dal) or millet khichdi",
          portion: "1 medium bowl",
          calories: 300,
          notes: "Easy to digest; keep portion controlled for diabetes.",
          cuisineTag: "Indian"
        },
        {
          name: "Salad (cucumber, tomato, carrot)",
          portion: "1 bowl",
          calories: 80,
          notes: "Avoid heavy dressing.",
          cuisineTag: "Indian"
        }
      ],
      notes: "Light dinner to support blood sugar and BP control."
    }
  ],
  guidance: {
    focusAreas: [
      "Stabilise blood sugar",
      "Support heart health",
      "Maintain healthy weight"
    ],
    foodsToInclude: [
      "Whole grains (millets, oats, brown rice in moderation)",
      "Plenty of vegetables and seasonal fruits",
      "Pulses, dals, sprouts",
      "Unsalted nuts and seeds in small portions",
      "Buttermilk, low-fat curd"
    ],
    foodsToLimit: [
      "Deep-fried snacks (samosa, pakoda)",
      "Sugar-sweetened beverages",
      "Refined flour sweets and bakery items",
      "High-salt pickles and papads"
    ],
    lifestyleTips: [
      "Aim for 30–40 minutes of brisk walking on most days after medical clearance.",
      "Avoid long sitting; stand up or walk for a few minutes every hour.",
      "Practice stress management like deep breathing or meditation for 10 minutes daily."
    ],
    hydrationTips: "Target ~2–2.5 liters of water per day unless restricted by your doctor.",
    activityGuidance: "Combine aerobic activity with light strength exercises 2–3 times a week, tailored to your fitness and doctor's advice."
  },
  riskAlignmentSummary: `Mock plan aligned with current risk profile: ${aiResult.predictions.map(p => p.condition + ' - ' + p.riskLevel).join(', ')}.`,
  disclaimer: "This is an AI-generated sample Indian diet plan for education only. Always consult a registered dietitian or your doctor before making major dietary changes."
});

const getMockPrescriptionOcrResult = (): PrescriptionOcrResult => ({
  medicines: [
    {
      name: "Sample Medicine",
      dosage: "500mg",
      frequency: "1-0-1",
      duration: "5 days",
      notes: "Demo data – configure VITE_GEMINI_API_KEY for real OCR."
    }
  ],
  confidenceScore: 60,
  doctorName: "Demo Doctor",
  patientName: "Demo Patient",
  date: new Date().toISOString().split('T')[0],
  summary: "This is a mock prescription entry. Set VITE_GEMINI_API_KEY in your .env to enable real Gemini OCR."
});
