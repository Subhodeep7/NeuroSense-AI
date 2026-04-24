import { useEffect, useState } from "react";
import RiskGauge from "../components/RiskGauge";
import VoiceRecorder from "../components/VoiceRecorder";
import HandwritingCanvas from "../components/HandwritingCanvas";
import VideoRecorder from "../components/VideoRecorder";
import MotionCapture from "../components/MotionCapture";
import { getAllPatients, predictFull } from "../api/predictionApi";
import type { Patient } from "../types/prediction";
import { generateReport } from "../utils/generateReport";

function PredictionPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);

  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [handwritingFile, setHandwritingFile] = useState<File | null>(null);
  const [gaitFile, setGaitFile] = useState<File | null>(null);
  const [tremorFile, setTremorFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [testState, setTestState] = useState<"idle" | "waiting" | "ready">("idle");
  const [startTime, setStartTime] = useState<number>(0);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadPatients(); }, []);

  async function loadPatients() {
    try {
      const data = await getAllPatients();
      setPatients(data);
    } catch {
      alert("Failed to load patients");
    }
  }

  function startReactionTest() {
    setTestState("waiting");
    setTimeout(() => {
      setTestState("ready");
      setStartTime(Date.now());
    }, Math.random() * 2000 + 1000);
  }

  function clickReactionTest() {
    if (testState === "ready") {
      setReactionTime(Date.now() - startTime);
      setTestState("idle");
    } else if (testState === "waiting") {
      alert("Too early!");
      setTestState("idle");
    }
  }

  const readySensors = [
    voiceFile && "Voice",
    handwritingFile && "Spiral",
    gaitFile && "Gait",
    tremorFile && "Tremor",
    videoFile && "Visual",
    reactionTime && `${reactionTime}ms`,
  ].filter(Boolean);

  async function handlePredict() {
    if (!selectedPatient) return alert("Select patient");
    if (readySensors.length === 0) return alert("Capture data");

    setLoading(true);
    try {
      const res = await predictFull(
        voiceFile,
        handwritingFile,
        gaitFile,
        tremorFile,
        reactionTime,
        videoFile,
        selectedPatient
      );
      setResult(res);
    } catch {
      alert("Prediction failed");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0b0e14] text-[#e1e2eb] relative overflow-hidden">

      {/* 🌌 Background Glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#afc6ff]/10 blur-[140px]" />
        <div className="absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-[#d8b9ff]/10 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto p-8 space-y-10">

        {/* 🧠 HEADER */}
        <div>
          <h1 className="text-5xl font-extrabold">
            Neural <span className="text-[#afc6ff]">Assessment</span>
          </h1>
          <p className="text-[#8c90a0]">
            Multimodal Parkinson’s detection system
          </p>
        </div>

        {/* 🧬 PATIENT SELECTOR */}
        <div className="glass-card p-6 rounded-xl">
          <label className="text-sm text-[#8c90a0]">Select Patient</label>
          <select
            onChange={(e) => setSelectedPatient(Number(e.target.value))}
            className="w-full mt-2 bg-[#10131a] border border-[#2a2f3a] p-3 rounded-lg text-white"
          >
            <option value="">Choose patient</option>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.age})
              </option>
            ))}
          </select>
        </div>

        {/* 🧩 MODALITY GRID */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <VoiceRecorder onCapture={setVoiceFile} />
          </div>

          <div className="glass-card p-6 rounded-xl">
            <HandwritingCanvas onCapture={setHandwritingFile} />
          </div>

          <div className="glass-card p-6 rounded-xl">
            <MotionCapture type="gait" onCapture={setGaitFile} />
          </div>

          <div className="glass-card p-6 rounded-xl">
            <MotionCapture type="tremor" onCapture={setTremorFile} />
          </div>
        </div>

        <div className="glass-card p-6 rounded-xl">
          <VideoRecorder onCapture={setVideoFile} />
        </div>

        {/* ⚡ REACTION TEST */}
        <div className="glass-card p-8 rounded-xl text-center border border-[#afc6ff]/30">

          <h3 className="text-xl font-bold mb-2">Reaction Delta</h3>

          {reactionTime && (
            <p className="text-[#afc6ff] mb-4 font-bold">
              {reactionTime} ms
            </p>
          )}

          {testState === "idle" && (
            <button
              onClick={startReactionTest}
              className="px-8 py-3 bg-gradient-to-r from-[#afc6ff] to-[#528dff] rounded-full font-bold hover:scale-105 transition text-gray-900"
            >
              Start Test
            </button>
          )}

          {testState === "waiting" && (
            <button
              onClick={clickReactionTest}
              className="w-full py-10 bg-yellow-400 text-gray-900 animate-pulse rounded-xl font-bold"
            >
              WAIT...
            </button>
          )}

          {testState === "ready" && (
            <button
              onClick={clickReactionTest}
              className="w-full py-10 bg-green-500 text-white animate-bounce rounded-xl font-bold"
            >
              TAP NOW
            </button>
          )}
        </div>

        {/* 🚀 SUBMIT */}
        <button
          onClick={handlePredict}
          disabled={loading}
          className="w-full py-5 rounded-full bg-gradient-to-r from-[#afc6ff] to-[#528dff] font-bold text-lg hover:scale-105 transition shadow-[0_0_20px_rgba(175,198,255,0.4)] text-gray-900"
        >
          {loading ? "Fusing Neural Data..." : "Generate Risk Score"}
        </button>

        {/* 📊 RESULT */}
        {result && (
          <div className="glass-card p-8 rounded-2xl border border-[#afc6ff]/20">

            <h2 className="text-2xl font-bold text-center mb-6">
              Diagnostic Summary
            </h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { key: "voiceConfidence",       label: "Voice",       icon: "mic" },
                { key: "handwritingConfidence", label: "Handwriting", icon: "edit" },
                { key: "gaitConfidence",        label: "Gait",        icon: "directions_walk" },
                { key: "tremorConfidence",      label: "Tremor",      icon: "vibration" },
                { key: "visualConfidence",      label: "Visual",      icon: "visibility" },
              ].map(({ key, label, icon }) => {
                const val = result[key];
                if (val == null) return null;
                const pct = (val * 100).toFixed(1);
                const color = val >= 0.75 ? "#ff4d4f" : val >= 0.5 ? "#f59e0b" : "#10b981";
                return (
                  <div key={key} className="p-4 bg-[#10131a] rounded-xl text-center">
                    <span className="material-symbols-outlined text-sm" style={{ color }}>{icon}</span>
                    <p className="text-xs text-[#8c90a0] mt-1">{label}</p>
                    <p className="font-bold text-lg mt-1" style={{ color }}>{pct}%</p>
                  </div>
                );
              })}
            </div>

            <RiskGauge risk={result.finalRisk} level={result.riskLevel} />

            <div className="text-center mt-6">
              <span className="px-4 py-2 rounded-full bg-[#afc6ff]/10 text-[#afc6ff] font-bold">
                {result.riskLevel} — {(result.finalRisk * 100).toFixed(1)}%
              </span>
            </div>

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                VISUAL GAIT ANALYSIS
                Shows whenever result.visual exists (not gated on image).
                Normalises field names across MediaPipe + OpenCV backends.
            ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            {result.visual && (() => {
              const v = result.visual;

              // ── Field normalisation: MediaPipe keys first, OpenCV fallback ──
              // MediaPipe: arm_swing_asymmetry  |  OpenCV: upper_arm_asym
              // MediaPipe: step_asymmetry       |  OpenCV: step_asym
              // MediaPipe: stride_cov           |  OpenCV: flow_cov
              // MediaPipe: wrist_motion_energy  |  OpenCV: avg_flow
              // MediaPipe: trunk_sway / cadence_spm  (no OpenCV equivalent → undefined)
              const armAsym      = v.arm_swing_asymmetry ?? v.upper_arm_asym;
              const stepAsym     = v.step_asymmetry      ?? v.step_asym;
              const trunkSway    = v.trunk_sway;
              const strideCov    = v.stride_cov          ?? v.flow_cov;
              const cadence      = v.cadence_spm;
              const wristEnergy  = v.wrist_motion_energy ?? v.avg_flow;
              const trunkLean    = v.trunk_lean_avg;
              const headBob      = v.head_bob_std;

              const backend      = v.backend ?? "visual";
              const isMediaPipe  = backend.includes("mediapipe");
              const backendLabel = isMediaPipe
                ? `MediaPipe Pose · ${v.frames_analyzed ?? "?"} frames @ ${v.fps ?? "?"} fps`
                : `OpenCV Motion Analysis · ${v.frames_analyzed ?? "?"} frames`;

              const biomarkers = [
                { label: "Arm Swing Asymmetry", val: armAsym,     threshold: 0.25,  lowerBetter: true,  fmt: (x: number) => x.toFixed(3), clinicalNote: "PD hallmark — one arm freezes" },
                { label: "Step Asymmetry",      val: stepAsym,    threshold: 0.20,  lowerBetter: true,  fmt: (x: number) => x.toFixed(3), clinicalNote: "Foot placement irregularity" },
                { label: "Trunk Sway",          val: trunkSway,   threshold: 0.045, lowerBetter: true,  fmt: (x: number) => x.toFixed(4), clinicalNote: "Postural instability" },
                { label: "Stride Variability",  val: strideCov,   threshold: 0.25,  lowerBetter: true,  fmt: (x: number) => x.toFixed(3), clinicalNote: "Festination / irregular cadence" },
                { label: "Cadence (steps/min)", val: cadence,     threshold: 90,    lowerBetter: false, fmt: (x: number) => x.toFixed(0), clinicalNote: "Shuffling gait < 90 spm" },
                { label: "Wrist Motion Energy", val: wristEnergy, threshold: 0.03,  lowerBetter: false, fmt: (x: number) => x.toFixed(4), clinicalNote: "Bradykinesia indicator" },
                { label: "Forward Trunk Lean",  val: trunkLean,   threshold: 0.20,  lowerBetter: true,  fmt: (x: number) => x.toFixed(3), clinicalNote: "Camptocormia" },
                { label: "Head Bob Amplitude",  val: headBob,     threshold: 0.04,  lowerBetter: true,  fmt: (x: number) => x.toFixed(4), clinicalNote: "Compensatory movement" },
              ].filter(b => b.val != null) as Array<{label:string;val:number;threshold:number;lowerBetter:boolean;fmt:(x:number)=>string;clinicalNote:string}>;

              const flagged = biomarkers.filter(b =>
                b.lowerBetter ? b.val > b.threshold : b.val < b.threshold
              ).length;

              return (
                <div className="mt-8 rounded-xl overflow-hidden border border-[#afc6ff]/20 shadow-[0_0_30px_rgba(175,198,255,0.05)]">

                  {/* ── Section header ── */}
                  <div className="px-5 py-3 bg-[#0d1120] border-b border-[#2a2f3a] flex items-center gap-3">
                    <span className="material-symbols-outlined text-[#afc6ff]">accessibility_new</span>
                    <div>
                      <h3 className="font-bold text-sm text-[#e1e2eb]">Gait & Posture Analysis</h3>
                      <p className="text-[10px] text-[#8c90a0] mt-0.5">{backendLabel}</p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        flagged >= 3 ? "bg-red-500/20 text-red-400" :
                        flagged >= 1 ? "bg-amber-500/20 text-amber-400" :
                                       "bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {flagged} / {biomarkers.length} markers flagged
                      </span>
                    </div>
                  </div>

                  <div className={`grid ${v.annotated_image_url ? "md:grid-cols-[1fr_1.1fr]" : "grid-cols-1"} gap-0`}>

                    {/* ── Annotated skeleton image (only if available) ── */}
                    {v.annotated_image_url && (
                      <div className="bg-[#060810] flex items-center justify-center p-3 border-r border-[#2a2f3a]">
                        <div className="w-full">
                          <p className="text-[10px] text-[#8c90a0] mb-2 text-center uppercase tracking-widest font-semibold">
                            Best-quality pose frame
                          </p>
                          <img
                            src={`http://localhost:8080${v.annotated_image_url}`}
                            alt="Annotated gait skeleton"
                            className="rounded-lg w-full object-contain max-h-80"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                          <div className="mt-2 flex justify-center gap-4 text-[10px]">
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Flagged joint</span>
                            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"/>Normal</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── Biomarker table ── */}
                    <div className="p-5 bg-[#090c14]">
                      <p className="text-[10px] text-[#8c90a0] mb-3 font-semibold uppercase tracking-widest">
                        Clinical Biomarker Findings
                      </p>

                      <div className="space-y-1.5">
                        {biomarkers.map(({ label, val, threshold, lowerBetter, fmt, clinicalNote }) => {
                          const risk = lowerBetter ? val > threshold : val < threshold;
                          const pct  = Math.min(100, (lowerBetter
                            ? (val / (threshold * 2)) * 100
                            : (1 - val / (threshold * 2)) * 100
                          ));
                          return (
                            <div key={label} className="group">
                              <div className="flex items-center justify-between mb-0.5">
                                <div className="flex items-center gap-2">
                                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${risk ? "bg-red-400" : "bg-emerald-400"}`}/>
                                  <span className="text-xs text-[#c8cadc] font-medium">{label}</span>
                                  <span className="text-[10px] text-[#505468] hidden group-hover:inline">{clinicalNote}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-[#8c90a0] font-mono">{fmt(val)}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold min-w-[52px] text-center ${
                                    risk
                                      ? "bg-red-500/15 text-red-400 border border-red-500/20"
                                      : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                                  }`}>
                                    {risk ? "⚠ RISK" : "✓ OK"}
                                  </span>
                                </div>
                              </div>
                              {/* Progress bar */}
                              <div className="h-0.5 rounded-full bg-[#1a1f2a] overflow-hidden ml-3.5">
                                <div
                                  className={`h-full rounded-full transition-all ${risk ? "bg-red-400/50" : "bg-emerald-400/50"}`}
                                  style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Footer summary */}
                      <div className="mt-4 pt-3 border-t border-[#1a1f2a] grid grid-cols-3 gap-2 text-center">
                        {[
                          { label: "Risk Score", value: `${((v.raw_risk_score ?? v.confidence ?? 0) * 100).toFixed(1)}%` },
                          { label: "Confidence", value: `${((v.confidence ?? 0) * 100).toFixed(1)}%` },
                          { label: "Backend",    value: isMediaPipe ? "MediaPipe" : "OpenCV" },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-[#0d1017] rounded-lg p-2">
                            <p className="text-[9px] text-[#8c90a0] uppercase tracking-wider">{label}</p>
                            <p className="text-xs font-bold text-[#afc6ff] mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ⬇️ Download Report Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={async () => {
                  const patient = patients.find(p => p.id === selectedPatient);
                  if (patient) await generateReport(patient, result);
                }}
                className="flex items-center gap-2 px-8 py-3 rounded-full bg-gradient-to-r from-[#afc6ff] to-[#528dff] text-gray-900 font-bold text-sm hover:scale-105 transition shadow-[0_0_20px_rgba(175,198,255,0.4)]"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download Clinical Report
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

export default PredictionPage;