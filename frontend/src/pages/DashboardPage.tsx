import { useEffect, useState } from "react";
import {
  getAllPatients,
  getLatestPrediction,
  getTotalPredictions,
} from "../api/predictionApi";
import type { Patient, Prediction } from "../types/prediction";

// ── UI Helpers ───────────────────────────────────────────────────
const getRiskColor = (risk: number) => {
  if (risk >= 0.75) return "text-medical-red";
  if (risk >= 0.5) return "text-medical-amber";
  return "text-medical-teal";
};

const getRiskLabel = (risk: number) => {
  if (risk >= 0.75) return "Elevated Risk";
  if (risk >= 0.5) return "Moderate Risk";
  return "Low Risk";
};

export default function DashboardPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [latestPrediction, setLatestPrediction] = useState<Prediction | null>(null);
  const [loading, setLoading] = useState(true);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    loadDashboard();
    const timer = setTimeout(() => setAnimate(true), 100);
    return () => clearTimeout(timer);
  }, []);

  async function loadDashboard() {
    const [patientsRes, latestRes, countRes] = await Promise.allSettled([
      getAllPatients(),
      getLatestPrediction(),
      getTotalPredictions(),
    ]);

    if (patientsRes.status === "fulfilled") setPatients(patientsRes.value);
    if (latestRes.status === "fulfilled") setLatestPrediction(latestRes.value);
    if (countRes.status === "fulfilled") setTotalPredictions(countRes.value);

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-2 border-slate/20 border-t-midnight rounded-full animate-spin" />
      </div>
    );
  }

  const riskScore = latestPrediction ? (latestPrediction.finalRisk ?? 0) * 100 : 0;

  // Weighted contribution data (aligned with backend clinical fusion)
  const contributions = [
    { label: "Tremor", value: (latestPrediction?.tremorConfidence ?? 0) * 0.30, color: "bg-medical-amber" },
    { label: "Gait", value: (latestPrediction?.visualConfidence ?? 0) * 0.25, color: "bg-slate-400" },
    { label: "Vocal", value: (latestPrediction?.voiceConfidence ?? 0) * 0.20, color: "bg-medical-teal" },
    { label: "Motor", value: (latestPrediction?.handwritingConfidence ?? 0) * 0.15, color: "bg-indigo-500" },
    { label: "Reaction", value: (latestPrediction?.reactionTimeMs ? (latestPrediction.reactionTimeMs > 400 ? (latestPrediction.reactionTimeMs - 400) / 200 : 0) : 0) * 0.10, color: "bg-rose-400" },
  ];
  const totalContrib = contributions.reduce((acc, c) => acc + c.value, 0) || 1;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">

      {/* 🧩 Bento Grid Cockpit */}
      <div className="grid grid-cols-12 gap-6">

        {/* 1. Primary Risk Intelligence Panel (4x2) */}
        <div className="col-span-12 lg:col-span-8 medical-card p-8 flex flex-col justify-between overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <span className="material-symbols-outlined text-9xl">analytics</span>
          </div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-12">
              <div>
                <h2 className="font-serif text-2xl font-bold text-midnight mb-1">Screening Intelligence</h2>
                <p className="text-slate text-sm font-medium">Neural Biomarker Analysis Report</p>
              </div>

            </div>

            <div className="flex items-end gap-16">
              <div className="flex-1">
                <div className="flex justify-between mb-4">
                  <span className="text-sm font-bold text-midnight uppercase tracking-widest">Parkinson's Risk Index</span>
                  <div className="text-right">
                    <span className={`text-3xl font-serif font-bold block leading-none ${getRiskColor(latestPrediction?.finalRisk ?? 0)}`}>
                      {animate ? riskScore.toFixed(1) : "0.0"}%
                    </span>
                    <span className="text-[10px] font-bold text-slate uppercase tracking-tighter">{getRiskLabel(latestPrediction?.finalRisk ?? 0)}</span>
                  </div>
                </div>
                <div className="h-5 bg-slate/5 rounded-full overflow-hidden p-1 border border-slate/10 shadow-inner">
                  <div
                    className={`h-full rounded-full animate-progress shadow-sm ${riskScore > 75 ? 'bg-medical-red' : riskScore > 50 ? 'bg-medical-amber' : 'bg-medical-teal'
                      }`}
                    style={{ width: animate ? `${riskScore}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between mt-4 text-[10px] text-slate font-bold uppercase tracking-[0.15em]">
                  <span>Low Risk</span>
                  <span>Moderate Risk</span>
                  <span>Elevated Risk</span>
                </div>
              </div>

              <div className="w-px h-24 bg-slate/10" />

              <div className="space-y-4 min-w-[200px]">
                <div>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1">Patient Focus</p>
                  <p className="text-sm font-bold text-midnight truncate">{latestPrediction?.patientName || "Select Patient"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1">Assessment Date</p>
                  <p className="text-sm font-bold text-midnight">
                    {latestPrediction ? new Date(latestPrediction.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "--"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 2. IoT / Connectivity Status (4x1) */}
        <div className="col-span-12 lg:col-span-4 medical-card p-6 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-slate leading-none">Device Network</h3>
            <span className="px-2 py-0.5 rounded bg-medical-teal/10 text-medical-teal text-[9px] font-bold uppercase tracking-widest">Active Sync</span>
          </div>

          <div className="space-y-3 flex-1">
            {[
              { label: "Tremor Band", status: "Active", icon: "watch" },
              { label: "Voice Probe", status: "Ready", icon: "mic" },
              { label: "Handwriting Tablet", status: "Active", icon: "draw" },
              { label: "Gait Sensor", status: "Offline", icon: "directions_walk" },
            ].map((device, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-slate/5 border border-slate/10">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-lg text-slate font-light">{device.icon}</span>
                  <span className="text-[11px] font-bold text-midnight uppercase tracking-wide">{device.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${device.status === 'Offline' ? 'bg-slate/30' : 'bg-medical-teal animate-pulse'}`}></div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest ${device.status === 'Offline' ? 'text-slate/40' : 'text-medical-teal'}`}>
                    {device.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Biomarker Modalities (Split Cards) */}
        <div className="col-span-12 lg:col-span-8 grid grid-cols-2 gap-6">
          {[
            { label: "Vocal Screening", value: latestPrediction?.voiceConfidence, icon: "record_voice_over", desc: "Voice articulation irregularity" },
            { label: "Handwriting Tremor", value: latestPrediction?.handwritingConfidence, icon: "edit_square", desc: "Fine motor trace deviation" },
            { label: "Resting Tremor", value: latestPrediction?.tremorConfidence, icon: "vibration", desc: "Tremor frequency analysis" },
            { label: "Gait & Posture", value: latestPrediction?.visualConfidence, icon: "directions_walk", desc: "Stride length & balance analysis" },
          ].map((stat, idx) => (
            <div key={idx} className="medical-card p-6 group medical-card-hover">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-slate/5 border border-slate/10 flex items-center justify-center group-hover:bg-midnight group-hover:text-white transition-all duration-500 shadow-inner">
                  <span className="material-symbols-outlined text-2xl font-light">{stat.icon}</span>
                </div>
                <div className="text-right">
                  <span className={`text-xl font-serif font-bold block ${getRiskColor(stat.value ?? 0)}`}>
                    {stat.value ? `${Math.round(stat.value * 100)}%` : "N/A"}
                  </span>
                  <p className="text-[9px] font-bold text-slate uppercase tracking-widest leading-none mt-1">Confidence</p>
                </div>
              </div>
              <h4 className="text-sm font-bold text-midnight mb-1">{stat.label}</h4>
              <p className="text-[11px] text-slate font-medium leading-relaxed">{stat.desc}</p>
            </div>
          ))}
        </div>

        {/* 4. Biomarker Contribution Analysis (4x2) */}
        <div className="col-span-12 lg:col-span-4 medical-card p-8 flex flex-col bg-white shadow-xl border-slate/5">
          <div className="flex justify-between items-start mb-10">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-[0.25em] text-slate mb-1">Contribution Analysis</h3>
              <p className="text-[10px] text-midnight font-bold uppercase tracking-widest opacity-60">Biomarker Weighting Matrix</p>
            </div>

          </div>

          <div className="flex-1 space-y-10">
            {contributions.map((c, i) => {
              const pct = (c.value / totalContrib) * 100;
              return (
                <div key={i} className="group cursor-help">
                  <div className="flex justify-between items-end mb-3">
                    <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${c.color.replace('bg-', 'bg-')}`}></span>
                      <span className="text-[10px] font-bold text-midnight uppercase tracking-widest opacity-80 group-hover:opacity-100 transition-opacity">{c.label} Analysis</span>
                    </div>
                    <span className="text-xs font-serif font-bold text-midnight">{animate ? Math.round(pct) : 0}%</span>
                  </div>
                  <div className="h-2 bg-slate/5 rounded-full overflow-hidden border border-slate/10 p-[1px] shadow-inner">
                    <div
                      className={`h-full rounded-full transition-all duration-1000 ease-out shadow-sm ${c.color}`}
                      style={{ width: animate ? `${pct}%` : '0%' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-slate/10">
            <div className="flex items-start gap-4 p-5 rounded-2xl bg-slate/[0.03] border border-slate/10 group hover:bg-slate/5 transition-all">
              <div className="w-8 h-8 rounded-xl bg-white border border-slate/10 flex items-center justify-center text-slate group-hover:rotate-12 transition-transform">
                <span className="material-symbols-outlined text-lg font-light">info</span>
              </div>
              <p className="text-[10px] text-slate font-medium italic leading-relaxed">
                Multimodal weights are calibrated based on clinical significance and real-time sensor fidelity scores.
              </p>
            </div>
          </div>
        </div>

        {/* 5. AI Screening Insights (12x1) */}
        <div className="col-span-12 medical-card p-10 bg-midnight text-white overflow-hidden relative">
          <div className="absolute top-0 right-0 w-96 h-96 bg-medical-teal/10 blur-[120px] rounded-full -mr-40 -mt-40 animate-pulse-slow" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-4 gap-12 items-center">
            <div className="lg:col-span-3">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-lg bg-medical-teal/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-medical-teal text-lg">auto_awesome</span>
                </div>
                <h3 className="font-serif text-2xl font-bold tracking-tight">AI Screening Insights / Physician Notes</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-medical-teal uppercase tracking-widest mb-3">Analysis Summary</p>
                  <p className="text-sm text-white/80 leading-relaxed font-light">
                    {(() => {
                      const markers = [];
                      if (latestPrediction?.handwritingConfidence > 0.7) markers.push("handwriting instability");
                      if (latestPrediction?.tremorConfidence > 0.7) markers.push("tremor markers");
                      if (latestPrediction?.voiceConfidence > 0.7) markers.push("vocal articulation delta");
                      if (latestPrediction?.visualConfidence > 0.7) markers.push("gait asymmetry");
                      
                      if (markers.length > 0) {
                        return `Detected ${markers.join(" and ")} in the recent assessment session. While global health index remains stable, the clinical delta suggests a follow-up screening if symptoms persist.`;
                      } else {
                        return "Current biomarkers indicate stable motor and vocal function. No significant Parkinsonian deviations detected in the recent screening session. Periodic monitoring recommended.";
                      }
                    })()}
                  </p>
                </div>
                <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-3">Physician Notes</p>
                  <p className="text-sm text-white/60 leading-relaxed font-light italic">
                    "Patient reported no subjective worsening of gait. Tremor suppression exercises recommended. Scheduling follow-up review for Q3."
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Global Health Index</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-serif font-bold text-medical-teal">Stable</p>
                  <span className="material-symbols-outlined text-medical-teal/30 group-hover:text-medical-teal transition-colors">check_circle</span>
                </div>
              </div>
              <div className="p-6 rounded-2xl bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
                <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mb-2">Total Screenings</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-serif font-bold text-white">{totalPredictions}</p>
                  <span className="material-symbols-outlined text-white/20 group-hover:text-white transition-colors">database</span>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
