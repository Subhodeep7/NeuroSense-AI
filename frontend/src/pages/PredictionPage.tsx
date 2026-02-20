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

    <div
      style={{
        padding: "40px",
        maxWidth: "600px",
        margin: "auto"
      }}
    >

      <h1>NeuroSense AI</h1>

      <p>Audio-based Parkinson's Detection</p>


      {/* Patient selector */}

      <select
        onChange={(e) =>
          setSelectedPatient(
            Number(e.target.value)
          )
        }
        style={{
          width: "100%",
          padding: "10px",
          marginBottom: "20px"
        }}
      >

        <option>
          Select Patient
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


      {/* File upload */}

      <input
        type="file"
        accept=".wav"
        onChange={(e) =>
          setFile(
            e.target.files?.[0] || null
          )
        }
        style={{
          marginBottom: "20px"
        }}
      />


      {/* Predict button */}

      <button
        onClick={handlePredict}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          backgroundColor: "#4CAF50",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >

        {loading
          ? "Predicting..."
          : "Predict"}

      </button>


      {/* Result */}

      {result && (

        <div
          style={{
            marginTop: "30px"
          }}
        >

          <h3>Result</h3>

          <p>

            Prediction:
            {result.prediction === 1
              ? " Parkinson's Detected"
              : " Healthy"}

          </p>

          <p>

            Confidence:
            {(result.confidence * 100)
              .toFixed(2)}%

          </p>

        </div>

      )}

    </div>

  );

}

export default PredictionPage;
