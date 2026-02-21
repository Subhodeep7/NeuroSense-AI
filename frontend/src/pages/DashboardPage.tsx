import { useEffect, useState } from "react";

import {
  getAllPatients,
  getPredictionHistory,
} from "../api/predictionApi";

import type {
  Patient,
  Prediction,
} from "../types/prediction";


function DashboardPage() {

  const [patients, setPatients] =
    useState<Patient[]>([]);

  const [totalPredictions, setTotalPredictions] =
    useState(0);

  const [latestPrediction, setLatestPrediction] =
    useState<Prediction | null>(null);

  const [loading, setLoading] =
    useState(true);


  useEffect(() => {

    loadDashboard();

  }, []);


  async function loadDashboard() {

    try {

      const patientsData =
        await getAllPatients();

      setPatients(patientsData);


      let predictionCount = 0;

      let latest: Prediction | null = null;


      for (const patient of patientsData) {

        const history =
          await getPredictionHistory(patient.id);

        predictionCount += history.length;


        for (const pred of history) {

          if (
            !latest ||
            new Date(pred.createdAt) >
            new Date(latest.createdAt)
          ) {

            latest = pred;

          }

        }

      }


      setTotalPredictions(predictionCount);

      setLatestPrediction(latest);

    }
    catch (error) {

      console.error(
        "Dashboard load failed",
        error
      );

    }

    setLoading(false);

  }


  if (loading) {

    return (

      <div className="text-center py-10 text-gray-500">

        Loading dashboard...

      </div>

    );

  }


  return (

    <div className="space-y-6">

      {/* Title */}

      <div>

        <h2 className="text-2xl font-bold text-gray-800">

          Dashboard

        </h2>

        <p className="text-gray-500">

          Overview of NeuroSense-AI system

        </p>

      </div>


      {/* Stats Cards */}

      <div className="grid md:grid-cols-3 gap-6">


        {/* Total Patients */}

        <div className="bg-white shadow rounded-xl p-6">

          <p className="text-gray-500 text-sm">

            Total Patients

          </p>

          <p className="text-3xl font-bold text-blue-600 mt-2">

            {patients.length}

          </p>

        </div>


        {/* Total Predictions */}

        <div className="bg-white shadow rounded-xl p-6">

          <p className="text-gray-500 text-sm">

            Total Predictions

          </p>

          <p className="text-3xl font-bold text-purple-600 mt-2">

            {totalPredictions}

          </p>

        </div>


        {/* Latest Result */}

        <div className="bg-white shadow rounded-xl p-6">

          <p className="text-gray-500 text-sm">

            Latest Result

          </p>

          {latestPrediction ? (

            <div className="mt-2">

              <p
                className={`text-lg font-semibold ${
                  latestPrediction.prediction === 1
                    ? "text-red-600"
                    : "text-green-600"
                }`}
              >

                {latestPrediction.prediction === 1
                  ? "Parkinson's Detected"
                  : "Healthy"}

              </p>

              <p className="text-sm text-gray-500">

                {(latestPrediction.confidence * 100)
                  .toFixed(2)}% confidence

              </p>

            </div>

          ) : (

            <p className="text-gray-400 mt-2">

              No predictions yet

            </p>

          )}

        </div>


      </div>


      {/* Recent Prediction Card */}

      {latestPrediction && (

        <div className="bg-white shadow rounded-xl p-6">

          <h3 className="text-lg font-semibold mb-2">

            Latest Prediction Details

          </h3>

          <p className="text-gray-600">

            Date:{" "}

            {new Date(
              latestPrediction.createdAt
            ).toLocaleString()}

          </p>

          <p className="text-gray-600">

            Confidence:{" "}

            {(latestPrediction.confidence * 100)
              .toFixed(2)}%

          </p>

        </div>

      )}

    </div>

  );

}

export default DashboardPage;