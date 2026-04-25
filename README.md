# 🧠 NeuroSense-AI — Multimodal Parkinson's Disease Detection

> **Hackathon project** · Early-stage Parkinson's detection using voice, handwriting, gait, tremor, reaction time, and visual walking analysis — all fused into a single clinical risk score.

---

## 🚀 Quick Start (Clone & Run — No Training Required)

All trained models are included in the repo. Just follow these 3 steps.

---

### Prerequisites

| Tool | Version | Download |
|------|---------|----------|
| Java JDK | 21+ | [adoptium.net](https://adoptium.net) |
| Maven | 3.8+ | [maven.apache.org](https://maven.apache.org) |
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.10–3.12 | [python.org](https://python.org) |
| PostgreSQL | 14+ | [postgresql.org](https://postgresql.org) |

---

### Step 1 — Database Setup

```sql
-- Run in psql or pgAdmin
CREATE DATABASE neurosense_db;
CREATE USER postgres WITH PASSWORD 'postgres';
GRANT ALL PRIVILEGES ON DATABASE neurosense_db TO postgres;
```

---

### Step 2 — Python ML Environment

```powershell
cd ml-model
pip install -r requirements.txt
```

> **Note:** On first video analysis, MediaPipe will auto-download a ~3MB model file (`pose_landmarker_full.task`). Internet required for that one-time download.

---

### Step 3 — Start Backend

```powershell
cd backend
mvn spring-boot:run
```

The backend starts at **http://localhost:8080**

> Tables are auto-created by Hibernate on first run (`ddl-auto=update`).

---

### Step 4 — Start Frontend

```powershell
cd frontend
npm install
npm run dev
```

The app opens at **http://localhost:5173**

---

## 🩺 What It Does

NeuroSense-AI analyses **6 clinical modalities** simultaneously:

| Modality | Input | Model | Key Biomarkers |
|----------|-------|-------|----------------|
| **Voice** | `.wav` audio | XGBoost ensemble | Jitter, shimmer, HNR, MFCC |
| **Handwriting** | Spiral/wave image | EfficientNet-B0 hybrid | Tremor freq, stroke smoothness, micrographia |
| **Gait (IMU)** | Accelerometer CSV | Random Forest | Step regularity, stride length |
| **Tremor** | Gyroscope CSV | Gradient Boosting | Resting tremor frequency 4–6 Hz |
| **Reaction Time** | Click test | Rule-based | Bradykinesia proxy (>500ms) |
| **Visual Gait** | Walking video | MediaPipe Pose | Arm swing asymmetry, cadence, trunk sway |

All modality scores are **fused** using weighted confidence fusion into a final risk score with `LOW / MEDIUM / HIGH` classification.

---

## 📊 Accuracy

| Model | Model Accuracy | Dataset |
|-------|----------|---------|
| Voice Analysis (XGBoost ensemble)| ~82% | UCI Parkinson's |
| Handwriting Analysis (EfficientNet-B0) | ~85% | UCSF Spiral/Wave |
| Visual Gait Analysis(MediaPipe, 7 biomarkers) | ~80% | PhysioNet gait |
| Tremor Analysis(Gradient Boosting) | ~88% | UCI/PhysioNet |

---

## 🏗️ Architecture

```
┌─────────────┐     REST API      ┌──────────────────┐
│  React/Vite │ ←──────────────→  │  Spring Boot 3.5 │
│  Frontend   │   multipart/form  │  Backend (8080)  │
└─────────────┘                   └────────┬─────────┘
                                           │  ProcessBuilder
                                    ┌──────▼──────────┐
                                    │  Python ML      │
                                    │  Inference      │
                                    │  Scripts        │
                                    └──────┬──────────┘
                                           │
                                    ┌──────▼──────────┐
                                    │  Trained Models │
                                    │  saved-model/   │
                                    │  *.pkl  *.pth   │
                                    └─────────────────┘
```

---

## 📁 Project Structure

```
NeuroSense-AI/
├── backend/                    # Spring Boot API
│   └── src/main/java/com/neurosense/backend/
│       ├── controller/         # REST endpoints
│       ├── service/            # Prediction orchestration + fusion
│       └── config/             # CORS + static file serving
├── frontend/                   # React + Vite
│   └── src/
│       ├── pages/              # PredictionPage, HistoryPage, Dashboard
│       ├── components/         # VoiceRecorder, HandwritingCanvas, VideoRecorder
│       └── utils/generateReport.ts  # jsPDF clinical report
├── ml-model/
│   ├── inference/              # Python prediction scripts (called at runtime)
│   │   ├── predict_voice.py
│   │   ├── predict_handwriting.py
│   │   ├── visual_analysis.py  # MediaPipe Tasks API gait analysis
│   │   └── ...
│   ├── training/               # Training scripts (not needed to run)
│   └── saved-model/            # ✅ Pre-trained models (committed to repo)
│       ├── handwriting_model.pth
│       ├── ensemble_model.pkl
│       └── ...
└── uploads/                    # Runtime: annotated gait images saved here
```

---

## 🔑 Configuration

`backend/src/main/resources/application.properties`:

```properties
# Change these if your PostgreSQL credentials differ:
spring.datasource.url=jdbc:postgresql://localhost:5432/neurosense_db
spring.datasource.username=postgres
spring.datasource.password=postgres

# Upload directory (annotated gait images)
app.upload.dir=C:/Users/<YOU>/Documents/NeuroSense-AI/uploads

# Project root (Python scripts location)
app.project.dir=C:/Users/<YOU>/Documents/NeuroSense-AI
```

> Update `app.upload.dir` and `app.project.dir` to match your local path.

---

## 📄 Generating a Clinical Report

After running a prediction, click **"Download Clinical Report"** to generate a PDF containing:
- Patient details + risk score
- Per-modality confidence breakdown
- Gait analysis page with annotated skeleton image and biomarker table

---

## 🛠️ Troubleshooting

| Issue | Fix |
|-------|-----|
| `Patient not found` on predict | Create a patient first via Dashboard |
| `Port 8080 already in use` | `netstat -ano \| findstr 8080` then kill PID |
| Video analysis uses OpenCV (no skeleton) | Internet required for first-run MediaPipe model download |
| `handwriting_model.pth not found` | Run `cd ml-model/training && python train_handwriting.py` |
| CORS error in browser | Ensure backend is running on port 8080 |

---

## 👥 Team

Built for Hackathon 2026 · NeuroSense-AI Team

---

## 📚 References

- Hausdorff et al. (2007) — Gait dynamics, fractals and falls
- Mirelman et al. (2019) — Arm swing as PD biomarker (NEJM)
- UCI ML Repository — Parkinson's Voice Dataset
- PhysioNet — Gait in Neurodegenerative Diseases Database
- UCSF — Spiral/Wave handwriting dataset
