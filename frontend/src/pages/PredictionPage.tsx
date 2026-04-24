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
  const [tremorFile, setTremorFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const [reactionAttempts, setReactionAttempts] = useState<number[]>([]);
  const MAX_ATTEMPTS = 5;
  const [reactionTime, setReactionTime] = useState<number | null>(null);
  const [testState, setTestState] = useState<"idle" | "waiting" | "ready">("idle");
  const [startTime, setStartTime] = useState<number>(0);

  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadPatients(); }, []);
  
  // 🧼 Clear screening state when patient focus changes
  useEffect(() => {
    setVoiceFile(null);
    setHandwritingFile(null);
    setTremorFile(null);
    setVideoFile(null);
    setReactionAttempts([]);
    setReactionTime(null);
    setResult(null);
  }, [selectedPatient]);

  // ⌨️ Spacebar Listener for Reaction Test
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault(); // Stop page scrolling
        if (testState === "ready" || testState === "waiting") {
          clickReactionTest();
        } else if (testState === "idle" && reactionAttempts.length < MAX_ATTEMPTS) {
          startReactionTest();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [testState, reactionAttempts]);

  async function loadPatients() {
    try {
      const data = await getAllPatients();
      setPatients(data);
    } catch {
      alert("Failed to load patients");
    }
  }

  function startReactionTest() {
    if (reactionAttempts.length >= MAX_ATTEMPTS) {
      setReactionAttempts([]);
      setReactionTime(null);
    }
    setTestState("waiting");
    setTimeout(() => {
      setTestState("ready");
      setStartTime(performance.now());
    }, Math.random() * 2000 + 1000);
  }

  function clickReactionTest() {
    if (testState === "ready") {
      const delta = Math.round(performance.now() - startTime);
      const newAttempts = [...reactionAttempts, delta];
      setReactionAttempts(newAttempts);
      setTestState("idle");

      if (newAttempts.length === MAX_ATTEMPTS) {
        // Exclude slowest time, average remaining 4
        const maxVal = Math.max(...newAttempts);
        const filtered = newAttempts.filter((_, i) => i !== newAttempts.indexOf(maxVal));
        const avg = Math.round(filtered.reduce((a, b) => a + b, 0) / 4);
        setReactionTime(avg);
      }
    } else if (testState === "waiting") {
      alert("Too early!");
      setTestState("idle");
    }
  }

  const readySensors = [
    voiceFile && "Voice",
    handwritingFile && "Handwriting",
    tremorFile && "Tremor",
    videoFile && "Gait",
    reactionTime && `${reactionTime}ms`,
  ].filter(Boolean);

  async function handlePredict() {
    if (!selectedPatient) return alert("Select patient");
    if (readySensors.length < 2) return alert("Complete at least 2 tests to continue");

    setLoading(true);
    try {
      const res = await predictFull(
        voiceFile,
        handwritingFile,
        tremorFile,
        reactionTime,
        videoFile,
        selectedPatient
      );
      setResult(res);
    } catch {
      alert("Analysis failed");
    }
    setLoading(false);
  }

  const getReactionColor = (ms: number) => {
    if (ms < 400) return "text-medical-teal";
    if (ms <= 550) return "text-medical-amber";
    return "text-medical-red";
  };

  const getReactionBg = (ms: number) => {
    if (ms < 400) return "bg-medical-teal/5 border-medical-teal/10";
    if (ms <= 550) return "bg-medical-amber/5 border-medical-amber/10";
    return "bg-medical-red/5 border-medical-red/10";
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-700">

      {/* 🧠 HEADER */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="font-serif text-4xl font-bold text-midnight tracking-tight mb-2">
            Screening Intelligence Suite
          </h1>
          <p className="text-slate font-medium">
            Multimodal Biomarker Screening & Risk Analysis
          </p>
        </div>
        <div className="flex gap-2">
          <div className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${readySensors.length >= 2 ? 'bg-medical-teal/10 text-medical-teal border-medical-teal/20' : 'bg-slate/5 text-slate/40 border-slate/10'}`}>
            {readySensors.length}/5 Tests Completed
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">

        {/* 🧬 PATIENT SELECTOR & SUBMIT (LEFT COL) */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="medical-card p-8 bg-white shadow-xl">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate mb-4">Patient Focus</h3>
            <select
              onChange={(e) => setSelectedPatient(Number(e.target.value))}
              className="input-premium"
            >
              <option value="">Select Profile...</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Age {p.age})
                </option>
              ))}
            </select>
            <p className="mt-4 text-[10px] text-slate/60 font-medium italic">Selecting a participant will link all screening data to their clinical record.</p>
          </div>

          {/* ⚡ REACTION SPEED MODULE */}
          <div className="medical-card p-8 text-center relative overflow-hidden bg-white shadow-xl">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-midnight">Reaction Speed Analysis</h3>
              <div className="flex gap-1">
                {[...Array(MAX_ATTEMPTS)].map((_, i) => (
                  <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < reactionAttempts.length ? 'bg-medical-teal' : 'bg-slate/20'}`} />
                ))}
              </div>
            </div>

            {reactionTime ? (
              <div className={`mb-8 p-6 rounded-2xl border animate-in zoom-in duration-500 ${getReactionBg(reactionTime)}`}>
                <p className={`text-5xl font-serif font-bold leading-none ${getReactionColor(reactionTime)}`}>{reactionTime}<span className="text-xl ml-1">ms</span></p>
                <p className={`text-[10px] font-bold mt-3 uppercase tracking-widest leading-none ${getReactionColor(reactionTime)}`}>Clinical Average (N=4)</p>
              </div>
            ) : (
              <div className="mb-8 py-8 flex flex-col items-center opacity-20">
                <span className="material-symbols-outlined text-6xl font-light mb-2">keyboard</span>
                <p className="text-[10px] font-bold uppercase tracking-widest">
                  {reactionAttempts.length > 0 ? `Trial ${reactionAttempts.length + 1} of ${MAX_ATTEMPTS}` : 'Awaiting Input'}
                </p>
              </div>
            )}

            <div className="space-y-4">
              {testState === "idle" && (
                <button
                  onClick={startReactionTest}
                  className="w-full py-4 border-2 border-midnight text-midnight rounded-xl font-bold hover:bg-midnight hover:text-white transition-all active:scale-95"
                >
                  {reactionAttempts.length > 0 && reactionAttempts.length < MAX_ATTEMPTS
                    ? `Start Trial ${reactionAttempts.length + 1}`
                    : reactionTime ? "Reset & Restart" : "Initialize Test"}
                </button>
              )}

              {testState === "waiting" && (
                <button
                  className="w-full py-10 bg-medical-amber/10 border-2 border-medical-amber text-medical-amber animate-pulse rounded-xl font-bold cursor-wait"
                >
                  READYING...
                </button>
              )}

              {testState === "ready" && (
                <button
                  className="w-full py-10 bg-medical-teal text-white shadow-lg shadow-medical-teal/30 rounded-xl font-bold pointer-events-none"
                >
                  TRIGGER NOW
                </button>
              )}
            </div>

            <div className="mt-6 p-4 rounded-xl bg-slate/5 border border-slate/10">
              <p className="text-[10px] text-slate font-bold uppercase tracking-widest mb-1">Methodology</p>
              <p className="text-[10px] text-slate/70 font-medium">
                Press the <span className="text-midnight font-bold">SPACEBAR</span> as soon as it turns green. We exclude the slowest trial for outlier suppression.
              </p>
            </div>
          </div>

          <div className="medical-card p-10 border-medical-teal/20 bg-medical-teal/[0.02] shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate mb-8 text-center leading-none">Assessment Activation</h3>
            
            <div className="space-y-6">
              {!selectedPatient && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-medical-amber/10 border border-medical-amber/20 text-medical-amber animate-pulse">
                  <span className="material-symbols-outlined text-sm">person_search</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Select Patient Profile to Begin</p>
                </div>
              )}

              {readySensors.length < 2 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-slate/5 border border-slate/10 text-slate">
                  <span className="material-symbols-outlined text-sm">biotech</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Complete at least 2 tests ({readySensors.length}/5)</p>
                </div>
              )}

              {selectedPatient && readySensors.length >= 2 && (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-medical-teal/10 border border-medical-teal/20 text-medical-teal">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <p className="text-[10px] font-bold uppercase tracking-widest">Clinically Ready for Analysis</p>
                </div>
              )}

              <button
                onClick={handlePredict}
                disabled={loading || !selectedPatient || readySensors.length < 2}
                className="w-full py-5 rounded-2xl bg-midnight text-white font-bold text-lg hover:bg-midnight/90 transition-all shadow-xl shadow-midnight/20 disabled:opacity-20 disabled:cursor-not-allowed group relative overflow-hidden active:scale-95"
              >
                <span className="relative z-10">
                  {loading ? "Fusing Neural Data..." : 
                   !selectedPatient ? "Select Profile" :
                   readySensors.length < 2 ? "Awaiting Sensors" : "Run Screening Analysis"}
                </span>
                {loading && <div className="absolute inset-0 bg-medical-teal/20 animate-pulse"></div>}
              </button>
            </div>
            
            <p className="text-[10px] text-slate font-bold uppercase tracking-widest mt-8 text-center opacity-40">
              Multimodal Clinical Integration Engine
            </p>
          </div>
        </div>

        {/* 🛠️ SENSOR COLLECTION (RIGHT COL) */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="medical-card p-8 bg-white shadow-lg border-slate/5">
              <VoiceRecorder onCapture={setVoiceFile} />
              <p className="mt-4 text-[10px] text-slate font-medium text-center italic">Phonetic pattern and articulation screening.</p>
            </div>

            <div className="medical-card p-8 bg-white shadow-lg border-slate/5">
              <HandwritingCanvas onCapture={setHandwritingFile} />
              <p className="mt-4 text-[10px] text-slate font-medium text-center italic">Micrographia and motor control analysis.</p>
            </div>
          </div>

          <div className="medical-card p-8 bg-white shadow-lg border-slate/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-midnight">Hand Tremor Analysis</h3>
              <span className="material-symbols-outlined text-slate/30">vibration</span>
            </div>
            <MotionCapture type="tremor" onCapture={setTremorFile} />
            <p className="mt-4 text-[10px] text-slate font-medium text-center italic">Detection of involuntary resting tremor markers.</p>
          </div>

          <div className="medical-card p-8 bg-white shadow-lg border-slate/5">

            <VideoRecorder onCapture={setVideoFile} />
            <p className="mt-4 text-[10px] text-slate font-medium text-center italic">Stride length, balance, and posture screening via video analysis.</p>
          </div>
        </div>
      </div>

      {/* 📊 RESULT VISUALIZATION AREA */}
      {result && (
        <div className="medical-card p-12 bg-white border-t-8 border-t-medical-teal shadow-2xl animate-in fade-in zoom-in-95 duration-1000">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-serif font-bold text-midnight mb-2">Screening Insights</h2>
              <p className="text-slate font-medium uppercase text-xs tracking-widest opacity-60">Neural Biomarker Analysis Output</p>
            </div>
            <button
              onClick={async () => {
                const patient = patients.find(p => p.id === selectedPatient);
                if (patient) await generateReport(patient, result);
              }}
              className="flex items-center gap-3 px-6 py-3 rounded-xl bg-slate/5 border border-slate/10 text-midnight font-bold text-sm hover:bg-slate/10 transition-all"
            >
              <span className="material-symbols-outlined text-xl leading-none">picture_as_pdf</span>
              Download Analysis Report
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-16">
            {[
              { key: "voiceConfidence", label: "Vocal Dysarthria", icon: "mic" },
              { key: "handwritingConfidence", label: "Handwriting", icon: "draw" },
              { key: "tremorConfidence", label: "Resting Tremor", icon: "vibration" },
              { key: "visualConfidence", label: "Gait & Posture", icon: "directions_walk" },
              { key: "reactionTimeMs", label: "Reaction Time", icon: "timer" },
            ].map(({ key, label, icon }) => {
              let val = result[key];
              if (val == null) return null;

              let displayVal = `${Math.round(val * 100)}%`;
              let subLabel = "Confidence";
              let riskVal = val;

              if (key === "reactionTimeMs") {
                displayVal = `${val}ms`;
                subLabel = "Clinical Average";
                // Risk-based color mapping for reaction time
                riskVal = val > 400 ? (val - 400) / 200 : 0;
                riskVal = Math.min(1, Math.max(0, riskVal));
              }

              const colorClass = riskVal >= 0.75 ? "text-medical-red" : riskVal >= 0.5 ? "text-medical-amber" : "text-medical-teal";
              const bgColorClass = riskVal >= 0.75 ? "bg-medical-red" : riskVal >= 0.5 ? "bg-medical-amber" : "bg-medical-teal";

              return (
                <div key={key} className="p-6 bg-slate/5 rounded-3xl border border-slate/10 transition-all hover:bg-white hover:shadow-xl group flex flex-col h-full">
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate/10 flex items-center justify-center text-slate group-hover:bg-midnight group-hover:text-white transition-all">
                      <span className="material-symbols-outlined text-2xl">{icon}</span>
                    </div>
                    <div className="text-right">
                      <p className={`font-serif font-bold text-2xl ${colorClass}`}>{displayVal}</p>
                      <p className="text-[9px] text-slate font-bold uppercase tracking-widest">{subLabel}</p>
                    </div>
                  </div>

                  <p className="text-[10px] text-slate font-bold uppercase tracking-widest mb-4">{label}</p>

                  <div className="flex-1">
                    {/* Visual Waveform Simulation */}
                    {(key === "voiceConfidence" || key === "tremorConfidence") && (
                      <div className="h-12 flex items-center gap-0.5 mt-4 px-2">
                        {[...Array(15)].map((_, i) => (
                          <div
                            key={i}
                            className={`w-1 rounded-full ${bgColorClass} opacity-30`}
                            style={{
                              height: `${Math.random() * (riskVal > 0.5 ? 80 : 40) + 20}%`,
                              animationDelay: `${i * 0.05}s`
                            }}
                          />
                        ))}
                      </div>
                    )}

                    {key === "handwritingConfidence" && result.handwriting?.annotated_image && (
                      <div className="mt-4 rounded-xl overflow-hidden border border-slate/10 bg-white p-2">
                        <p className="text-[8px] font-bold text-slate uppercase tracking-tighter mb-2">Automated Trace Analysis</p>
                        <img
                          src={`http://localhost:8080/uploads/${result.handwriting.annotated_image}`}
                          alt="Handwriting Trace"
                          className="w-full h-auto object-contain rounded-lg"
                        />
                      </div>
                    )}

                    {key === "reactionTimeMs" && (
                      <div className="mt-4 space-y-2">
                         <div className="h-1.5 w-full bg-slate/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${bgColorClass} transition-all duration-1000`} 
                              style={{ width: `${riskVal * 100}%` }}
                            />
                         </div>
                         <p className="text-[8px] text-slate/50 font-bold uppercase tracking-widest text-center">Relative Latency Risk</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-w-4xl mx-auto py-12 border-t border-slate/10 relative">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-6 text-[10px] font-bold text-slate/40 uppercase tracking-[0.3em]">Aggregate Risk Profile</div>
            <RiskGauge risk={result.finalRisk} level={result.riskLevel} />
            <div className="text-center mt-12">
              <div className={`inline-flex items-center gap-3 px-8 py-3 rounded-2xl font-bold text-sm tracking-widest uppercase border ${result.riskLevel === 'HIGH' ? 'bg-medical-red/10 text-medical-red border-medical-red/20' :
                  result.riskLevel === 'MEDIUM' ? 'bg-medical-amber/10 text-medical-amber border-medical-amber/20' :
                    'bg-medical-teal/10 text-medical-teal border-medical-teal/20'
                }`}>
                <span className="w-2.5 h-2.5 rounded-full bg-current animate-pulse"></span>
                Screening Outcome: {result.riskLevel} Risk
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default PredictionPage;
