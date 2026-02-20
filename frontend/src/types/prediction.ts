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

// Prediction history record (NEW table)
export interface Prediction {
  id: number;
  filePath: string;
  originalFileName: string;
  prediction: number;
  confidence: number;
  createdAt: string;
}
