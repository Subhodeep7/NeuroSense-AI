import { useRef, useState, useEffect } from "react";

interface Props {
  onCapture: (file: File) => void;
}

export default function HandwritingCanvas({ onCapture }: Props) {
  const [mode, setMode] = useState<"upload" | "draw">("upload");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawing, setHasDrawing] = useState(false);

  // ✅ FIX: Proper canvas init
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

    ctx.strokeStyle = "rgba(175,198,255,0.2)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 5]);

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

    ctx.fillStyle = "rgba(225,226,235,0.3)";
    ctx.font = "bold 10px Inter";
    ctx.textAlign = "center";
    ctx.fillText("Draw the spiral", cx, canvas.height - 10);
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

    ctx.strokeStyle = "#afc6ff";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "rgba(175,198,255,0.6)";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

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
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) ctx.shadowBlur = 0;
  }

  function clearCanvas() {
    setHasDrawing(false);
    drawGuide();
  }

  function captureDrawing() {
    const canvas = canvasRef.current!;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "spiral.png", { type: "image/png" });
      onCapture(file);
    });
  }

  return (
    <div className="bg-[#1d2026]/60 backdrop-blur-xl border border-[#2a2f3a] rounded-2xl p-6 relative">

      {/* HEADER */}
      <div className="flex justify-between mb-4">
        <h3 className="font-bold text-[#afc6ff] flex items-center gap-2">
          <span className="material-symbols-outlined">gesture</span>
          Spiral Analysis
        </h3>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("upload")}
            className={`px-3 py-1 text-xs rounded ${
              mode === "upload"
                ? "bg-[#afc6ff] text-black"
                : "bg-[#272a31]"
            }`}
          >
            Upload
          </button>

          <button
            onClick={() => setMode("draw")}
            className={`px-3 py-1 text-xs rounded ${
              mode === "draw"
                ? "bg-[#afc6ff] text-black"
                : "bg-[#272a31]"
            }`}
          >
            Draw
          </button>
        </div>
      </div>

      {/* CONTENT */}
      {mode === "upload" ? (
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCapture(f);
          }}
          className="w-full text-sm"
        />
      ) : (
        <div>
          <canvas
            ref={canvasRef}
            width={400}
            height={300}
            className="w-full bg-[#10131a] border border-[#2a2f3a] rounded-xl"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />

          <div className="flex gap-3 mt-3">
            <button
              onClick={clearCanvas}
              className="flex-1 bg-[#272a31] py-2 rounded"
            >
              Clear
            </button>

            <button
              onClick={captureDrawing}
              disabled={!hasDrawing}
              className={`flex-1 py-2 rounded ${
                hasDrawing
                  ? "bg-[#afc6ff] text-black"
                  : "bg-gray-600"
              }`}
            >
              Capture
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
