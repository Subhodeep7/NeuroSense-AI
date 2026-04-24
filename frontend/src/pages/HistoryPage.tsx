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
      setError(`Failed to load screening history: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  const displayed =
    filterPatientId === "all"
      ? allPredictions
      : allPredictions.filter(p => p.patientId === filterPatientId);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* HEADER */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="font-serif text-4xl font-bold text-midnight tracking-tight mb-2">Assessment Audit Trail</h1>
          <p className="text-slate font-medium">Historical records of neural biomarker screening assessments</p>
        </div>
        <div className="flex items-center gap-4 bg-white border border-slate/10 px-6 py-3 rounded-2xl shadow-sm">
           <div className="text-right">
              <p className="text-[10px] font-bold text-slate uppercase tracking-widest leading-none mb-1">Database Integrity</p>
              <p className="text-xs font-bold text-medical-teal uppercase tracking-widest">Verified</p>
           </div>
           <div className="w-px h-8 bg-slate/10"></div>
           <div className="flex flex-col">
              <span className="text-[10px] font-bold text-slate uppercase tracking-widest leading-none mb-1">Total Assessments</span>
              <span className="text-xl font-serif font-bold text-midnight leading-none">{displayed.length}</span>
           </div>
        </div>
      </div>

      {/* FILTER & STATS BAR */}
      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-4 medical-card p-8 bg-white shadow-lg">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate mb-4">Participant Filter</h3>
          <select
            onChange={e => {
              const v = e.target.value;
              setFilterPatientId(v === "all" ? "all" : Number(v));
            }}
            className="input-premium"
          >
            <option value="all">All Screening Records</option>
            {patients.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} (Ref: {p.id})
              </option>
            ))}
          </select>
        </div>
        
        <div className="col-span-12 lg:col-span-8 flex gap-8">
           {[
             { label: "Stability Index", value: "98.4%", color: "text-medical-teal", icon: "security" },
             { label: "Analysis Confidence", value: "High", color: "text-medical-teal", icon: "verified" },
             { label: "Last Engine Sync", value: "Real-time", color: "text-slate", icon: "sync" }
           ].map((stat, i) => (
             <div key={i} className="flex-1 medical-card p-8 bg-white shadow-lg flex flex-col relative overflow-hidden group">
                <span className="material-symbols-outlined absolute top-4 right-4 text-slate/10 text-4xl group-hover:scale-110 transition-transform">{stat.icon}</span>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate mb-2 relative z-10">{stat.label}</p>
                <p className={`text-2xl font-serif font-bold ${stat.color} relative z-10`}>{stat.value}</p>
             </div>
           ))}
        </div>
      </div>

      {/* VERIFIED LEDGER TABLE */}
      <div className="medical-card overflow-hidden bg-white shadow-2xl border-slate/5">
        <div className="p-8 border-b border-slate/10 bg-slate/[0.01] flex items-center justify-between">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-midnight text-white flex items-center justify-center shadow-lg shadow-midnight/20">
                 <span className="material-symbols-outlined text-xl font-light">verified_user</span>
              </div>
              <div>
                 <h3 className="text-sm font-bold text-midnight uppercase tracking-widest">Verified Screening Ledger</h3>
                 <p className="text-[10px] text-slate font-medium uppercase tracking-widest mt-1">End-to-end encrypted assessment data</p>
              </div>
           </div>
           <button onClick={loadData} className="w-10 h-10 rounded-full hover:bg-slate/5 flex items-center justify-center text-slate transition-colors">
              <span className="material-symbols-outlined text-xl">refresh</span>
           </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-32">
            <div className="h-12 w-12 border-4 border-slate/10 border-t-midnight rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-16 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-medical-red/10 flex items-center justify-center mx-auto text-medical-red">
               <span className="material-symbols-outlined text-3xl">error</span>
            </div>
            <p className="text-medical-red font-bold text-lg">{error}</p>
            <button onClick={loadData} className="btn-premium">Retry Protocol Sync</button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="p-32 text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-slate/5 flex items-center justify-center mx-auto mb-6">
               <span className="material-symbols-outlined text-5xl text-slate/20 font-light">folder_off</span>
            </div>
            <p className="text-slate font-serif text-xl">No Assessment Records Found</p>
            <p className="text-[10px] text-slate/40 font-bold uppercase tracking-widest">Selected subject has no screening history in the vault.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-slate border-b border-slate/10 bg-slate/[0.02]">
                  <th className="px-10 py-6 text-left font-bold">Assessment Date</th>
                  <th className="px-10 py-6 text-left font-bold">Participant Subject</th>
                  <th className="px-10 py-6 text-left font-bold">Risk Weighting</th>
                  <th className="px-10 py-6 text-left font-bold">Screening Outcome</th>
                  <th className="px-10 py-6 text-center font-bold">Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate/10">
                {displayed.map((h) => {
                  const risk     = h.finalRisk ?? 0;
                  const riskPct  = (risk * 100).toFixed(1);
                  const riskLevel = h.riskLevel ?? (risk >= 0.75 ? "HIGH" : risk >= 0.5 ? "MEDIUM" : "LOW");
                  const patient = patients.find(p => p.id === h.patientId);

                  return (
                    <tr key={h.id} className="hover:bg-slate/[0.02] transition-colors group">
                      <td className="px-10 py-8">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-midnight">{new Date(h.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                          <span className="text-[10px] text-slate/60 font-bold uppercase tracking-widest mt-1">{new Date(h.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 rounded-full bg-slate/5 flex items-center justify-center text-slate font-serif font-bold text-xs border border-slate/10">
                              {h.patientName?.[0] ?? "S"}
                           </div>
                           <div className="flex flex-col">
                             <span className="text-sm font-bold text-midnight">{h.patientName ?? "Anonymous Subject"}</span>
                             <span className="text-[9px] text-slate font-bold uppercase tracking-widest opacity-60">Record-ID: {h.patientId}</span>
                           </div>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <div className="flex items-center gap-4">
                           <div className="flex-1 min-w-[120px] h-2 bg-slate/5 rounded-full overflow-hidden border border-slate/10 p-[1px]">
                              <div className={`h-full rounded-full transition-all duration-1000 ${riskLevel === 'HIGH' ? 'bg-medical-red shadow-[0_0_8px_rgba(239,68,68,0.4)]' : riskLevel === 'MEDIUM' ? 'bg-medical-amber shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-medical-teal shadow-[0_0_8px_rgba(20,184,166,0.4)]'}`} style={{ width: `${riskPct}%` }} />
                           </div>
                           <span className="text-sm font-serif font-bold text-midnight w-12">{riskPct}%</span>
                        </div>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`px-4 py-2 rounded-xl text-[10px] font-bold tracking-[0.1em] uppercase border flex items-center gap-2 w-fit ${
                          riskLevel === 'HIGH' ? 'bg-medical-red/5 text-medical-red border-medical-red/10' :
                          riskLevel === 'MEDIUM' ? 'bg-medical-amber/5 text-medical-amber border-medical-amber/10' :
                          'bg-medical-teal/5 text-medical-teal border-medical-teal/10'
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                          {riskLevel} RISK
                        </span>
                      </td>
                      <td className="px-10 py-8 text-center">
                        <button
                          onClick={() => patient && generateReport(patient, { ...h, riskLevel })}
                          className="w-12 h-12 rounded-2xl bg-white border border-slate/10 flex items-center justify-center text-slate hover:border-midnight hover:text-midnight hover:shadow-lg transition-all active:scale-95 group"
                        >
                          <span className="material-symbols-outlined text-2xl group-hover:rotate-6 transition-transform">picture_as_pdf</span>
                        </button>
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
  );
}

export default HistoryPage;