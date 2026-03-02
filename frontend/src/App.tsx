import { useState } from "react";

import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";
import PatientsPage from "./pages/PatientsPage";

function App() {

  const [page, setPage] = useState<"dashboard" | "predict" | "history" | "patients">("dashboard");

  const pages = {
    dashboard: <DashboardPage />,
    predict: <PredictionPage />,
    history: <HistoryPage />,
    patients: <PatientsPage />,
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">

      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">

          <h1 className="text-2xl font-bold text-blue-600">
            NeuroSense-AI
          </h1>

          <nav className="flex gap-3">

            <button
              onClick={() => setPage("dashboard")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "dashboard"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 hover:bg-blue-50 text-gray-700"
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => setPage("predict")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "predict"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 hover:bg-blue-50 text-gray-700"
              }`}
            >
              Prediction
            </button>

            <button
              onClick={() => setPage("history")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "history"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 hover:bg-blue-50 text-gray-700"
              }`}
            >
              History
            </button>

            <button
              onClick={() => setPage("patients")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "patients"
                  ? "bg-blue-600 text-white shadow"
                  : "bg-gray-100 hover:bg-blue-50 text-gray-700"
              }`}
            >
              Patients
            </button>

          </nav>
        </div>
      </header>

      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">

        {pages[page]}

      </main>

    </div>
  );
}

export default App;