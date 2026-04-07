import { useRef, useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function VideoRecorder({ onCapture }: Props) {
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [recording, setRecording] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      chunksRef.current = [];
      const mr = new MediaRecorder(stream);
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const file = new File([blob], "walking_video.webm", { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        setPreview(url);
        if (videoRef.current) videoRef.current.srcObject = null;
        onCapture(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("Camera access denied. Please allow camera permissions.");
    }
  }

  function stopCamera() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  function resetCamera() {
    setPreview(null);
    setDuration(0);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  return (
    <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl p-6 relative">
      <h3 className="font-bold text-[#afc6ff] flex items-center gap-2 mb-2">
        <span className="material-symbols-outlined">videocam</span>
        Visual Analysis
      </h3>
      <p className="text-xs text-[#8c90a0] mb-4">Record walking posture & arm swing</p>

      <div className="flex gap-2 mb-4 text-[#e1e2eb]">
        <button onClick={() => setMode("upload")} className={`px-3 py-1 text-xs rounded ${mode === "upload" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}>
          Upload
        </button>
        <button onClick={() => { setMode("record"); resetCamera(); }} className={`px-3 py-1 text-xs rounded ${mode === "record" ? "bg-[#afc6ff] text-black" : "bg-[#272a31]"}`}>
          Use Camera
        </button>
      </div>

      {mode === "upload" && (
        <input type="file" accept="video/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); }} className="text-sm w-full" />
      )}

      {mode === "record" && (
        <div className="space-y-4">
          <video ref={videoRef} autoPlay muted playsInline className={`w-full rounded-xl bg-[#10131a] border border-[#2a2f3a] ${preview ? "hidden" : ""}`} style={{ maxHeight: 280 }} />
          {preview && <video src={preview} controls className="w-full rounded-xl border border-[#2a2f3a]" style={{ maxHeight: 280 }} />}
          
          <div className="flex gap-3">
            {!recording && !preview && (
              <button onClick={startCamera} className="flex-1 py-3 bg-[#afc6ff] text-gray-900 rounded-lg font-bold hover:scale-105 transition shadow-[0_0_20px_rgba(175,198,255,0.4)]">
                Start Recording
              </button>
            )}
            {recording && (
              <button onClick={stopCamera} className="flex-1 py-3 bg-red-500 text-white rounded-lg font-bold animate-pulse hover:bg-red-600 transition">
                Stop ({duration}s)
              </button>
            )}
            {preview && (
              <button onClick={resetCamera} className="flex-1 py-3 bg-[#272a31] text-white rounded-lg font-bold hover:bg-[#32353c] transition">
                Re-record
              </button>
            )}
          </div>
          {preview && <p className="text-[#6ee7b7] text-sm font-medium text-center">✓ Video captured ({duration}s)</p>}
        </div>
      )}
    </div>
  );
}
