from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import datetime

app = FastAPI(title="CareXAI Prediction Engine")

# --- Models ---
class PatientTelemetry(BaseModel):
    patientId: str
    heartRate: float
    bloodPressureSystolic: float
    glucoseLevel: float
    temperature: float

class HospitalLoad(BaseModel):
    hospitalId: str
    occupancyPercent: float
    icuAvailability: int
    emergencyQueue: int

class AnalysisRequest(BaseModel):
    telemetry: List[PatientTelemetry]
    hospitals: List[HospitalLoad]

# --- Simple ML Logic ---
# In a real-world scenario, we would load a pre-trained model.
# Here we initialize a basic classifier to demonstrate the real pipeline.
risk_model = RandomForestClassifier(n_estimators=10)
# Dummy training data for initialization
X_train = np.array([[60, 120, 90, 36.5], [120, 180, 250, 39.5], [80, 130, 110, 37.0], [150, 200, 350, 40.0]])
y_train = np.array([0, 2, 1, 2]) # 0: Low, 1: Medium, 2: Critical
risk_model.fit(X_train, y_train)

@app.post("/analyze-risk")
async def analyze_risk(request: AnalysisRequest):
    results = []
    
    # 1. Individual Patient Risk Analysis
    for p in request.telemetry:
        features = np.array([[p.heartRate, p.bloodPressureSystolic, p.glucoseLevel, p.temperature]])
        risk_score = risk_model.predict_proba(features)[0]
        max_risk_level = int(np.argmax(risk_score))
        
        results.append({
            "patientId": p.patientId,
            "riskLevel": ["LOW", "MEDIUM", "CRITICAL"][max_risk_level],
            "confidence": float(np.max(risk_score)),
            "timestamp": datetime.datetime.now().isoformat()
        })
        
    # 2. Regional Crisis Prediction
    avg_occupancy = np.mean([h.occupancyPercent for h in request.hospitals]) if request.hospitals else 0
    crisis_zones = []
    
    if avg_occupancy > 80:
        crisis_zones.append({
            "zoneId": "Zone-A-Central",
            "threat": "Hospital Overload Predicted",
            "severity": "CRITICAL",
            "probability": 0.92
        })
        
    return {
        "individualRisks": results,
        "crisisZones": crisis_zones,
        "systemStatus": "CRITICAL" if avg_occupancy > 75 else "STABLE"
    }

@app.get("/health")
async def health_check():
    return {"status": "online", "engine": "CareXAI-X1"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
