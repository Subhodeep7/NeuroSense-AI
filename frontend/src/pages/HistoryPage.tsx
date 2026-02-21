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

      const data =
        await getAllPatients();

      setPatients(data);

    }
    catch (error) {

      console.error(
        "Failed to load patients",
        error
      );

    }

  };


  const loadHistory = async (
    patientId: number
  ) => {

    setSelectedPatient(patientId);

    try {

      const data =
        await getPredictionHistory(patientId);

      setHistory(data);

    }
    catch (error) {

      console.error(
        "Failed to load history",
        error
      );

    }

  };


  return (

    <div className="max-w-4xl mx-auto space-y-6">

      {/* Title */}
      <div>

        <h2 className="text-2xl font-bold text-gray-800">
          Prediction History
        </h2>

        <p className="text-gray-500">
          View past prediction results for patients
        </p>

      </div>


      {/* Patient Selector Card */}
      <div className="bg-white shadow rounded-xl p-6">

        <label className="block text-sm font-medium text-gray-700 mb-2">

          Select Patient

        </label>

        <select
          onChange={(e) =>
            loadHistory(
              Number(e.target.value)
            )
          }
          className="w-full md:w-80 border rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
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


      {/* History Table Card */}
      {selectedPatient && (

        <div className="bg-white shadow rounded-xl p-6">

          <h3 className="text-lg font-semibold mb-4">
            Prediction Records
          </h3>


          {history.length === 0 ? (

            <p className="text-gray-500">
              No prediction history found.
            </p>

          ) : (

            <div className="overflow-x-auto">

              <table className="w-full">

                <thead>

                  <tr className="border-b text-left text-gray-600">

                    <th className="py-2">
                      Date
                    </th>

                    <th className="py-2">
                      Result
                    </th>

                    <th className="py-2">
                      Confidence
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {history.map((h) => (

                    <tr
                      key={h.id}
                      className="border-b hover:bg-gray-50"
                    >

                      <td className="py-2">

                        {new Date(
                          h.createdAt
                        ).toLocaleString()}

                      </td>

                      <td className="py-2 font-semibold">

                        <span
                          className={
                            h.prediction === 1
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        >

                          {h.prediction === 1
                            ? "Parkinson's Detected"
                            : "Healthy"}

                        </span>

                      </td>

                      <td className="py-2 text-blue-600 font-medium">

                        {(h.confidence * 100)
                          .toFixed(2)}%

                      </td>

                    </tr>

                  ))}

                </tbody>

              </table>

            </div>

          )}

        </div>

      )}

    </div>

  );

}

export default HistoryPage;