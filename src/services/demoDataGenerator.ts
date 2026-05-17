import { Hospital, HealthcareFacility, BackendDoctor } from '@/types';

const getRandomOffset = (radius: number = 0.02) => (Math.random() * radius * 2) - radius;

export const generateDemoHospitals = (centerLat: number, centerLng: number): Hospital[] => {
  const names = ["Apollo Hospital", "City Care Medical", "Emergency Trauma Center", "Metro General Hospital", "Unity Health Hub"];
  return names.map((name, i) => ({
    id: `demo-hosp-${i}`,
    name,
    type: 'HOSPITAL',
    location: {
      latitude: centerLat + getRandomOffset(),
      longitude: centerLng + getRandomOffset(),
      address: `${100 + i}, Healthcare Street, Cyber City`
    },
    emergencyStatus: i === 0, // Apollo as emergency
    activePatients: 20 + Math.floor(Math.random() * 100),
    queueWaitTime: 5 + Math.floor(Math.random() * 45),
    verified: true,
    rating: 4.5 + (Math.random() * 0.5),
    imageUrl: `https://images.unsplash.com/photo-1587351021759-3e566b6af7cc?w=800&q=80`
  } as any));
};

export const generateDemoDoctors = (centerLat: number, centerLng: number): BackendDoctor[] => {
  const specialists = [
    { name: "Dr. Ramesh", spec: "Cardiologist" },
    { name: "Dr. Priya", spec: "Neurologist" },
    { name: "Dr. Amit", spec: "General Physician" },
    { name: "Dr. Sarah", spec: "Pediatrician" },
    { name: "Dr. Vikram", spec: "Oncologist" }
  ];
  return specialists.map((doc, i) => ({
    id: `demo-doc-${i}`,
    name: doc.name,
    role: 'DOCTOR',
    specialization: doc.spec,
    experienceYears: 5 + i * 2,
    rating: 4.7 + (Math.random() * 0.3),
    consultationFee: 500 + (Math.random() * 500),
    hospital: i % 2 === 0 ? "Apollo Hospital" : "City Care Medical",
    status: 'online',
    latitude: centerLat + getRandomOffset(),
    longitude: centerLng + getRandomOffset(),
    verified: true,
    profilePicUrl: `https://i.pravatar.cc/150?u=demo-doc-${i}`
  } as any));
};

export const generateDemoPharmacies = (centerLat: number, centerLng: number): HealthcareFacility[] => {
  const names = ["MedPlus", "Apollo Pharmacy", "Wellness Forever", "CareX Pharma", "NetMeds Hub"];
  return names.map((name, i) => ({
    id: `demo-phar-${i}`,
    name,
    type: 'PHARMACY',
    latitude: centerLat + getRandomOffset(),
    longitude: centerLng + getRandomOffset(),
    address: `${50 + i}, Pharma Lane, Cyber City`,
    verified: true,
    status: i % 3 === 0 ? 'closed' : 'online',
    rating: 4.2 + (Math.random() * 0.8)
  } as any));
};

export const generateDemoLabs = (centerLat: number, centerLng: number): HealthcareFacility[] => {
  const names = ["Thyrocare", "RedLabs Diagnostics", "Precision Path", "Cyber Lab", "Genomic Research"];
  return names.map((name, i) => ({
    id: `demo-lab-${i}`,
    name,
    type: 'LAB',
    latitude: centerLat + getRandomOffset(),
    longitude: centerLng + getRandomOffset(),
    address: `${20 + i}, Diagnostic Square, Cyber City`,
    verified: true,
    status: 'online',
    rating: 4.6 + (Math.random() * 0.4),
    availableTests: ["Blood Test", "MRI", "CT Scan", "DNA Analysis"]
  } as any));
};

export const generateDemoAmbulances = (centerLat: number, centerLng: number): any[] => {
  const plates = ["AX-01-992", "CY-09-110", "RX-22-404", "MX-77-888", "ZX-00-001"];
  return plates.map((plate, i) => ({
    id: `demo-amb-${i}`,
    plateNumber: plate,
    status: i % 2 === 0 ? 'EN_ROUTE' : 'AVAILABLE',
    latitude: centerLat + getRandomOffset(0.04),
    longitude: centerLng + getRandomOffset(0.04),
    speed: 40 + Math.random() * 40,
    heading: Math.random() * 360
  }));
};

export const generateDemoEmergencies = (centerLat: number, centerLng: number): any[] => {
  const types = ["Cardiac Arrest", "Respiratory Distress", "Trauma - Grade A", "Biometric Anomaly", "Unknown Critical"];
  return types.map((type, i) => ({
    id: `demo-em-${i}`,
    type,
    latitude: centerLat + getRandomOffset(0.03),
    longitude: centerLng + getRandomOffset(0.03),
    severity: i === 0 ? 'CRITICAL' : 'HIGH',
    timestamp: new Date().toISOString(),
    address: `${404 + i}, Crisis Sector, Cyber City`
  }));
};

export const generateDemoRiskZones = (centerLat: number, centerLng: number): any[] => {
  return [
    { id: 'zone-1', lat: centerLat + 0.01, lng: centerLng + 0.01, level: 'CRITICAL', radius: 500 },
    { id: 'zone-2', lat: centerLat - 0.015, lng: centerLng + 0.02, level: 'ELEVATED', radius: 800 },
    { id: 'zone-3', lat: centerLat + 0.02, lng: centerLng - 0.01, level: 'SAFE', radius: 1000 },
  ];
};
