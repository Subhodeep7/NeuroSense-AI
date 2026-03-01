import axios from "axios";
import type { Patient, Prediction } from "../types/prediction";

const BASE_URL = "http://localhost:8080/api";


export async function getAllPatients(): Promise<Patient[]> {

    const response =
        await axios.get(`${BASE_URL}/patients`);

    console.log("PATIENT API RESPONSE:", response.data);

    if (Array.isArray(response.data)) {
        return response.data;
    }

    return [];
}


export async function getPredictionHistory(
    patientId: number
): Promise<Prediction[]> {

    const response =
        await axios.get(
            `${BASE_URL}/patients/${patientId}/predictions`
        );

    console.log("HISTORY API RESPONSE:", response.data);

    if (Array.isArray(response.data)) {
        return response.data;
    }

    return [];
}


/*
VOICE ONLY (keep existing)
*/
export async function uploadAudio(
    file: File,
    patientId: number
) {

    const formData = new FormData();

    formData.append("file", file);
    formData.append("patientId", patientId.toString());

    const response =
        await axios.post(
            `${BASE_URL}/predict-audio`,
            formData
        );

    return response.data;
}


/*
NEW — MULTIMODAL PREDICTION
*/
export async function predictMultimodal(
    voiceFile: File,
    handwritingFile: File,
    patientId: number
) {

    const formData = new FormData();

    formData.append("voiceFile", voiceFile);
    formData.append("handwritingFile", handwritingFile);
    formData.append("patientId", patientId.toString());

    const response =
        await axios.post(
            `${BASE_URL}/predict-multimodal`,
            formData,
            {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            }
        );

    return response.data;
}