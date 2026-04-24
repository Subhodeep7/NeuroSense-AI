import { useRef, useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1;
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0);
  const bitDepth = 16;
  const byteDepth = bitDepth / 8;
  const dataLength = samples.length * byteDepth;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * byteDepth, true);
  view.setUint16(32, numChannels * byteDepth, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export default function VoiceRecorder({ onCapture }: Props) {
  const [mode, setMode] = useState<"upload" | "record">("upload");
  const [recording, setRecording] = useState(false);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
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
      mr.onstop = async () => {
        const rawBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        const arrayBuffer = await rawBlob.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        const wavBlob = encodeWav(audioBuffer);
        const file = new File([wavBlob], "voice_sample.wav", { type: "audio/wav" });
        const url = URL.createObjectURL(wavBlob);
        setRecordedUrl(url);
        onCapture(file);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      alert("Microphone access denied.");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setRecordedUrl(URL.createObjectURL(file));
      onCapture(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-midnight">
          Vocal Screening
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
            onClick={() => setMode("record")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              mode === "record" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
            }`}
          >
            Record
          </button>
        </div>
      </div>

      {/* CONTENT */}
      <div className="h-48 flex flex-col items-center justify-center bg-slate/[0.02] border-2 border-dashed border-slate/20 rounded-2xl relative overflow-hidden">
        
        {/* Simulated Waveform Background (during recording) */}
        {recording && (
           <div className="absolute inset-0 flex items-center justify-center gap-1 opacity-20 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-medical-teal rounded-full animate-pulse" 
                  style={{ height: `${Math.random() * 60 + 20}%`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
           </div>
        )}

        {recordedUrl ? (
          <div className="w-full px-8 space-y-4 animate-in zoom-in duration-500">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate/10 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-medical-teal/10 flex items-center justify-center text-medical-teal">
                  <span className="material-symbols-outlined">audiotrack</span>
               </div>
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-midnight uppercase tracking-widest leading-none mb-1">Captured Audio</p>
                  <p className="text-[9px] text-slate font-bold uppercase tracking-widest">{duration > 0 ? `${duration}s` : "Imported"} • WAV PCM</p>
               </div>
               <button 
                  onClick={() => { setRecordedUrl(null); setDuration(0); }}
                  className="w-8 h-8 rounded-full hover:bg-slate/5 flex items-center justify-center text-slate transition-colors"
                >
                   <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
            <audio controls src={recordedUrl} className="w-full h-8 opacity-60" />
          </div>
        ) : mode === "upload" ? (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate/[0.05] transition-all group">
             <span className="material-symbols-outlined text-4xl text-slate/30 group-hover:text-medical-teal transition-colors mb-3">mic_external_on</span>
             <p className="text-xs font-bold text-slate">CLICK TO UPLOAD SAMPLE</p>
             <p className="text-[10px] text-slate/40 mt-1 uppercase tracking-widest">WAV, MP3, WEBM</p>
             <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
          </label>
        ) : (
          <div className="text-center space-y-6 relative z-10">
            {recording ? (
              <div className="space-y-4">
                <div className="flex flex-col items-center">
                   <div className="w-16 h-16 rounded-full bg-medical-red/10 flex items-center justify-center mb-4">
                      <div className="w-4 h-4 bg-medical-red rounded-full animate-ping"></div>
                   </div>
                   <p className="text-2xl font-serif font-bold text-midnight">{duration}s</p>
                   <p className="text-[10px] font-bold text-medical-red uppercase tracking-[0.2em] mt-1">Recording Live</p>
                </div>
                <button 
                  onClick={stopRecording} 
                  className="px-8 py-2.5 bg-midnight text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-midnight/90 transition-all shadow-lg shadow-midnight/20"
                >
                  Stop Analysis
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="w-16 h-16 rounded-full bg-slate/5 flex items-center justify-center mx-auto mb-4 border border-slate/10">
                   <span className="material-symbols-outlined text-slate/30 text-3xl font-light">mic</span>
                </div>
                <button 
                  onClick={startRecording} 
                  className="px-8 py-3 bg-medical-teal text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-medical-teal/90 transition-all shadow-lg shadow-medical-teal/20"
                >
                  Start Capture
                </button>
                <p className="text-[10px] text-slate font-medium italic">Please speak clearly into the microphone.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

