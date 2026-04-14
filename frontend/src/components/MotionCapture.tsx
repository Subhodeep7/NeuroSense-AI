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
  const [tab, setTab] = useState<"wearable" | "phone">("wearable");

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
  const label = type === "gait" ? "Gait Analysis" : "Rest Tremor";
  const icon = type === "gait" ? "directions_walk" : "vibration";

  const instructions = type === "gait"
    ? "Wear the device on your ankle. Stand up and press the button on the device, then walk normally for 30 seconds."
    : "Wear the device on your wrist. Sit still, rest your hand on a flat surface, then press the button and stay relaxed for 15 seconds.";

  const phoneInstructions = type === "gait"
    ? "Hold your phone in your hand or pocket and walk normally for 30 seconds."
    : "Sit still. Rest your hand on a flat surface with the phone held loosely for 15 seconds.";

  // Poll backend for latest sensor data from the wearable device
  function startWaiting() {
    setWearableStatus("waiting");
    setWearableResult(null);

    fetch("http://localhost:8080/api/sensor/latest?mode=" + type)
      .then(r => r.json())
      .then(d => { lastPollId.current = d?.id ?? 0; })
      .catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8080/api/sensor/latest?mode=" + type);
        const data = await res.json();
        if (data && data.id && data.id > lastPollId.current) {
          setWearableStatus("received");
          setWearableResult(data);
          if (pollRef.current) clearInterval(pollRef.current);
          const blob = new Blob([JSON.stringify({
            timestamps: data.timestamps,
            ax: data.ax, ay: data.ay, az: data.az
          })], { type: "application/json" });
          onCapture(new File([blob], `${type}_wearable.json`, { type: "application/json" }));
        }
      } catch {}
    }, 2000);
  }

  function cancelWaiting() {
    if (pollRef.current) clearInterval(pollRef.current);
    setWearableStatus("idle");
  }

  useEffect(() => () => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  // Phone capture
  function startCapture() {
    if (typeof DeviceMotionEvent === "undefined") {
      alert("Motion sensors not available. Try on a mobile phone browser.");
      return;
    }
    const requestPerm = (DeviceMotionEvent as any).requestPermission;
    if (typeof requestPerm === "function") {
      requestPerm().then((s: string) => {
        if (s === "granted") beginListening(); else alert("Motion permission denied.");
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
    <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl p-6 relative">
      <h3 className="font-bold text-[#afc6ff] flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined">{icon}</span>
        {label}
      </h3>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4 text-[#e1e2eb]">
        <button
          onClick={() => setTab("wearable")}
          className={`px-3 py-1 text-xs rounded ${tab === "wearable" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}
        >
          Wearable Device
        </button>
        <button
          onClick={() => setTab("phone")}
          className={`px-3 py-1 text-xs rounded ${tab === "phone" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}
        >
          Phone Sensor
        </button>
      </div>

      {/* ── WEARABLE TAB ── */}
      {tab === "wearable" && (
        <div className="space-y-4">
          {/* Same device notice */}
          <div className="flex items-center gap-2 text-[10px] text-[#afc6ff]/70 bg-[#afc6ff]/5 border border-[#afc6ff]/20 rounded-lg px-3 py-1.5">
            <span className="material-symbols-outlined text-[14px]">info</span>
            <span>It's the <strong className="text-[#afc6ff]">same ESP32 device</strong> — just worn differently for each test.</span>
          </div>

          <div className="bg-[#10131a] rounded-lg p-3 text-xs leading-relaxed text-[#8c90a0] border border-[#2a2f3a]">
            {instructions}
          </div>

          <div className="rounded-lg border border-[#afc6ff]/30 bg-[#afc6ff]/5 p-4 flex gap-3 text-xs text-[#c2c6d7]">
            <div className="text-2xl pt-1"><span className="material-symbols-outlined text-[#afc6ff]">router</span></div>
            <div>
              <p className="font-semibold text-white">ESP32 Node</p>
              <p className="mt-1">Sends data over WiFi automatically after capture.</p>
              <div className="flex gap-2 mt-2">
                <span className="bg-[#afc6ff]/20 text-[#afc6ff] px-1.5 py-0.5 rounded">Ready</span>
                <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Capturing</span>
              </div>
            </div>
          </div>

          {wearableStatus === "idle" && (
            <button
              onClick={startWaiting}
              className="w-full py-3 bg-[#afc6ff] text-gray-900 rounded-xl font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(175,198,255,0.4)]"
            >
              Wait for Device Data
            </button>
          )}

          {wearableStatus === "waiting" && (
            <div className="text-center space-y-2 py-2">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full animate-ping bg-[#afc6ff]" />
                <span className="text-sm font-medium text-[#afc6ff]">Listening for wearable...</span>
              </div>
              <p className="text-xs text-[#8c90a0]">Press device button</p>
              <button onClick={cancelWaiting} className="text-xs text-red-400 underline transition hover:text-red-300">Cancel</button>
            </div>
          )}

          {wearableStatus === "received" && (
            <div className="text-center space-y-1">
              <p className="text-[#6ee7b7] font-bold text-sm">✓ Data received!</p>
              {wearableResult && (
                <p className="text-xs text-[#8c90a0]">
                  {wearableResult.sampleCount ?? "–"} samples &bull; {wearableResult.mode}
                </p>
              )}
              <button onClick={() => setWearableStatus("idle")} className="text-xs text-[#afc6ff] underline transition hover:text-white mt-1">
                Wait again
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── PHONE SENSOR TAB ── */}
      {tab === "phone" && (
        <div className="text-center space-y-4">
          <p className="text-xs bg-[#10131a] p-3 rounded-lg text-[#8c90a0] border border-[#2a2f3a] text-left">{phoneInstructions}</p>

          {!capturing && !done && (
            <button onClick={startCapture} className="w-full py-3 bg-[#afc6ff] text-gray-900 rounded-xl font-bold transition hover:scale-105 shadow-[0_0_20px_rgba(175,198,255,0.4)]">
              Start Capture ({DURATION}s)
            </button>
          )}

          {capturing && (
            <div className="space-y-4">
              <div className="text-4xl font-extrabold text-[#afc6ff]">{timeLeft}s</div>
              <div className="w-full bg-[#10131a] rounded-full h-2 border border-[#2a2f3a]">
                <div className="h-full rounded-full transition-all bg-[#afc6ff] shadow-[0_0_10px_rgba(175,198,255,0.5)]" style={{ width: `${((DURATION - timeLeft) / DURATION) * 100}%` }} />
              </div>
              <p className="text-xs text-[#8c90a0]">{sampleCount} samples collected</p>
              <button onClick={finishCapture} className="text-xs text-red-500 underline transition hover:text-red-400">Stop early</button>
            </div>
          )}

          {done && (
            <div>
              <p className="text-[#6ee7b7] text-sm font-bold">✓ {sampleCount} samples captured</p>
              <button onClick={() => { setDone(false); setSampleCount(0); }} className="text-xs text-[#afc6ff] underline mt-2 transition hover:text-white">
                Re-capture
              </button>
            </div>
          )}

          <p className="text-xs text-[#8c90a0] italic">⚠️ Open on mobile phone for motion sensor access</p>
        </div>
      )}
    </div>
  );
}
