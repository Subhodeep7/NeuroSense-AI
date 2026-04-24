import { useEffect, useState } from "react";
import { getAllPatients, getAllPredictions } from "../api/predictionApi";
import { generateReport } from "../utils/generateReport";
import type { Patient } from "../types/prediction";

function HistoryPage() {
  const [patients,        setPatients]        = useState<Patient[]>([]);
  const [allPredictions,  setAllPredictions]  = useState<any[]>([]);
  const [filterPatientId, setFilterPatientId] = useState<number | "all">("all");
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [pts, preds] = await Promise.all([
        getAllPatients(),
        getAllPredictions(),
      ]);
      setPatients(pts);
      setAllPredictions(preds);
    } catch (e: any) {
      const msg = e?.response?.data ?? e?.message ?? "Unknown error";
      setError(`Failed to load predictions: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  // Frontend filter — no extra API call needed
  const displayed =
    filterPatientId === "all"
      ? allPredictions
      : allPredictions.filter(p => p.patientId === filterPatientId);

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] relative overflow-hidden">

      {/* 🌌 Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#afc6ff]/10 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#d8b9ff]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-8 space-y-10">

        {/* HEADER */}
        <div className="border-l-4 border-[#afc6ff]/30 pl-6">
          <p className="text-xs uppercase tracking-widest text-[#afc6ff]">Diagnostic Audit Trail</p>
          <h1 className="text-5xl font-extrabold">Prediction History</h1>
          <p className="text-[#8c90a0] max-w-xl">
            Secure tracking of AI-generated neurological predictions
          </p>
        </div>

        {/* FILTER BAR */}
        <div className="flex items-end gap-4 flex-wrap">

          <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] p-5 rounded-2xl flex-1 max-w-sm">
            <label className="text-sm text-[#8c90a0] mb-2 block">Filter by Patient</label>
            <select
              onChange={e => {
                const v = e.target.value;
                setFilterPatientId(v === "all" ? "all" : Number(v));
              }}
              className="w-full bg-[#10131a] border border-[#2a2f3a] px-4 py-3 rounded-xl focus:ring-2 focus:ring-[#afc6ff]"
            >
              <option value="all">All Patients ({allPredictions.length} records)</option>
              {patients.map(p => {
                const count = allPredictions.filter(x => x.patientId === p.id).length;
                return (
                  <option key={p.id} value={p.id}>
                    {p.name} (Age {p.age}) — {count} record{count !== 1 ? "s" : ""}
                  </option>
                );
              })}
            </select>
          </div>

          <div className="px-5 py-3 rounded-xl bg-[#1d2026] border border-[#2a2f3a]">
            <p className="text-xs text-[#8c90a0]">Showing</p>
            <p className="text-2xl font-bold">{displayed.length}</p>
          </div>

        </div>

        {/* TABLE */}
        <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl overflow-hidden">

          <div className="p-6 flex justify-between items-center border-b border-[#2a2f3a]">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <span className="material-symbols-outlined text-[#afc6ff]">history</span>
              Prediction Records
            </h3>
            <span className="text-[#8c90a0] text-sm">
              {filterPatientId === "all" ? "All Patients" : patients.find(p => p.id === filterPatientId)?.name}
            </span>
          </div>

          {loading ? (

            <div className="flex items-center justify-center p-12">
              <div className="h-10 w-10 border-4 border-[#1d2026] border-t-[#afc6ff] rounded-full animate-spin" />
            </div>

          ) : error ? (

            <div className="p-8 flex items-start gap-3 text-red-400">
              <span className="material-symbols-outlined mt-0.5">error</span>
              <div>
                <p className="font-semibold">Failed to load history</p>
                <p className="text-sm mt-1 text-red-300">{error}</p>
                <button
                  onClick={loadData}
                  className="mt-3 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm transition"
                >
                  Retry
                </button>
              </div>
            </div>

          ) : displayed.length === 0 ? (

            <div className="p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-4xl text-[#2a2f3a]">inbox</span>
              <p className="text-[#8c90a0]">No prediction records found.</p>
              <p className="text-xs text-[#555]">
                Run an assessment on the Neural Assessment page to generate records.
              </p>
            </div>

          ) : (

            <div className="overflow-x-auto">
              <table className="w-full">

                <thead>
                  <tr className="text-xs uppercase text-[#8c90a0] border-b border-[#2a2f3a]">
                    <th className="px-6 py-4 text-left">#</th>
                    <th className="px-6 py-4 text-left">Patient</th>
                    <th className="px-6 py-4 text-left">Date</th>
                    <th className="px-6 py-4 text-left">Result</th>
                    <th className="px-6 py-4 text-right">Risk Score</th>
                    <th className="px-6 py-4 text-center">Modalities</th>
                    <th className="px-6 py-4 text-center">Report</th>
                  </tr>
                </thead>

                <tbody>
                  {displayed.map((h, idx) => {
                    const isRisk   = h.finalPrediction === 1;
                    const risk     = h.finalRisk ?? 0;
                    const riskPct  = (risk * 100).toFixed(1);
                    const riskLevel: string = h.riskLevel ?? (risk >= 0.75 ? "HIGH" : risk >= 0.5 ? "MEDIUM" : "LOW");
                    const modalityCount = [
                      h.voiceConfidence,
                      h.handwritingConfidence,
                      h.tremorConfidence,
                      h.visualConfidence,
                    ].filter((v: any) => v != null && v > 0).length;

                    const patient = patients.find(p => p.id === h.patientId);

                    return (
                      <tr
                        key={h.id}
                        className="border-b border-[#2a2f3a] hover:bg-[#272a31]/40 transition"
                      >
                        {/* Index */}
                        <td className="px-6 py-4 text-[#555] text-sm">
                          {displayed.length - idx}
                        </td>

                        {/* Patient */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="font-semibold">{h.patientName ?? "—"}</span>
                            {patient && (
                              <span className="text-xs text-[#8c90a0]">
                                Age {patient.age} • {patient.gender}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span>{new Date(h.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-[#8c90a0]">
                              {new Date(h.createdAt).toLocaleTimeString()}
                            </span>
                          </div>
                        </td>

                        {/* Result badge */}
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-2 w-fit
                            ${isRisk
                              ? "bg-red-500/10 text-red-400 border border-red-500/20"
                              : "bg-green-500/10 text-green-400 border border-green-500/20"}`}
                          >
                            <span className={`w-2 h-2 rounded-full ${isRisk ? "bg-red-400" : "bg-green-400"}`} />
                            {isRisk ? "Parkinson's Detected" : "Healthy"}
                          </span>
                        </td>

                        {/* Risk score bar */}
                        <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <span className="font-bold text-[#afc6ff]">{riskPct}%</span>
                            <div className="w-24 h-1 bg-[#32353c] rounded-full overflow-hidden">
                              <div
                                className={`h-full ${isRisk ? "bg-red-500" : "bg-green-400"}`}
                                style={{ width: `${riskPct}%` }}
                              />
                            </div>
                            <span className={`text-xs font-semibold ${
                              riskLevel === "HIGH"   ? "text-red-400"    :
                              riskLevel === "MEDIUM" ? "text-yellow-400" : "text-green-400"
                            }`}>
                              {riskLevel}
                            </span>
                          </div>
                        </td>

                        {/* Modality count */}
                        <td className="px-6 py-4 text-center">
                          <span className="px-2 py-1 rounded-lg bg-[#afc6ff]/10 text-[#afc6ff] text-xs font-bold">
                            {modalityCount}/4
                          </span>
                        </td>

                        {/* Download Report */}
                        <td className="px-6 py-4 text-center">
                          {patient && (
                            <button
                              title="Download Report"
                              onClick={() => generateReport(patient, { ...h, riskLevel })}
                              className="p-2 rounded-lg bg-[#afc6ff]/10 hover:bg-[#afc6ff]/20 text-[#afc6ff] transition hover:scale-110"
                            >
                              <span className="material-symbols-outlined text-[18px]">download</span>
                            </button>
                          )}
                        </td>

                      </tr>
                    );
                  })}
                </tbody>

              </table>
            </div>

          )}
        </div>
      </div>
    </div>
  );
}

export default HistoryPage;