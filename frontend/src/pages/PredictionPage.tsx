import { useEffect, useState } from "react";
import RiskGauge from "../components/RiskGauge";
import {
  getAllPatients,
  predictMultimodal
} from "../api/predictionApi";

import type { Patient } from "../types/prediction";

function PredictionPage() {

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);

  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  async function loadPatients() {
    try {
      const data = await getAllPatients();
      setPatients(data);
    } catch {
      alert("Failed to load patients");
    }
  }

  async function handlePredict() {

    if (!selectedPatient) {
      alert("Select patient first");
      return;
    }

    if (!voiceFile) {
      alert("Upload voice file (.wav)");
      return;
    }

    if (!handwritingFile) {
      alert("Upload handwriting image");
      return;
    }

    setLoading(true);

    try {

      const response =
        await predictMultimodal(
          voiceFile,
          handwritingFile,
          selectedPatient
        );

      setResult(response);

    } catch (error) {

      console.error(error);
      alert("Prediction failed");

    }

    setLoading(false);
  }

  return (

    <div className="max-w-2xl mx-auto space-y-6">

      {/* Title */}
      <div>

        <h2 className="text-2xl font-bold text-gray-800">
          NeuroSense Multimodal Prediction
        </h2>

        <p className="text-gray-500">
          Upload voice + handwriting sample to screen for Parkinson's
        </p>

      </div>


      {/* Patient Selector */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Patient
        </label>

        <select
          onChange={(e) =>
            setSelectedPatient(Number(e.target.value))
          }
          className="w-full border rounded-lg px-4 py-2"
        >

          <option value="">
            Choose a patient
          </option>

          {patients.map((p) => (

            <option
              key={p.id}
              value={p.id}
            >

              {p.name} (Age {p.age})

            </option>

          ))}

        </select>

      </div>


      {/* Voice Upload */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-3">
          Upload Voice Sample (.wav)
        </label>

        <input
          type="file"
          accept=".wav"
          onChange={(e) =>
            setVoiceFile(
              e.target.files?.[0] || null
            )
          }
        />

        {voiceFile && (

          <>
            <p className="text-green-600 mt-2">
              Selected: {voiceFile.name}
            </p>

            {/* Audio Player */}
            <audio
              controls
              className="mt-3 w-full"
              src={URL.createObjectURL(voiceFile)}
            />

          </>

        )}

      </div>


      {/* Handwriting Upload */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-3">
          Upload Handwriting Image
        </label>

        <input
          type="file"
          accept=".png,.jpg,.jpeg"
          onChange={(e) =>
            setHandwritingFile(
              e.target.files?.[0] || null
            )
          }
        />

        {handwritingFile && (

          <>
            <p className="text-green-600 mt-2">
              Selected: {handwritingFile.name}
            </p>

            {/* Image Preview */}
            <img
              src={URL.createObjectURL(handwritingFile)}
              alt="Handwriting Preview"
              className="mt-3 rounded-lg border max-h-48"
            />

          </>

        )}

      </div>


      {/* Predict Button */}
      <button
        onClick={handlePredict}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-semibold text-white ${
          loading
            ? "bg-gray-400"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >

        {loading
          ? "Analyzing..."
          : "Analyze Parkinson Risk"}

      </button>


      {/* Result */}
      {result && (

        <div className="bg-white shadow rounded-xl p-6 space-y-4">

          <h3 className="text-lg font-semibold">
            Prediction Result
          </h3>

          <p>
            Voice Confidence:
            <span className="ml-2 font-semibold text-blue-600">
              {(result.voice.confidence * 100).toFixed(2)}%
            </span>
          </p>

          <p>
            Handwriting Confidence:
            <span className="ml-2 font-semibold text-blue-600">
              {(result.handwriting.confidence * 100).toFixed(2)}%
            </span>
          </p>

          {/* Risk Meter */}
          <RiskGauge
            risk={result.finalRisk}
            level={result.riskLevel}
          />

        </div>

      )}

    </div>

  );
}

export default PredictionPage;