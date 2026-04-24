import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Patient {
  id: number;
  name: string;
  age: number;
  gender: string;
}

interface PredictionResult {
  voice?: { confidence: number };
  handwriting?: { confidence: number };
  gait?: { confidence: number };
  tremor?: { confidence: number };
  visual?: {
    confidence: number;
    annotated_image_url?: string;
    arm_swing_asymmetry?: number;
    step_asymmetry?: number;
    trunk_sway?: number;
    stride_cov?: number;
    cadence_spm?: number;
    wrist_motion_energy?: number;
    biomarkers_positive?: number;
    biomarkers_total?: number;
    backend?: string;
    frames_analyzed?: number;
  };
  reactionTimeMs?: number;
  finalRisk: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  finalPrediction?: number;
  // Also support flat history record format
  voiceConfidence?: number;
  handwritingConfidence?: number;
  gaitConfidence?: number;
  tremorConfidence?: number;
  visualConfidence?: number;
  createdAt?: string;
}

function toPercent(val: number | undefined | null): string {
  if (val === null || val === undefined) return "Not captured";
  return (val * 100).toFixed(1) + "%";
}

// Fetch image URL and return base64 data URI for jsPDF embedding
async function fetchImageAsBase64(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function generateReport(patient: Patient, result: PredictionResult) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const now = result.createdAt ? new Date(result.createdAt) : new Date();
  const dateStr = now.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  // ── Header Banner ──────────────────────────────────────────
  doc.setFillColor(15, 20, 35);
  doc.rect(0, 0, pageW, 40, "F");

  doc.setFontSize(22);
  doc.setTextColor(175, 198, 255);
  doc.setFont("helvetica", "bold");
  doc.text("NeuroSense-AI", 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(140, 144, 160);
  doc.setFont("helvetica", "normal");
  doc.text("Parkinson's Early Detection System", 14, 24);
  doc.text("Clinical Diagnostic Report", 14, 30);

  doc.setFontSize(9);
  doc.setTextColor(175, 198, 255);
  doc.text(dateStr + "  " + timeStr, pageW - 14, 24, { align: "right" });

  // ── Patient Info ───────────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(15, 20, 35);
  doc.setFont("helvetica", "bold");
  doc.text("Patient Information", 14, 52);

  doc.setDrawColor(175, 198, 255);
  doc.setLineWidth(0.5);
  doc.line(14, 54, pageW - 14, 54);

  const patientRows = [
    ["Patient ID", `#${patient.id}`],
    ["Full Name", patient.name],
    ["Age", String(patient.age)],
    ["Gender", patient.gender],
    ["Assessment Date", dateStr],
  ];

  autoTable(doc, {
    startY: 57,
    body: patientRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [80, 90, 110] },
      1: { textColor: [15, 20, 35] },
    },
  });

  // ── Modality Breakdown ─────────────────────────────────────
  const afterPatient = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 20, 35);
  doc.text("Modality Analysis", 14, afterPatient);
  doc.setDrawColor(175, 198, 255);
  doc.line(14, afterPatient + 2, pageW - 14, afterPatient + 2);

  // Prefer the corrected Parkinson's risk values (voiceConfidence etc.)
  // over the raw nested model confidence (voice?.confidence).
  // The raw confidence means "confident in its own prediction" — NOT Parkinson's probability.
  // e.g. healthy voice: voice?.confidence = 0.977 (wrong) vs voiceConfidence = 0.023 (correct)
  const voice       = result.voiceConfidence       ?? result.voice?.confidence;
  const handwriting = result.handwritingConfidence ?? result.handwriting?.confidence;
  const gait        = result.gaitConfidence        ?? result.gait?.confidence;
  const tremor      = result.tremorConfidence      ?? result.tremor?.confidence;
  const visual      = result.visualConfidence      ?? result.visual?.confidence;

  const modalities = [
    ["[MIC]  Voice", toPercent(voice), voice !== undefined ? riskTag(voice) : "-"],
    ["[PEN]  Handwriting", toPercent(handwriting), handwriting !== undefined ? riskTag(handwriting) : "-"],
    ["[WALK] Gait", toPercent(gait), gait !== undefined ? riskTag(gait) : "-"],
    ["[VIB]  Tremor", toPercent(tremor), tremor !== undefined ? riskTag(tremor) : "-"],
    ["[CAM]  Visual", toPercent(visual), visual !== undefined ? riskTag(visual) : "-"],
    ["[TIME] Reaction Time", result.reactionTimeMs ? `${result.reactionTimeMs} ms` : "Not captured", result.reactionTimeMs ? reactionTag(result.reactionTimeMs) : "-"],
  ];

  autoTable(doc, {
    startY: afterPatient + 5,
    head: [["Modality", "Score / Value", "Indicator"]],
    body: modalities,
    theme: "striped",
    headStyles: {
      fillColor: [29, 32, 38],
      textColor: [175, 198, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, textColor: [20, 24, 35] },
    alternateRowStyles: { fillColor: [243, 246, 255] },
  });

  // ── Final Risk Score ───────────────────────────────────────
  const afterModality = (doc as any).lastAutoTable.finalY + 10;
  const riskPct = (result.finalRisk * 100).toFixed(1);
  const level = result.riskLevel ?? (result.finalRisk >= 0.75 ? "HIGH" : result.finalRisk >= 0.5 ? "MEDIUM" : "LOW");

  const levelColor: [number, number, number] =
    level === "HIGH" ? [220, 38, 38] : level === "MEDIUM" ? [217, 119, 6] : [16, 185, 129];

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 20, 35);
  doc.text("Overall Risk Assessment", 14, afterModality);
  doc.setDrawColor(175, 198, 255);
  doc.line(14, afterModality + 2, pageW - 14, afterModality + 2);

  // Risk bar background
  const barY = afterModality + 8;
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(14, barY, pageW - 28, 8, 2, 2, "F");

  // Risk bar fill
  const fillW = ((parseFloat(riskPct) / 100) * (pageW - 28));
  doc.setFillColor(...levelColor);
  doc.roundedRect(14, barY, fillW, 8, 2, 2, "F");

  // Risk labels
  doc.setFontSize(8);
  doc.setTextColor(140, 144, 160);
  doc.text("LOW", 14, barY + 14);
  doc.text("MEDIUM", pageW / 2, barY + 14, { align: "center" });
  doc.text("HIGH", pageW - 14, barY + 14, { align: "right" });

  // Risk value + level badge
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...levelColor);
  doc.text(`${riskPct}% — ${level} RISK`, pageW / 2, barY + 28, { align: "center" });

  // Clinical recommendation
  const reco = level === "HIGH"
    ? "[HIGH ALERT] High risk detected. Immediate neurological consultation is strongly recommended."
    : level === "MEDIUM"
    ? "[MODERATE] Moderate indicators present. Follow-up assessment advised within 30 days."
    : "[LOW RISK] Low neurological risk detected. Continue routine monitoring.";

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 70, 90);
  const splitReco = doc.splitTextToSize(reco, pageW - 28);
  doc.text(splitReco, 14, barY + 38);

  // ── Gait Visual Analysis (MediaPipe annotated frame) ──────────────────────
  const visualObj = result.visual;
  if (visualObj?.annotated_image_url) {
    doc.addPage();
    const pageW2 = doc.internal.pageSize.getWidth();

    // Page header
    doc.setFillColor(15, 20, 35);
    doc.rect(0, 0, pageW2, 18, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(175, 198, 255);
    doc.text("Gait Visual Analysis — MediaPipe Pose", 14, 12);

    // Annotated skeleton image (left column)
    const imgUrl = `http://localhost:8080${visualObj.annotated_image_url}`;
    const imgData = await fetchImageAsBase64(imgUrl);
    if (imgData) {
      doc.addImage(imgData, "PNG", 14, 24, 90, 68);
    }

    // Biomarker table (right column)
    const bRows = [
      ["Arm Swing Asymmetry", visualObj.arm_swing_asymmetry?.toFixed(3) ?? "—", (visualObj.arm_swing_asymmetry ?? 0) > 0.25 ? "RISK" : "OK"],
      ["Step Asymmetry",      visualObj.step_asymmetry?.toFixed(3)      ?? "—", (visualObj.step_asymmetry ?? 0)      > 0.20 ? "RISK" : "OK"],
      ["Trunk Sway",          visualObj.trunk_sway?.toFixed(4)          ?? "—", (visualObj.trunk_sway ?? 0)          > 0.045? "RISK" : "OK"],
      ["Stride CoV",          visualObj.stride_cov?.toFixed(3)          ?? "—", (visualObj.stride_cov ?? 0)          > 0.25 ? "RISK" : "OK"],
      ["Cadence (spm)",       visualObj.cadence_spm?.toFixed(0)         ?? "—", (visualObj.cadence_spm ?? 999) < 90   ? "RISK" : "OK"],
      ["Wrist Energy",        visualObj.wrist_motion_energy?.toFixed(4) ?? "—", (visualObj.wrist_motion_energy ?? 1) < 0.03 ? "RISK" : "OK"],
    ];

    autoTable(doc, {
      startY: 24,
      margin: { left: 112 },
      head: [["Biomarker", "Value", "Status"]],
      body: bRows,
      theme: "striped",
      headStyles: { fillColor: [29, 32, 38], textColor: [175, 198, 255], fontStyle: "bold", fontSize: 9 },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        2: {
          fontStyle: "bold",
          textColor: [80, 80, 80],
        },
      },
      didParseCell(data) {
        if (data.column.index === 2 && data.section === "body") {
          data.cell.styles.textColor = data.cell.raw === "RISK" ? [220, 38, 38] : [16, 185, 129];
        }
      },
    });

    // Summary badge
    const afterBiomarkers = (doc as any).lastAutoTable.finalY + 6;
    doc.setFontSize(9);
    doc.setTextColor(140, 144, 160);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Biomarkers positive: ${visualObj.biomarkers_positive ?? "—"} / ${visualObj.biomarkers_total ?? "—"}   ·   Backend: ${visualObj.backend ?? "opencv_motion"}   ·   Frames: ${visualObj.frames_analyzed ?? "—"}`,
      112, afterBiomarkers
    );
  }

  // ── Footer ─────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 12;
  doc.setFillColor(15, 20, 35);
  doc.rect(0, footerY - 4, pageW, 16, "F");
  doc.setFontSize(8);
  doc.setTextColor(140, 144, 160);
  doc.text("This report is generated by NeuroSense-AI and is intended for clinical use only. Not a substitute for professional medical advice.", pageW / 2, footerY + 2, { align: "center" });

  // Save
  const safeName = patient.name.replace(/\s+/g, "_");
  doc.save(`NeuroSense_Report_${safeName}_${now.toISOString().slice(0, 10)}.pdf`);
}

// ── Helpers ────────────────────────────────────────────────────
function riskTag(val: number): string {
  if (val >= 0.75) return "HIGH RISK";
  if (val >= 0.5) return "MODERATE";
  return "LOW";
}

function reactionTag(ms: number): string {
  if (ms > 650) return "SLOW (High Risk)";
  if (ms > 400) return "MODERATE";
  return "NORMAL";
}
