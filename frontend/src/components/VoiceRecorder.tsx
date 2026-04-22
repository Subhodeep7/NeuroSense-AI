import { useRef, useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

// Encode raw PCM samples to a proper WAV file (Blob) using Web Audio API output.
// This guarantees librosa on the backend always receives standard PCM WAV bytes.
function encodeWav(audioBuffer: AudioBuffer): Blob {
  const numChannels = 1; // mono
  const sampleRate = audioBuffer.sampleRate;
  const samples = audioBuffer.getChannelData(0); // mono: channel 0
  const bitDepth = 16;
  const byteDepth = bitDepth / 8;
  const dataLength = samples.length * byteDepth;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);           // PCM chunk size
  view.setUint16(20, 1, true);            // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * byteDepth, true); // byte rate
  view.setUint16(32, numChannels * byteDepth, true);              // block align
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);

  // PCM samples (16-bit signed, little-endian)
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
      mr.onstop = async () => {
        // Step 1: collect raw browser blob (webm/opus or whatever browser picked)
        const rawBlob = new Blob(chunksRef.current, { type: "audio/webm" });

        // Step 2: decode to raw PCM via Web Audio API
        const arrayBuffer = await rawBlob.arrayBuffer();
        const audioCtx = new AudioContext();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        await audioCtx.close();

        // Step 3: encode as proper 16-bit PCM WAV — librosa reads this perfectly
        const wavBlob = encodeWav(audioBuffer);
        const file = new File([wavBlob], "voice_sample.wav", { type: "audio/wav" });
        const url = URL.createObjectURL(wavBlob);
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
        <input type="file" accept=".wav,.webm,.mp3,.ogg,audio/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCapture(f); }} className="text-sm w-full" />
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
              <p className="text-[#6ee7b7] font-medium text-sm">✓ Captured ({duration}s) — converted to WAV</p>
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
