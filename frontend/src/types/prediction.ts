// Request for feature-based prediction
export interface PredictionRequest {
  name: string;
  age: number;
  gender: string;
  features: number[];
}

// Patient entity (from backend)
export interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
}

// Prediction history record
export interface Prediction {
  id: number;
  filePath: string;
  originalFileName: string;

  // Patient info is returned as flat fields by the /api/predictions/latest endpoint
  // (avoids Hibernate proxy serialization issues with List<Prediction>)
  patientId?: number;
  patientName?: string;

  voiceConfidence?: number;
  handwritingConfidence?: number;
  gaitConfidence?: number;
  tremorConfidence?: number;
  visualConfidence?: number;
  reactionTimeMs?: number;

  finalPrediction: number;
  finalRisk: number;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";

  createdAt: string;
}