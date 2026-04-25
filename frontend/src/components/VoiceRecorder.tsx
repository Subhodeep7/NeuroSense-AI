import { useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function VoiceRecorder({ onCapture }: Props) {
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);

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
        <div className="px-4 py-1.5 bg-white text-midnight shadow-sm border border-slate/10 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all">
          Upload Only
        </div>
      </div>

      {/* CONTENT */}
      <div className="h-48 flex flex-col items-center justify-center bg-slate/[0.02] border-2 border-dashed border-slate/20 rounded-2xl relative overflow-hidden">
        {recordedUrl ? (
          <div className="w-full px-8 space-y-4 animate-in zoom-in duration-500">
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate/10 shadow-sm">
               <div className="w-10 h-10 rounded-full bg-medical-teal/10 flex items-center justify-center text-medical-teal">
                  <span className="material-symbols-outlined">audiotrack</span>
               </div>
               <div className="flex-1">
                  <p className="text-[10px] font-bold text-midnight uppercase tracking-widest leading-none mb-1">Captured Audio</p>
                  <p className="text-[9px] text-slate font-bold uppercase tracking-widest">WAV PCM</p>
               </div>
               <button 
                  onClick={() => { setRecordedUrl(null); }}
                  className="w-8 h-8 rounded-full hover:bg-slate/5 flex items-center justify-center text-slate transition-colors"
                >
                   <span className="material-symbols-outlined text-sm">close</span>
                </button>
            </div>
            <audio controls src={recordedUrl} className="w-full h-8 opacity-60" />
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer hover:bg-slate/[0.05] transition-all group">
             <span className="material-symbols-outlined text-4xl text-slate/30 group-hover:text-medical-teal transition-colors mb-3">mic_external_on</span>
             <p className="text-xs font-bold text-slate">CLICK TO UPLOAD SAMPLE</p>
             <p className="text-[10px] text-slate/40 mt-1 uppercase tracking-widest">WAV, MP3, WEBM</p>
             <input type="file" className="hidden" accept="audio/*" onChange={handleFileUpload} />
          </label>
        )}
      </div>
    </div>
  );
}
