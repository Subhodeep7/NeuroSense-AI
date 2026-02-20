import { useEffect, useState } from "react";
import {
  getAllPatients,
  getPredictionHistory,
} from "../api/predictionApi";

import type {
  Patient,
  Prediction,
} from "../types/prediction";

function HistoryPage() {

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [selectedPatient, setSelectedPatient] =
    useState<number | null>(null);

  const [history, setHistory] =
    useState<Prediction[]>([]);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    try {
      const data = await getAllPatients();
      setPatients(data);
    } catch (error) {
      console.error("Failed to load patients", error);
    }
  };

  const loadHistory = async (patientId: number) => {
    setSelectedPatient(patientId);

    try {
      const data =
        await getPredictionHistory(patientId);

      setHistory(data);
    } catch (error) {
      console.error("Failed to load history", error);
    }
  };

  return (
    <div style={{ padding: "40px", fontFamily: "Arial" }}>

      <h1>Prediction History</h1>

      {/* Patient selector */}

      <select
        onChange={(e) =>
          loadHistory(Number(e.target.value))
        }
        style={{
          padding: "10px",
          marginBottom: "20px",
          width: "300px"
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


      {/* History Table */}

      {selectedPatient && (

        <table
          border={1}
          cellPadding={10}
          style={{
            borderCollapse: "collapse",
            width: "100%"
          }}
        >

          <thead>
            <tr>
              <th>Date</th>
              <th>Result</th>
              <th>Confidence</th>
            </tr>
          </thead>

          <tbody>

            {history.map((h) => (
              <tr key={h.id}>

                <td>
                  {new Date(
                    h.createdAt
                  ).toLocaleString()}
                </td>

                <td>
                  {h.prediction === 1
                    ? "Parkinson's Detected"
                    : "Healthy"}
                </td>

                <td>
                  {(h.confidence * 100)
                    .toFixed(2)}%
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      )}

    </div>
  );
}

export default HistoryPage;
