import { useRef, useState, useEffect } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function HandwritingCanvas({ onCapture }: Props) {
  const [mode, setMode] = useState<"upload" | "draw">("upload");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "draw") {
      requestAnimationFrame(drawGuide);
    }
  }, [mode]);

  function drawGuide() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(14, 35, 65, 0.05)";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);

    ctx.beginPath();
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    for (let i = 0; i <= 720; i++) {
      const angle = (i * Math.PI) / 180;
      const r = (i / 720) * Math.min(cx, cy) * 0.85;
      const x = cx + r * Math.cos(angle);
      const y = cy + r * Math.sin(angle);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }

    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(14, 35, 65, 0.2)";
    ctx.font = "bold 10px Inter";
    ctx.textAlign = "center";
    ctx.fillText("DRAW SPIRAL STARTING FROM CENTER", cx, canvas.height - 15);
  }

  function getCoords(canvas: HTMLCanvasElement, x: number, y: number) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((x - rect.left) / rect.width) * canvas.width,
      y: ((y - rect.top) / rect.height) * canvas.height,
    };
  }

  function startDraw(e: any) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getCoords(canvas, clientX, clientY);

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = "#0E2341";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    drawingRef.current = true;
    if (e.touches) e.preventDefault();
  }

  function draw(e: any) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const pos = getCoords(canvas, clientX, clientY);

    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasDrawing(true);
    if (e.touches) e.preventDefault();
  }

  function endDraw() {
    drawingRef.current = false;
  }

  function clearCanvas() {
    setHasDrawing(false);
    setPreviewUrl(null);
    drawGuide();
  }

  function captureDrawing() {
    const canvas = canvasRef.current!;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "handwriting.png", { type: "image/png" });
      setPreviewUrl(URL.createObjectURL(blob));
      onCapture(file);
    });
  }

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
            onClick={() => setMode("draw")}
            className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-md transition-all ${
              mode === "draw" ? "bg-white text-midnight shadow-sm" : "text-slate hover:text-midnight"
            }`}
          >
            Draw
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {mode === "upload" ? (
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
      ) : (
        <div className="space-y-4">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            className="w-full h-48 bg-slate/[0.02] border-2 border-dashed border-slate/20 rounded-2xl touch-none cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />

          <div className="flex gap-3">
            <button
              onClick={clearCanvas}
              className="flex-1 py-3 bg-slate/5 text-slate text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-slate/10 transition-all"
            >
              Clear
            </button>
            <button
              onClick={captureDrawing}
              disabled={!hasDrawing}
              className="flex-1 py-3 bg-midnight text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-midnight/90 disabled:opacity-30 transition-all"
            >
              Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
