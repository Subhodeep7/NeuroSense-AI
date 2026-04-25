import { useState } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function HandwritingCanvas({ onCapture }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      onCapture(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase tracking-widest text-midnight">
          Handwriting Analysis
        </h3>
        <div className="px-4 py-1.5 bg-white text-midnight shadow-sm border border-slate/10 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all">
          Upload Only
        </div>
      </div>

      {/* CONTENT */}
      <div className="space-y-4">
         {previewUrl ? (
           <div className="relative group">
              <img src={previewUrl} className="w-full h-48 object-contain bg-slate/5 rounded-2xl border border-slate/10 p-4" alt="Preview" />
              <button 
                onClick={() => { setPreviewUrl(null); }}
                className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center text-medical-red hover:scale-110 transition-transform"
              >
                 <span className="material-symbols-outlined text-sm">close</span>
              </button>
           </div>
         ) : (
           <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate/20 rounded-2xl bg-slate/[0.02] cursor-pointer hover:bg-slate/[0.05] hover:border-medical-teal/40 transition-all group">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <span className="material-symbols-outlined text-4xl text-slate/30 group-hover:text-medical-teal transition-colors mb-3">upload_file</span>
                <p className="text-xs font-bold text-slate">CLICK TO UPLOAD SCAN</p>
                <p className="text-[10px] text-slate/40 mt-1 uppercase tracking-widest">PNG, JPG up to 10MB</p>
              </div>
              <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
           </label>
         )}
      </div>
    </div>
  );
}
