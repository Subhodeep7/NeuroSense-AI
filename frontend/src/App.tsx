import { useState } from "react";

import DashboardPage from "./pages/DashboardPage";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";
import PatientsPage from "./pages/PatientsPage";

function App() {

  const [page, setPage] = useState("dashboard");

  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return <DashboardPage />;
      case "predict":
        return <PredictionPage />;
      case "history":
        return <HistoryPage />;
      case "patients":
        return <PatientsPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (

    <div className="min-h-screen bg-gray-100">

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
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Dashboard
            </button>

            <button
              onClick={() => setPage("predict")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "predict"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Prediction
            </button>

            <button
              onClick={() => setPage("history")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "history"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              History
            </button>

            <button
              onClick={() => setPage("patients")}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                page === "patients"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200"
              }`}
            >
              Patients
            </button>

          </nav>

        </div>

      </header>


      {/* Page Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">

        {renderPage()}

      </main>


    </div>

  );

}

export default App;