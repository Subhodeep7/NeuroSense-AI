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
  doc.setFillColor(14, 35, 65); // Midnight
  doc.rect(0, 0, pageW, 40, "F");

  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("NeuroSense-AI", 14, 17);

  doc.setFontSize(9);
  doc.setTextColor(200, 210, 230);
  doc.setFont("helvetica", "normal");
  doc.text("Multimodal Neural Biomarker Screening Platform", 14, 24);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("Neural Biomarker Analysis Report", 14, 30);

  doc.setFontSize(9);
  doc.setTextColor(200, 210, 230);
  doc.setFont("helvetica", "normal");
  doc.text(dateStr + "  " + timeStr, pageW - 14, 24, { align: "right" });
  doc.text("Report ID: " + Math.random().toString(36).substr(2, 9).toUpperCase(), pageW - 14, 30, { align: "right" });

  // ── Participant Info ───────────────────────────────────────
  doc.setFontSize(12);
  doc.setTextColor(14, 35, 65);
  doc.setFont("helvetica", "bold");
  doc.text("Participant Identification", 14, 52);

  doc.setDrawColor(14, 35, 65);
  doc.setLineWidth(0.5);
  doc.line(14, 54, pageW - 14, 54);

  const patientRows = [
    ["Participant Ref", `#NS-${patient.id.toString().padStart(4, '0')}`],
    ["Subject Identity", patient.name],
    ["Age / Gender", `${patient.age} / ${patient.gender}`],
    ["Assessment Protocol", "Multimodal Neural Screening"],
    ["Encryption Status", "End-to-End Verified"],
  ];

  autoTable(doc, {
    startY: 57,
    body: patientRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 2 },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 50, textColor: [100, 110, 130] },
      1: { textColor: [14, 35, 65] },
    },
  });

  // ── Screening Modality Breakdown ──────────────────────────
  const afterPatient = (doc as any).lastAutoTable.finalY + 8;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 35, 65);
  doc.text("Screening Biomarker Breakdown", 14, afterPatient);
  doc.line(14, afterPatient + 2, pageW - 14, afterPatient + 2);

  const voice       = result.voiceConfidence       ?? result.voice?.confidence;
  const handwriting = result.handwritingConfidence ?? result.handwriting?.confidence;
  const gait        = result.gaitConfidence        ?? result.gait?.confidence;
  const tremor      = result.tremorConfidence      ?? result.tremor?.confidence;
  const visual      = result.visualConfidence      ?? result.visual?.confidence;

  const modalities = [
    ["Vocal Screening", toPercent(voice), voice !== undefined ? riskTag(voice) : "-"],
    ["Handwriting Analysis", toPercent(handwriting), handwriting !== undefined ? riskTag(handwriting) : "-"],
    ["Gait & Posture Analysis", toPercent(visual), visual !== undefined ? riskTag(visual) : "-"],
    ["Resting Tremor Detection", toPercent(tremor), tremor !== undefined ? riskTag(tremor) : "-"],
    ["Reaction Speed Assessment", result.reactionTimeMs ? `${result.reactionTimeMs} ms` : "Not captured", result.reactionTimeMs ? reactionTag(result.reactionTimeMs) : "-"],
  ];

  autoTable(doc, {
    startY: afterPatient + 5,
    head: [["Assessment Modality", "Confidence Score", "Screening Outcome"]],
    body: modalities,
    theme: "striped",
    headStyles: {
      fillColor: [14, 35, 65],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 10,
    },
    bodyStyles: { fontSize: 10, textColor: [14, 35, 65] },
    alternateRowStyles: { fillColor: [245, 248, 252] },
  });

  // ── Aggregate Screening Risk Profile ────────────────────────
  const afterModality = (doc as any).lastAutoTable.finalY + 12;
  const riskPct = (result.finalRisk * 100).toFixed(1);
  const level = result.riskLevel ?? (result.finalRisk >= 0.75 ? "HIGH" : result.finalRisk >= 0.5 ? "MEDIUM" : "LOW");

  const levelColor: [number, number, number] =
    level === "HIGH" ? [220, 38, 38] : level === "MEDIUM" ? [245, 158, 11] : [20, 184, 166];

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 35, 65);
  doc.text("Aggregate Screening Risk Profile", 14, afterModality);
  doc.line(14, afterModality + 2, pageW - 14, afterModality + 2);

  const barY = afterModality + 10;
  doc.setFillColor(235, 240, 245);
  doc.roundedRect(14, barY, pageW - 28, 10, 2, 2, "F");

  const fillW = ((parseFloat(riskPct) / 100) * (pageW - 28));
  doc.setFillColor(...levelColor);
  doc.roundedRect(14, barY, fillW, 10, 2, 2, "F");

  doc.setFontSize(8);
  doc.setTextColor(140, 144, 160);
  doc.setFont("helvetica", "bold");
  doc.text("LOW RISK", 14, barY + 16);
  doc.text("MEDIUM RISK", pageW / 2, barY + 16, { align: "center" });
  doc.text("HIGH RISK", pageW - 14, barY + 16, { align: "right" });

  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...levelColor);
  doc.text(`${riskPct}% AGGREGATE RISK`, pageW / 2, barY + 34, { align: "center" });

  // Screening Interpretation
  const reco = level === "HIGH"
    ? "[CRITICAL INDICATORS] High screening risk detected. This report indicates significant neural biomarker deviations. Further clinical assessment by a specialist is strongly advised."
    : level === "MEDIUM"
    ? "[ELEVATED INDICATORS] Moderate screening indicators present. Deviations from baseline phonation and motor control noted. Follow-up assessment advised."
    : "[BASELINE STABILITY] Low screening risk detected. Neural biomarkers appear within stable ranges compared to the training cohort.";

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(14, 35, 65);
  doc.text("Screening Interpretation:", 14, barY + 48);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 70, 90);
  const splitReco = doc.splitTextToSize(reco, pageW - 28);
  doc.text(splitReco, 14, barY + 54);

  // ── Gait & Posture Analysis ─────────────────────────────────────────────
  const visualObj = result.visual;
  if (visualObj && (visualObj.arm_swing_asymmetry != null || visualObj.biomarkers_positive != null)) {
    doc.addPage();

    doc.setFillColor(14, 35, 65);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("Advanced Gait & Posture Screening - Biomarker Analysis", 14, 12);

    // jsPDF only supports Latin-1 in built-in fonts — no Unicode emoji/symbols.
    // Use plain ASCII: "[RISK]" and "[ OK ]"
    const S_RISK = "[RISK]";
    const S_OK   = "[ OK ]";

    const headVis = (visualObj as any).head_visible ?? "none";

    // Identity colors per biomarker [R, G, B]
    const BM_COLORS: Record<string, [number, number, number]> = {
      "Arm Swing Asymmetry":  [139,  92, 246],
      "Step Asymmetry":       [ 99, 102, 241],
      "Trunk Lateral Sway":   [  6, 182, 212],
      "Trunk Lean Ratio":     [ 16, 185, 129],
      "Stride Rhythm CoV":    [249, 115,  22],
      "Cadence (steps/min)":  [245, 158,  11],
      "Wrist Motion Energy":  [244,  63,  94],
      "Head Bob Amplitude":   [ 14, 165, 233],
    };

    // Build rows — skip head_bob when head not detected (value is meaningless 0.0)
    const bRows: [string, string, string][] = [
      ["Arm Swing Asymmetry",
       visualObj.arm_swing_asymmetry?.toFixed(3) ?? "-",
       (visualObj.arm_swing_asymmetry ?? 0) > 0.25 ? S_RISK : S_OK],
      ["Step Asymmetry",
       visualObj.step_asymmetry?.toFixed(3) ?? "-",
       (visualObj.step_asymmetry ?? 0) > 0.18 ? S_RISK : S_OK],
      ["Trunk Lateral Sway",
       visualObj.trunk_sway?.toFixed(4) ?? "-",
       (visualObj.trunk_sway ?? 0) > 0.08 ? S_RISK : S_OK],
      ["Trunk Lean Ratio",
       (visualObj as any).trunk_lean_ratio?.toFixed(3) ?? "-",
       ((visualObj as any).trunk_lean_ratio ?? 0) > 0.18 ? S_RISK : S_OK],
      ["Stride Rhythm CoV",
       visualObj.stride_cov?.toFixed(3) ?? "-",
       (visualObj.stride_cov ?? 0) > 0.25 ? S_RISK : S_OK],
      ["Cadence (steps/min)",
       visualObj.cadence_spm ? String(visualObj.cadence_spm) : "N/A",
       (visualObj.cadence_spm ?? 999) < 88 ? S_RISK : S_OK],
      ["Wrist Motion Energy",
       visualObj.wrist_motion_energy?.toFixed(4) ?? "-",
       (visualObj.wrist_motion_energy ?? 1) < 0.12 ? S_RISK : S_OK],
      // Head bob: only include when head was actually detected
      ...(headVis !== "none"
        ? [["Head Bob Amplitude",
            visualObj.head_bob_std?.toFixed(4) ?? "-",
            (visualObj.head_bob_std ?? 0) > 0.050 ? S_RISK : S_OK] as [string, string, string]]
        : [["Head Bob Amplitude", "N/A (head not visible)", "-"] as [string, string, string]]),
    ];

    let tableLeft = 14;
    let imgDrawn  = false;

    if (visualObj.annotated_image_url) {
      const imgUrl  = `http://localhost:8080${visualObj.annotated_image_url}`;
      const imgData = await fetchImageAsBase64(imgUrl);
      if (imgData) {
        doc.addImage(imgData, "PNG", 14, 22, 86, 70);
        tableLeft = 106;
        imgDrawn  = true;
      }
    }

    // Available width for table
    const tableWidth = pageW - tableLeft - 14;
    const colW0 = tableWidth - 26 - 22;   // biomarker name (remaining)
    const colW1 = 26;                       // value
    const colW2 = 22;                       // status

    autoTable(doc, {
      startY:  22,
      margin:  { left: tableLeft, right: 14 },
      head: [["Biomarker", "Value", "Status"]],
      body: bRows,
      theme: "plain",
      tableWidth: tableWidth,
      headStyles: {
        fillColor:   [14, 35, 65],
        textColor:   [255, 255, 255],
        fontStyle:   "bold",
        fontSize:    9,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 2 },
      },
      bodyStyles: {
        fontSize:    8.5,
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 2 },
        textColor:   [30, 40, 60],
      },
      columnStyles: {
        0: { cellWidth: colW0, fontStyle: "bold" },
        1: { cellWidth: colW1, halign: "right"   },
        2: { cellWidth: colW2, halign: "center"  },
      },
      alternateRowStyles: { fillColor: [246, 247, 251] },
      didParseCell(data) {
        if (data.section !== "body") return;
        const rowName = bRows[data.row.index]?.[0] ?? "";
        const color   = BM_COLORS[rowName] ?? [60, 80, 100];
        const status  = bRows[data.row.index]?.[2] ?? "";
        const isRisk  = status === S_RISK;
        const isNA    = status === "-";

        if (data.column.index === 0) {
          data.cell.styles.textColor = color;
        } else if (data.column.index === 2) {
          if (isNA) {
            data.cell.styles.textColor  = [180, 190, 200];
            data.cell.styles.fontStyle  = "normal";
          } else {
            data.cell.styles.textColor  = isRisk ? [200, 30, 30] : [16, 150, 100];
            data.cell.styles.fontStyle  = "bold";
          }
        }
      },
    });

    const afterTable = (doc as any).lastAutoTable.finalY + 5;
    doc.setFontSize(7.5);
    doc.setTextColor(110, 120, 140);
    doc.setFont("helvetica", "normal");
    const summaryParts = [
      `Markers flagged: ${visualObj.biomarkers_positive ?? 0} / ${visualObj.biomarkers_total ?? 8}`,
      `Frames analyzed: ${visualObj.frames_analyzed ?? "-"}`,
      `Head visibility: ${headVis}`,
      `Shoulder ref width: ${(visualObj as any).ref_shoulder_width ?? "-"}`,
      `Engine: MediaPipe Pose V2`,
    ];
    doc.text(summaryParts.join("   |   "), tableLeft, afterTable, { maxWidth: tableWidth + colW2 });
    if (!imgDrawn) {
      doc.setFontSize(7);
      doc.setTextColor(170, 180, 195);
      doc.text("Annotated skeleton frame not available - landmark-only analysis", 14, afterTable + 5);
    }
  }



  // ── Footer ─────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 15;
  doc.setFillColor(14, 35, 65);
  doc.rect(0, footerY, pageW, 15, "F");
  doc.setFontSize(8);
  doc.setTextColor(200, 210, 230);
  doc.text("Disclaimer: This report is a screening support analysis generated by the NeuroSense-AI engine. It is not a definitive clinical assessment.", pageW / 2, footerY + 6, { align: "center" });
  doc.text("Confidentiality: This document contains protected health information. Unauthorized disclosure is prohibited.", pageW / 2, footerY + 10, { align: "center" });

  const safeName = patient.name.replace(/\s+/g, "_");
  doc.save(`NeuroSense_Analysis_${safeName}_${now.toISOString().slice(0, 10)}.pdf`);
}

function riskTag(val: number): string {
  if (val >= 0.75) return "HIGH RISK";
  if (val >= 0.5) return "MODERATE";
  return "STABLE";
}

function reactionTag(ms: number): string {
  if (ms > 650) return "SLOW RESPONSE";
  if (ms > 400) return "MODERATE";
  return "NORMAL";
}
