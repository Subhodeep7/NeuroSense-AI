import { useRef, useState, useEffect } from "react";

type MotionMode = "gait" | "tremor";

interface Props {
  type: MotionMode;
  onCapture: (file: File) => void;
}

interface MotionSample {
  t: number;
  ax: number;
  ay: number;
  az: number;
}

export default function MotionCapture({ type, onCapture }: Props) {
  // Gait only uses phone sensor — wearable is tremor-only
  const [tab, setTab] = useState<"wearable" | "phone">(type === "tremor" ? "wearable" : "phone");

  // Wearable device state
  const [wearableStatus, setWearableStatus] = useState<"idle" | "waiting" | "received">("idle");
  const [wearableResult, setWearableResult] = useState<any>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollId = useRef<number>(0);

  // Phone live capture state
  const [capturing, setCapturing] = useState(false);
  const [done, setDone] = useState(false);
  const [sampleCount, setSampleCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const samplesRef = useRef<MotionSample[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const motionHandlerRef = useRef<((e: DeviceMotionEvent) => void) | null>(null);

  const DURATION = type === "gait" ? 30 : 15;
  const label = type === "gait" ? "Gait & Posture Analysis" : "Resting Tremor Analysis";
  const icon = type === "gait" ? "directions_walk" : "vibration";

  const instructions = type === "gait"
    ? "Attach the wearable sensor to your ankle. Stand upright and initiate the capture, then walk naturally for 30 seconds."
    : "Secure the wearable sensor to your wrist. Sit in a relaxed position with your arm resting on a flat surface. Stay still for 15 seconds.";

  const phoneInstructions = type === "gait"
    ? "Hold your mobile device securely or place it in a pocket. Walk at your natural pace for 30 seconds."
    : "Sit in a comfortable, relaxed position. Hold your mobile device loosely in your palm and rest your hand on a flat surface.";

  // Auto-start wearable polling when tab switches to wearable (tremor only)
  useEffect(() => {
    if (tab === "wearable" && type === "tremor") {
      fetch("http://localhost:8080/api/sensor/latest?mode=tremor")
        .then(r => r.json())
        .then(d => { lastPollId.current = d?.id ?? 0; })
        .catch(() => {})
        .finally(() => setWearableStatus("waiting"));

      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch("http://localhost:8080/api/sensor/latest?mode=tremor");
          const data = await res.json();
          if (data && data.id && data.id > lastPollId.current) {
            lastPollId.current = data.id;
            setWearableStatus("received");
            setWearableResult(data);
            if (pollRef.current) clearInterval(pollRef.current);

            const payloadForML = {
              sample_count: data.sample_count, duration_ms: data.duration_ms,
              mean_ax: data.mean_ax, mean_ay: data.mean_ay, mean_az: data.mean_az,
              std_ax:  data.std_ax,  std_ay:  data.std_ay,  std_az:  data.std_az,
              rms_ax:  data.rms_ax,  rms_ay:  data.rms_ay,  rms_az:  data.rms_az,
              min_ax: data.min_ax, max_ax: data.max_ax,
              min_ay: data.min_ay, max_ay: data.max_ay,
              min_az: data.min_az, max_az: data.max_az,
            };
            const blob = new Blob([JSON.stringify(payloadForML)], { type: "application/json" });
            onCapture(new File([blob], "tremor_wearable.json", { type: "application/json" }));
          }
        } catch {}
      }, 2000);
    } else {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tab !== "wearable") setWearableStatus("idle");
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [tab]);

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Phone capture
  function startCapture() {
    if (typeof DeviceMotionEvent === "undefined") {
      alert("Motion sensors not available. Please use a mobile browser.");
      return;
    }
    const requestPerm = (DeviceMotionEvent as any).requestPermission;
    if (typeof requestPerm === "function") {
      requestPerm().then((s: string) => {
        if (s === "granted") beginListening(); else alert("Permission denied.");
      });
    } else {
      beginListening();
    }
  }

  function beginListening() {
    samplesRef.current = [];
    setSampleCount(0); setDone(false);
    setCapturing(true); setTimeLeft(DURATION);

    const startTime = Date.now();
    const handler = (e: DeviceMotionEvent) => {
      const acc = e.accelerationIncludingGravity;
      if (!acc) return;
      samplesRef.current.push({ t: Date.now() - startTime, ax: acc.x ?? 0, ay: acc.y ?? 0, az: acc.z ?? 0 });
      setSampleCount(s => s + 1);
    };
    motionHandlerRef.current = handler;
    window.addEventListener("devicemotion", handler);

    countdownRef.current = setInterval(() => setTimeLeft(p => p > 1 ? p - 1 : 0), 1000);
    timerRef.current = setTimeout(() => finishCapture(), DURATION * 1000);
  }

  function finishCapture() {
    if (motionHandlerRef.current) window.removeEventListener("devicemotion", motionHandlerRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    setCapturing(false); setDone(true);
    buildFile(samplesRef.current);
  }

  function buildFile(samples: MotionSample[]) {
    const json = { timestamps: samples.map(s => s.t), ax: samples.map(s => s.ax), ay: samples.map(s => s.ay), az: samples.map(s => s.az) };
    const blob = new Blob([JSON.stringify(json)], { type: "application/json" });
    onCapture(new File([blob], `${type}_phone.json`, { type: "application/json" }));
  }

  return (
    <div className="space-y-6">
      {/* Tab switcher — only shown for tremor (gait uses phone only) */}
      <div className="flex justify-between items-center">
        <div className="flex bg-slate/5 p-1 rounded-lg border border-slate/10">
          {type === "tremor" && (
            <button
              onClick={() => setTab("wearable")}
              className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
                tab === "wearable" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
              }`}
            >
              Wearable Sensor
            </button>
          )}
          <button
            onClick={() => setTab("phone")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              tab === "phone" || type === "gait" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
            }`}
          >
            Mobile Sensor
          </button>
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-slate/5 rounded-full border border-slate/10">
           <span className="w-1.5 h-1.5 rounded-full bg-medical-teal animate-pulse"></span>
           <span className="text-[9px] font-bold text-midnight uppercase tracking-widest">Sensor Active</span>
        </div>
      </div>

      {/* ── WEARABLE TAB ── */}
      {tab === "wearable" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="p-5 bg-slate/[0.03] border-2 border-dashed border-slate/20 rounded-2xl">
             <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-medical-teal text-xl">clinical_notes</span>
                <p className="text-[11px] text-midnight font-medium leading-relaxed italic">{instructions}</p>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="p-5 rounded-2xl border border-slate/10 bg-white shadow-sm flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-slate/5 flex items-center justify-center mb-3">
                   <span className="material-symbols-outlined text-slate text-xl">hub</span>
                </div>
                <p className="text-[10px] font-bold text-midnight uppercase tracking-widest mb-1">Device Node</p>
                <p className="text-[9px] text-slate font-medium uppercase tracking-tighter">NeuroSense V2.0</p>
             </div>
             <div className="p-5 rounded-2xl border border-slate/10 bg-white shadow-sm flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-slate/5 flex items-center justify-center mb-3">
                   <span className="material-symbols-outlined text-slate text-xl">wifi_tethering</span>
                </div>
                <p className="text-[10px] font-bold text-midnight uppercase tracking-widest mb-1">Status</p>
                <div className="flex items-center gap-1.5 mt-1">
                   {wearableStatus === "waiting" && <span className="w-1.5 h-1.5 rounded-full bg-medical-amber animate-pulse"></span>}
                   {wearableStatus === "received" && <span className="w-1.5 h-1.5 rounded-full bg-medical-teal"></span>}
                   <p className={`text-[9px] font-bold uppercase tracking-widest ${wearableStatus === 'received' ? 'text-medical-teal' : 'text-medical-amber'}`}>
                      {wearableStatus === "received" ? "Sync Complete" : "Waiting..."}
                   </p>
                </div>
             </div>
          </div>

          {wearableStatus === "waiting" && (
            <div className="flex flex-col items-center py-4">
              <div className="w-12 h-12 rounded-full border-2 border-slate/10 border-t-medical-teal animate-spin mb-4"></div>
              <p className="text-[10px] font-bold text-slate uppercase tracking-[0.2em]">Listening for telemetry data...</p>
            </div>
          )}

          {wearableStatus === "received" && (
            <div className="p-4 rounded-xl bg-medical-teal/5 border border-medical-teal/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <span className="material-symbols-outlined text-medical-teal">verified</span>
                 <p className="text-[10px] font-bold text-midnight uppercase tracking-widest">Multimodal Telemetry Verified</p>
              </div>
              <button onClick={() => { setWearableStatus("waiting"); }} className="text-[9px] font-bold text-slate uppercase tracking-widest hover:text-midnight transition-colors underline">
                Retest
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PHONE SENSOR TAB ── */}
      {tab === "phone" && (
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="p-5 bg-slate/[0.03] border-2 border-dashed border-slate/20 rounded-2xl">
             <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-medical-teal text-xl">smartphone</span>
                <p className="text-[11px] text-midnight font-medium leading-relaxed italic">{phoneInstructions}</p>
             </div>
          </div>

          <div className="flex flex-col items-center justify-center p-8 rounded-2xl bg-white border-2 border-dashed border-slate/20 shadow-inner min-h-[160px]">
            {!capturing && !done && (
              <button onClick={startCapture} className="btn-premium w-full max-w-[200px]">
                Start Capture
              </button>
            )}

            {capturing && (
              <div className="w-full space-y-6">
                <div className="flex justify-between items-end">
                   <div className="text-left">
                      <p className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1">Time Remaining</p>
                      <p className="text-4xl font-serif font-bold text-midnight leading-none">{timeLeft}s</p>
                   </div>
                   <div className="text-right">
                      <p className="text-[10px] font-bold text-slate uppercase tracking-widest mb-1">Samples</p>
                      <p className="text-xl font-serif font-bold text-medical-teal leading-none">{sampleCount}</p>
                   </div>
                </div>
                <div className="w-full bg-slate/5 rounded-full h-2 overflow-hidden border border-slate/10">
                  <div className="h-full bg-medical-teal shadow-[0_0_10px_rgba(20,184,166,0.3)] transition-all duration-300" style={{ width: `${((DURATION - timeLeft) / DURATION) * 100}%` }} />
                </div>
                <button onClick={finishCapture} className="text-[10px] font-bold text-medical-red uppercase tracking-widest hover:underline transition-all">
                   Terminate Early
                </button>
              </div>
            )}

            {done && (
              <div className="flex flex-col items-center gap-4 animate-in zoom-in duration-500">
                <div className="w-12 h-12 rounded-full bg-medical-teal/10 flex items-center justify-center text-medical-teal mb-2">
                   <span className="material-symbols-outlined text-2xl">check</span>
                </div>
                <div className="text-center">
                   <p className="text-[10px] font-bold text-midnight uppercase tracking-widest mb-1">Capture Complete</p>
                   <p className="text-[9px] text-slate font-medium uppercase tracking-widest">{sampleCount} Samples Collected</p>
                </div>
                <button onClick={() => { setDone(false); setSampleCount(0); }} className="text-[10px] font-bold text-slate uppercase tracking-widest hover:text-midnight transition-colors underline">
                  Retry Capture
                </button>
              </div>
            )}
          </div>

          <p className="text-center text-[9px] text-slate/40 font-bold uppercase tracking-widest">
             Note: Ensure mobile device remains securely oriented during the assessment.
          </p>
        </div>
      )}
    </div>
  );
}

