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
      alert("Camera access denied.");
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
      onCapture(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-midnight">
          Gait & Posture Analysis
        </h3>

        <div className="flex bg-slate/5 p-1 rounded-lg border border-slate/10">
          <button
            onClick={() => setMode("upload")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              mode === "upload" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
            }`}
          >
            Upload
          </button>
          <button
            onClick={() => { setMode("record"); resetCamera(); }}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              mode === "record" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
            }`}
          >
            Use Camera
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="h-64 flex flex-col items-center justify-center bg-slate/[0.02] border-2 border-dashed border-slate/20 rounded-2xl relative overflow-hidden">
        {preview ? (
          <div className="w-full h-full relative group animate-in zoom-in duration-500 bg-black/80 rounded-2xl overflow-hidden">
             <video src={preview} controls className="w-full h-full object-contain" />
             <button 
                onClick={resetCamera}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-medical-red hover:scale-110 transition-transform z-10"
              >
                 <span className="material-symbols-outlined text-sm">close</span>
              </button>
          </div>
        ) : mode === "upload" ? (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate/[0.05] transition-all group">
             <span className="material-symbols-outlined text-4xl text-slate/30 group-hover:text-medical-teal transition-colors mb-3">video_file</span>
             <p className="text-xs font-bold text-slate">CLICK TO UPLOAD VIDEO</p>
             <p className="text-[10px] text-slate/40 mt-1 uppercase tracking-widest">MP4, WEBM, MOV</p>
             <input type="file" className="hidden" accept="video/*" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center relative">
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
            
            {!recording ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center bg-midnight/20 backdrop-blur-[2px]">
                  <button 
                    onClick={startCamera} 
                    className="px-8 py-3 bg-medical-teal text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-medical-teal/90 transition-all shadow-lg shadow-medical-teal/20"
                  >
                    Initialize Camera
                  </button>
               </div>
            ) : (
               <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1 bg-medical-red/90 rounded-full border border-white/20">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">{duration}s</span>
               </div>
            )}

            {recording && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
                  <button 
                    onClick={stopCamera} 
                    className="px-8 py-2.5 bg-white text-midnight text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate/5 transition-all shadow-xl"
                  >
                    Stop Recording
                  </button>
               </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

