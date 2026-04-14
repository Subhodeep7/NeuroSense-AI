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

            {/* ⬇️ Download Report Button */}
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => {
                  const patient = patients.find(p => p.id === selectedPatient);
                  if (patient) generateReport(patient, result);
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