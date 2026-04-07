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

  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [history, setHistory] = useState<Prediction[]>([]);

  useEffect(() => { loadPatients(); }, []);

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
      const data = await getPredictionHistory(patientId);
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history", error);
    }
  };

  const selectedPatientObj =
    patients.find(p => p.id === selectedPatient);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] relative overflow-hidden">

      {/* 🌌 Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#afc6ff]/10 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#d8b9ff]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-8 space-y-10">

        {/* 🧠 HEADER */}
        <div className="border-l-4 border-[#afc6ff]/30 pl-6">
          <p className="text-xs uppercase tracking-widest text-[#afc6ff]">
            Diagnostic Audit Trail
          </p>
          <h1 className="text-5xl font-extrabold">
            Prediction History
          </h1>
          <p className="text-[#8c90a0] max-w-xl">
            Secure tracking of AI-generated neurological predictions
          </p>
        </div>

        {/* 🎯 SELECTOR */}
        <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] p-6 rounded-2xl max-w-md">

          <label className="text-sm text-[#8c90a0] mb-2 block">
            Select Patient
          </label>

          <select
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              loadHistory(Number(value));
            }}
            className="w-full bg-[#10131a] border border-[#2a2f3a] px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#afc6ff]"
          >
            <option value="">Choose patient</option>

            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} (Age {p.age})
              </option>
            ))}
          </select>

        </div>

        {/* 📊 HISTORY */}
        {selectedPatient && (

          <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl overflow-hidden">

            {/* Header */}
            <div className="p-6 flex justify-between items-center border-b border-[#2a2f3a]">

              <h3 className="text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-[#afc6ff]">
                  history
                </span>
                Prediction Records
              </h3>

              {selectedPatientObj && (
                <span className="text-[#8c90a0] text-sm">
                  {selectedPatientObj.name}
                </span>
              )}

            </div>

            {/* Content */}
            {history.length === 0 ? (

              <p className="p-6 text-[#8c90a0]">
                No prediction history found.
              </p>

            ) : (

              <div className="overflow-x-auto">

                <table className="w-full">

                  <thead>
                    <tr className="text-xs uppercase text-[#8c90a0] border-b border-[#2a2f3a]">
                      <th className="px-6 py-4 text-left">Date</th>
                      <th className="px-6 py-4 text-left">Result</th>
                      <th className="px-6 py-4 text-right">Confidence</th>
                    </tr>
                  </thead>

                  <tbody>

                    {history.map((h) => {

                      const isRisk = h.finalPrediction === 1;
                      const riskPct = h.finalRisk
                        ? (h.finalRisk * 100).toFixed(1)
                        : "N/A";

                      return (
                        <tr
                          key={h.id}
                          className="border-b border-[#2a2f3a] hover:bg-[#272a31]/40 transition group"
                        >

                          {/* Date */}
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span>
                                {new Date(h.createdAt).toLocaleDateString()}
                              </span>
                              <span className="text-xs text-[#8c90a0]">
                                {new Date(h.createdAt).toLocaleTimeString()}
                              </span>
                            </div>
                          </td>

                          {/* Result */}
                          <td className="px-6 py-4">

                            <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 w-fit
                              ${isRisk
                                ? "bg-red-500/10 text-red-400 border border-red-500/20"
                                : "bg-green-500/10 text-green-400 border border-green-500/20"}
                            `}>

                              <span className={`w-2 h-2 rounded-full
                                ${isRisk ? "bg-red-400" : "bg-green-400"}
                              `}></span>

                              {isRisk
                                ? "Parkinson's Detected"
                                : "Healthy"}

                            </span>

                          </td>

                          {/* Confidence */}
                          <td className="px-6 py-4 text-right">

                            <div className="flex flex-col items-end gap-1">

                              <span className="font-bold text-[#afc6ff]">
                                {riskPct}%
                              </span>

                              <div className="w-24 h-1 bg-[#32353c] rounded-full overflow-hidden">

                                <div
                                  className={`h-full ${
                                    isRisk
                                      ? "bg-red-500"
                                      : "bg-green-400"
                                  }`}
                                  style={{ width: `${riskPct}%` }}
                                />

                              </div>

                            </div>

                          </td>

                        </tr>
                      );

                    })}

                  </tbody>

                </table>

              </div>

            )}

          </div>

        )}

      </div>
    </div>
  );
}

export default HistoryPage;