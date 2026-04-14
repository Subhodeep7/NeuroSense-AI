import { useEffect, useState } from "react";
import {
  getAllPatients,
  getLatestPrediction,
  getTotalPredictions,
} from "../api/predictionApi";
import type { Patient, Prediction } from "../types/prediction";

// ── Modality config ──────────────────────────────────────────────
const MODALITIES = [
  { key: "voiceConfidence",       label: "Voice",       icon: "mic" },
  { key: "handwritingConfidence", label: "Handwriting", icon: "edit" },
  { key: "gaitConfidence",        label: "Gait",        icon: "directions_walk" },
  { key: "tremorConfidence",      label: "Tremor",      icon: "vibration" },
  { key: "visualConfidence",      label: "Visual",      icon: "visibility" },
] as const;

function riskColor(risk: number) {
  if (risk >= 0.75) return "#ff4d4f";
  if (risk >= 0.5)  return "#f59e0b";
  return "#10b981";
}

function riskLabel(pred: Prediction) {
  return pred.finalPrediction === 1
    ? "Parkinson's Detected"
    : "No Parkinson's Detected";
}

export default function DashboardPage() {
  const [patients,         setPatients]         = useState<Patient[]>([]);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(null);
  const [loading,          setLoading]          = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    // Use Promise.allSettled so that one failing call never blanks the whole
    // dashboard — each section degrades gracefully on its own.
    const [patientsRes, latestRes, countRes] = await Promise.allSettled([
      getAllPatients(),
      getLatestPrediction(),
      getTotalPredictions(),
    ]);

    if (patientsRes.status === "fulfilled") setPatients(patientsRes.value);
    if (latestRes.status  === "fulfilled") setLatestPrediction(latestRes.value);
    if (countRes.status   === "fulfilled") setTotalPredictions(countRes.value);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0b0e14]">
        <div className="h-14 w-14 border-4 border-[#1d2026] border-t-[#afc6ff] rounded-full animate-spin shadow-[0_0_25px_rgba(175,198,255,0.5)]" />
      </div>
    );
  }

  const riskPct = latestPrediction
    ? (latestPrediction.finalRisk ?? 0) * 100
    : 0;

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] font-[Inter] relative overflow-hidden">

      {/* 🔥 Ambient Neural Background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#afc6ff]/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#d8b9ff]/10 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1500px] mx-auto p-8">

        {/* 🧠 HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
          <div>
            <h2 className="text-xs uppercase tracking-[0.3em] text-[#8c90a0] mb-3">
              NeuroSense-AI
            </h2>
            <h1 className="text-6xl font-extrabold tracking-tight">
              Clinical <span className="text-[#afc6ff]">Dashboard</span>
            </h1>
          </div>

          <div className="flex gap-4">
            <div className="px-5 py-3 rounded-xl bg-[#1d2026] border border-[#2a2f3a] shadow-inner">
              <p className="text-xs text-[#8c90a0]">Patients</p>
              <p className="text-2xl font-bold">{patients.length}</p>
            </div>
            <div className="px-5 py-3 rounded-xl bg-[#1d2026] border border-[#2a2f3a] shadow-inner">
              <p className="text-xs text-[#8c90a0]">Assessments</p>
              <p className="text-2xl font-bold">{totalPredictions}</p>
            </div>
          </div>
        </div>

        {/* 🧩 BENTO GRID */}
        <div className="grid grid-cols-12 gap-6">

          {/* Patients */}
          <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] hover:scale-[1.02] transition">
            <span className="material-symbols-outlined text-[#afc6ff] mb-2">groups</span>
            <p className="text-sm text-[#8c90a0]">Registered Patients</p>
            <p className="text-4xl font-bold">{patients.length}</p>
          </div>

          {/* Assessments */}
          <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] hover:scale-[1.02] transition">
            <span className="material-symbols-outlined text-[#d8b9ff] mb-2">analytics</span>
            <p className="text-sm text-[#8c90a0]">Total Assessments</p>
            <p className="text-4xl font-bold">{totalPredictions}</p>
          </div>

          {/* Latest Result */}
          <div className="col-span-12 md:col-span-4 p-6 rounded-2xl bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] hover:scale-[1.02] transition">
            <p className="text-sm text-[#8c90a0] mb-1">Latest Result</p>

            {latestPrediction ? (
              <>
                {/* Patient name from flat field in the latest-prediction response */}
                {latestPrediction.patientName && (
                  <p className="text-xs text-[#8c90a0] mb-2">
                    {latestPrediction.patientName}
                  </p>
                )}

                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{ color: riskColor(latestPrediction.finalRisk ?? 0) }}
                >
                  {riskLabel(latestPrediction)}
                </span>

                <p className="text-3xl font-bold mt-3">
                  {riskPct.toFixed(1)}%
                </p>

                <p className="text-xs text-[#8c90a0] mt-2">
                  {new Date(latestPrediction.createdAt).toLocaleString()}
                </p>
              </>
            ) : (
              <p className="text-[#555] mt-2">No assessments yet</p>
            )}
          </div>

          {/* 📊 MAIN ANALYTICS CARD */}
          {latestPrediction && (
            <div className="col-span-12 lg:col-span-8 p-8 rounded-[2rem] bg-[#1d2026]/50 backdrop-blur-xl border border-[#2a2f3a] relative overflow-hidden">

              <h3 className="text-xl font-bold mb-6">Latest Assessment Breakdown</h3>

              <div className="space-y-5">
                {MODALITIES.map(({ key, label, icon }) => {
                  const val = (latestPrediction as any)[key];
                  const pct = val != null ? Math.round(val * 100) : 0;

                  return (
                    <div key={key}>
                      <div className="flex justify-between items-center mb-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm">
                            {icon}
                          </span>
                          {label}
                        </span>
                        <span className="text-[#afc6ff] font-bold">
                          {val != null ? `${pct}%` : "—"}
                        </span>
                      </div>

                      <div className="h-2 bg-[#32353c] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#afc6ff] to-[#528dff] shadow-[0_0_12px_rgba(175,198,255,0.6)]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Overall */}
              <div className="mt-8">
                <div className="flex justify-between mb-2">
                  <span>Overall Risk</span>
                  <span
                    className="font-bold text-lg"
                    style={{ color: riskColor(latestPrediction.finalRisk ?? 0) }}
                  >
                    {riskPct.toFixed(1)}%
                  </span>
                </div>

                <div className="h-3 bg-[#32353c] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#6ee7b7] via-[#f59e0b] to-[#ef4444]"
                    style={{ width: `${riskPct}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 👥 Patients Panel */}
          <div className="col-span-12 lg:col-span-4 p-6 rounded-[2rem] bg-[#1d2026]/50 backdrop-blur-xl border border-[#2a2f3a]">
            <h3 className="font-bold mb-4">Patients</h3>

            {patients.length === 0 ? (
              <p className="text-[#555] text-sm">No patients registered yet</p>
            ) : (
              <div className="space-y-3">
                {patients.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#10131a] hover:bg-[#272a31] transition"
                  >
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      <p className="text-xs text-[#8c90a0]">
                        Age {p.age} • {p.gender}
                      </p>
                    </div>

                    <span className="text-xs text-[#afc6ff]">#{p.id}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}