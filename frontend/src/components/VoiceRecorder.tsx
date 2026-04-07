import { useRef, useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function VoiceRecorder({ onCapture }: Props) {
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/wav" });
        const file = new File([blob], "voice_sample.wav", { type: "audio/wav" });
        const url = URL.createObjectURL(blob);
        setRecorded(url);
        onCapture(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow mic permissions.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  return (
    <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl p-6 relative">
      <h3 className="font-bold text-[#afc6ff] flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined">mic</span>
        Voice Analysis
      </h3>

      <div className="flex gap-2 mb-4 text-[#e1e2eb]">
        <button onClick={() => setMode("upload")} className={`px-3 py-1 text-xs rounded ${mode === "upload" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}>
          Upload
        </button>
        <button onClick={() => setMode("record")} className={`px-3 py-1 text-xs rounded ${mode === "record" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}>
          Record
        </button>
      </div>

      {mode === "upload" && (
        <input type="file" accept=".wav,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); }} className="text-sm w-full" />
      )}

      {mode === "record" && (
        <div className="space-y-3 text-center">
          {!recording && !recorded && (
            <button onClick={startRecording} className="py-3 bg-[#afc6ff] text-gray-900 rounded-full font-bold shadow-[0_0_20px_rgba(175,198,255,0.4)] w-full hover:scale-105 transition">
              Start Recording
            </button>
          )}
          {recording && (
            <div>
              <div className="text-red-500 font-bold text-xl mb-2 animate-pulse">● REC {duration}s</div>
              <button onClick={stopRecording} className="py-3 bg-[#e1e2eb] text-[#0b0e14] rounded-full font-bold w-full hover:scale-105 transition">
                Stop Recording
              </button>
            </div>
          )}
          {recorded && (
            <div className="space-y-2">
              <p className="text-[#6ee7b7] font-medium text-sm">✓ Captured ({duration}s)</p>
              <audio controls src={recorded} className="w-full h-10 max-w-full" />
              <button onClick={() => { setRecorded(null); setDuration(0); }} className="text-xs text-[#8c90a0] underline transition hover:text-white">
                Re-record
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
