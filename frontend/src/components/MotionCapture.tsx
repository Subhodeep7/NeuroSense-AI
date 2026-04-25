import { useRef, useState, useEffect } from "react";

interface Props {
  type: "tremor" | "gait";
  onCapture: (file: File) => void;
}

export default function MotionCapture({ type, onCapture }: Props) {
  // Wearable device state
  const [wearableStatus, setWearableStatus] = useState<"idle" | "waiting" | "received">("idle");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPollId = useRef<number>(0);

  const instructions = type === "gait"
    ? "Attach the wearable sensor to your ankle. Stand upright and initiate the capture, then walk naturally for 30 seconds."
    : "Secure the wearable sensor to your wrist. Sit in a relaxed position with your arm resting on a flat surface. Stay still for 15 seconds.";

  // Auto-start wearable polling
  useEffect(() => {
    fetch(`http://localhost:8080/api/sensor/latest?mode=${type}`)
      .then(r => r.json())
      .then(d => { lastPollId.current = d?.id ?? 0; })
      .catch(() => {})
      .finally(() => setWearableStatus("waiting"));

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8080/api/sensor/latest?mode=${type}`);
        const data = await res.json();
        if (data && data.id && data.id > lastPollId.current) {
          lastPollId.current = data.id;
          setWearableStatus("received");
          
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
          onCapture(new File([blob], `${type}_wearable.json`, { type: "application/json" }));
          
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {}
    }, 2000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [type, onCapture]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="px-4 py-1.5 bg-white text-midnight shadow-sm border border-slate/10 text-[10px] font-bold uppercase tracking-widest rounded-md">
          Wearable Sensor Analysis
        </div>
        
        <div className="flex items-center gap-2 px-3 py-1 bg-slate/5 rounded-full border border-slate/10">
           <span className="w-1.5 h-1.5 rounded-full bg-medical-teal animate-pulse"></span>
           <span className="text-[9px] font-bold text-midnight uppercase tracking-widest">Telemetry Active</span>
        </div>
      </div>

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
    </div>
  );
}
