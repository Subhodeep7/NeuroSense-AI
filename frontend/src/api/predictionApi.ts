import axios from "axios";
import type { Patient, Prediction } from "../types/prediction";

const BASE_URL = "http://localhost:8080/api";

export async function getAllPatients(): Promise<Patient[]> {
    const response = await axios.get(`${BASE_URL}/patients`);
    if (Array.isArray(response.data)) return response.data;
    return [];
}

export async function createPatient(patient: Partial<Patient>): Promise<Patient> {
    const response = await axios.post(`${BASE_URL}/patients`, patient);
    return response.data;
}

export async function getPredictionHistory(patientId: number): Promise<Prediction[]> {
    const response = await axios.get(`${BASE_URL}/patients/${patientId}/predictions`);
    if (Array.isArray(response.data)) return response.data;
    return [];
}

/** Single most-recent prediction across all patients — used by the dashboard. */
export async function getLatestPrediction(): Promise<Prediction | null> {
    try {
        const response = await axios.get(`${BASE_URL}/predictions/latest`);
        return response.data ?? null;
    } catch {
        return null;
    }
}

/** Total count of all predictions — used by the dashboard. */
export async function getTotalPredictions(): Promise<number> {
    try {
        const response = await axios.get(`${BASE_URL}/predictions/count`);
        return typeof response.data === "number" ? response.data : 0;
    } catch {
        return 0;
    }
}

/** All predictions sorted newest-first — used by the History page. */
export async function getAllPredictions(): Promise<any[]> {
    const response = await axios.get(`${BASE_URL}/predictions/all`);
    return Array.isArray(response.data) ? response.data : [];
}

export async function uploadAudio(file: File, patientId: number) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("patientId", patientId.toString());
    const response = await axios.post(`${BASE_URL}/predict-audio`, formData);
    return response.data;
}

export async function predictFull(
    voiceFile: File | null,
    handwritingFile: File | null,
    tremorFile: File | null,
    reactionTimeMs: number | null,
    videoFile: File | null,
    patientId: number
) {
    const formData = new FormData();

    if (voiceFile)       formData.append("voiceFile", voiceFile);
    if (handwritingFile) formData.append("handwritingFile", handwritingFile);
    if (reactionTimeMs)  formData.append("reactionTimeMs", reactionTimeMs.toString());
    if (videoFile)       formData.append("videoFile", videoFile);
    formData.append("patientId", patientId.toString());

    if (tremorFile) {
        const text = await tremorFile.text();
        formData.append("tremorData", text);
    }

    const response = await axios.post(`${BASE_URL}/predict-full`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
    });

    return response.data;
}