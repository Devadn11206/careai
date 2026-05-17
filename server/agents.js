/**
 * CareXAI Agentic AI Engine - Specialized Agent Definitions
 */

export const AGENT_ROLES = {
  SYMPTOM_ANALYST: {
    name: "Clinical Diagnostic Agent",
    prompt: `You are the Clinical Diagnostic Agent. Your role is to analyze symptoms provided by the patient.
    - Ask clarifying questions about duration, severity, and onset.
    - Categorize symptoms into body systems.
    - Recommend the most appropriate medical department.
    - Do NOT give a definitive diagnosis, only clinical possibilities.`
  },
  EMERGENCY_DISPATCHER: {
    name: "Critical Care Agent",
    prompt: `You are the Critical Care Agent. Your role is to detect immediate life-threatening conditions.
    - Monitor for "Red Flag" symptoms (chest pain, shortness of breath, sudden numbness, severe bleeding).
    - If detected, immediately trigger the 'send_emergency_alert' tool.
    - Guide the user through basic first aid while help is dispatched.`
  },
  PHARMACY_SPECIALIST: {
    name: "Prescription Intelligence Agent",
    prompt: `You are the Prescription Intelligence Agent. Your role is to explain medications.
    - Identify potential drug-drug interactions if multiple meds are listed.
    - Explain dosage instructions and side effects.
    - Remind patients about adherence based on their history.`
  },
  CHRONIC_CARE_MONITOR: {
    name: "Realtime Telemetry Agent",
    prompt: `You are the Realtime Telemetry Agent. Your role is to analyze biometric trends.
    - Look at BP, Heart Rate, and Glucose trends over time.
    - Detect anomalies (spikes or drops) that deviate from the patient's baseline.
    - Classify risk levels based on clinical thresholds.`
  }
};

export const SYSTEM_ORCHESTRATOR_PROMPT = (userName, role, patientContext) => `
You are the CareXAI Nexus Orchestrator, the central brain of a production-grade Agentic AI Healthcare System.
Current User: ${userName} (Role: ${role})

CONTEXTUAL INTELLIGENCE:
${patientContext}

OPERATIONAL PROTOCOLS:
1. DIRECT ACTION: Do not "plan" or "reason" out loud. If a user requests an appointment, immediately invoke the 'book_clinical_appointment' tool.
2. NO REASONING TRACES: Do NOT use [PLAN] or [REASONING] tags. Never expose planning, reasoning, tool calls, or raw JSON to the user.
3. INFRASTRUCTURE RESILIENCE: If a tool fails, do not explain technical failures. Switch to a "Hard Force" approach by verifying names heuristically and re-executing.
4. DATA FORMATTING: Always use ISO 8601 for dates (YYYY-MM-DD) and 24-hour format for time (e.g., "14:00").
5. NATURAL RESPONSES: Maintain a professional, human-friendly concierge tone. Confirm actions naturally after they are executed silently.
6. ERROR HANDLING: If a timeout occurs, bypass intermediate steps and move straight to tool execution.

IMPORTANT: Your response should ONLY be the final human-friendly message. Execute all necessary tools before providing this message.
`;

export const AI_TOOLS = [
  {
    type: "function",
    function: {
      name: "find_nearby_hospitals",
      description: "Locates nearby hospitals and trauma centers based on proximity.",
      parameters: {
        type: "object",
        properties: {
          radius: { type: "number", description: "Search radius in km (default 15)" },
          department: { type: "string", description: "Filter for specific departments like CARDIOLOGY, TRAUMA" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_clinician",
      description: "Searches for verified clinicians and specialists nearby. Use this to find doctor IDs and names.",
      parameters: {
        type: "object",
        properties: {
          specialization: { type: "string", description: "e.g., Cardiologist, Pediatrician" },
          doctorName: { type: "string", description: "Partial or full name of the doctor" },
          availability: { type: "string", enum: ["IMMEDIATE", "TODAY", "WEEK"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_vitals_trend",
      description: "Retrieves a longitudinal view of patient vitals for trend analysis.",
      parameters: {
        type: "object",
        properties: {
          metric: { type: "string", enum: ["BP", "HEART_RATE", "GLUCOSE", "OXYGEN"] },
          days: { type: "number", description: "Number of days of history" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_clinical_appointment",
      description: "Directly schedules a consultation in the hospital management system. Ensure you have the date and time from the user first.",
      parameters: {
        type: "object",
        properties: {
          doctorId: { type: "string", description: "UUID of the doctor or their name (e.g., 'Dr. Deva')" },
          date: { type: "string", description: "Date in ISO 8601 format (YYYY-MM-DD)" },
          time: { type: "string", description: "Time in 24-hour format (HH:mm)" },
          reason: { type: "string", description: "Reason for visit or symptoms" }
        },
        required: ["doctorId", "date", "time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_medical_records",
      description: "Fetches previous reports, prescriptions, and clinical summaries.",
      parameters: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["LAB_REPORT", "PRESCRIPTION", "SUMMARY", "SCAN"] }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "start_video_consultation",
      description: "Triggers the real-time video consultation interface.",
      parameters: {
        type: "object",
        properties: {
          doctorId: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_nearby_pharmacy",
      description: "Locates pharmacies and checks medicine stock availability.",
      parameters: {
        type: "object",
        properties: {
          medicineName: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "book_lab_test",
      description: "Schedules a laboratory test or diagnostic scan.",
      parameters: {
        type: "object",
        properties: {
          testName: { type: "string" },
          preferredDate: { type: "string" }
        },
        required: ["testName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_prescription_ocr",
      description: "Analyzes an uploaded prescription or report using medical OCR.",
      parameters: {
        type: "object",
        properties: {
          fileId: { type: "string" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_emergency_alert",
      description: "Triggers a high-priority emergency response and notifies the nearest hospital dispatcher.",
      parameters: {
        type: "object",
        properties: {
          urgency: { type: "string", enum: ["HIGH", "CRITICAL"] },
          description: { type: "string" }
        },
        required: ["urgency", "description"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "analyze_symptoms",
      description: "Deep analysis of symptoms using the clinical diagnostic engine.",
      parameters: {
        type: "object",
        properties: {
          symptoms: { type: "string" }
        },
        required: ["symptoms"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "control_ui",
      description: "Controls the dashboard UI components and navigation.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["NAVIGATE", "OPEN_MODAL", "FOCUS_MAP", "SCROLL_TO"] },
          target: { type: "string" }
        },
        required: ["action", "target"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "check_availability",
      description: "Checks real-time slot availability for a specific doctor or department.",
      parameters: {
        type: "object",
        properties: {
          doctorId: { type: "string", description: "Unique ID or name of the doctor" },
          date: { type: "string", description: "YYYY-MM-DD" }
        },
        required: ["date"]
      }
    }
  }
];
