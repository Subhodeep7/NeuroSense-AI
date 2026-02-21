import { useEffect, useState } from "react";

import {
  uploadAudio,
  getAllPatients
} from "../api/predictionApi";

import type {
  Patient
} from "../types/prediction";


function PredictionPage() {

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [selectedPatient, setSelectedPatient] =
    useState<number | null>(null);

  const [file, setFile] =
    useState<File | null>(null);

  const [result, setResult] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(false);


  useEffect(() => {

    loadPatients();

  }, []);


  async function loadPatients() {

    try {

      const data =
        await getAllPatients();

      setPatients(data);

    }
    catch {

      alert("Failed to load patients");

    }

  }


  async function handlePredict() {

    if (!selectedPatient) {

      alert("Select patient first");
      return;

    }

    if (!file) {

      alert("Select audio file");
      return;

    }

    setLoading(true);

    try {

      const response =
        await uploadAudio(
          file,
          selectedPatient
        );

      setResult(response);

    }
    catch (error) {

      alert("Prediction failed");

      console.error(error);

    }

    setLoading(false);

  }


  return (

    <div className="max-w-2xl mx-auto space-y-6">

      {/* Page Title */}
      <div>

        <h2 className="text-2xl font-bold text-gray-800">
          Audio Prediction
        </h2>

        <p className="text-gray-500">
          Upload patient voice sample to detect Parkinson's
        </p>

      </div>


      {/* Patient Selector Card */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Patient
        </label>

        <select
          onChange={(e) =>
            setSelectedPatient(
              Number(e.target.value)
            )
          }
          className="w-full border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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


      {/* File Upload Card */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-3">
          Upload Audio File (.wav)
        </label>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition">

          <input
            type="file"
            accept=".wav"
            onChange={(e) =>
              setFile(
                e.target.files?.[0] || null
              )
            }
            className="mx-auto block"
          />

          {file && (

            <p className="mt-3 text-sm text-green-600 font-medium">
              Selected: {file.name}
            </p>

          )}

        </div>

      </div>


      {/* Predict Button */}
      <button
        onClick={handlePredict}
        disabled={loading}
        className={`w-full py-3 rounded-xl font-semibold text-white transition ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >

        {loading
          ? "Predicting..."
          : "Run Prediction"}

      </button>


      {/* Result Card */}
      {result && (

        <div className="bg-white shadow rounded-xl p-6">

          <h3 className="text-lg font-semibold mb-4">
            Prediction Result
          </h3>

          <div className="space-y-2">

            <p className="text-gray-700">

              Status:

              <span
                className={`ml-2 font-semibold ${
                  result.prediction === 1
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >

                {result.prediction === 1
                  ? "Parkinson's Detected"
                  : "Healthy"}

              </span>

            </p>

            <p className="text-gray-700">

              Confidence:

              <span className="ml-2 font-semibold text-blue-600">

                {(result.confidence * 100)
                  .toFixed(2)}%

              </span>

            </p>

          </div>

        </div>

      )}

    </div>

  );

}

export default PredictionPage;