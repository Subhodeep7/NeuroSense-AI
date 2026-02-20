import { useState } from "react";
import PredictionPage from "./pages/PredictionPage";
import HistoryPage from "./pages/HistoryPage";

function App() {

  const [page, setPage] =
    useState<"predict" | "history">("predict");

  return (

    <div>

      <div style={{
        padding: "20px",
        textAlign: "center"
      }}>

        <button
          onClick={() => setPage("predict")}
          style={{ marginRight: "10px" }}
        >
          Prediction
        </button>

        <button
          onClick={() => setPage("history")}
        >
          History
        </button>

      </div>

      {page === "predict"
        ? <PredictionPage />
        : <HistoryPage />}

    </div>

  );
}

export default App;
