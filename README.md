# NeuroSense-AI

### Intelligent Multi-Disease Risk Screening System

NeuroSense-AI is an AI-powered healthcare screening system that predicts potential neurological risk indicators using **voice analysis and handwriting analysis**.
The system integrates **Machine Learning, Deep Learning, and Full-Stack Engineering** to provide an intelligent pre-screening tool for early detection.

---

# Project Overview

NeuroSense-AI helps healthcare providers perform **early-stage neurological risk screening** using two non-invasive signals:

• Voice recordings
• Handwriting samples

The system analyzes these inputs using trained machine learning models and provides a **risk prediction with confidence score**.

This approach enables:

* Early detection support
* Faster screening
* AI-assisted decision support for healthcare professionals

---

# Tech Stack

## Frontend

* React
* Vite
* TypeScript
* Tailwind CSS

## Backend

* Spring Boot (Java 21)
* REST API
* JPA / Hibernate

## Machine Learning

* Python
* PyTorch
* Scikit-learn
* XGBoost
* Librosa (audio feature extraction)

## Database

* PostgreSQL

## DevOps

* Docker
* Docker Compose
* GitHub

---

# System Architecture

Frontend (React)
↓
Spring Boot REST API
↓
Python ML Inference (ProcessBuilder)
↓
Trained ML Models
↓
PostgreSQL Database

---

# Machine Learning Models

## Voice Analysis

Audio features extracted:

* MFCC
* Chroma
* Spectral Contrast
* Zero Crossing Rate
* RMS Energy

Models used:

* Random Forest
* XGBoost
* SVM
* Logistic Regression

Final prediction uses **ensemble voting** across models.

---

## Handwriting Analysis

Model:

* Convolutional Neural Network (CNN)
* PyTorch implementation

Input:

* Handwritten image samples

Output:

* Risk prediction
* Confidence score

---

# Project Structure

```
NeuroSense-AI
│
├── frontend
│   ├── src
│   └── package.json
│
├── backend
│   ├── src/main/java
│   ├── src/main/resources
│   └── pom.xml
│
├── ml-model
│   ├── inference
│   │   ├── predict_voice.py
│   │   └── predict_handwriting.py
│   │
│   ├── saved-model
│   │   ├── rf_model.pkl
│   │   ├── xgb_model.pkl
│   │   ├── svm_model.pkl
│   │   ├── lr_model.pkl
│   │   ├── handwriting_model.pth
│   │   └── scaler.pkl
│   │
│   └── requirements.txt
│
├── Dockerfile
├── docker-compose.yml
└── README.md
```

---

# Running the Project Locally

## 1 Clone Repository

```
git clone https://github.com/YOUR_USERNAME/NeuroSense-AI.git
cd NeuroSense-AI
```

---

## 2 Start Backend + ML + Database

```
docker compose up --build
```

Backend will run at:

```
http://localhost:8080
```

---

## 3 Start Frontend

```
cd frontend
npm install
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

# Example API Endpoint

Prediction API:

```
POST /api/predict
```

Example Request:

```
{
  "age": 45,
  "glucose": 150,
  "gender": "male"
}
```

Response:

```
{
  "prediction": 1,
  "confidence": 0.82
}
```

---

# Deployment

The backend and ML environment are containerized using Docker.

Deployment architecture:

Frontend → Vercel
Backend + ML → Railway
Database → PostgreSQL

Docker allows:

* consistent environment
* reproducible builds
* simplified cloud deployment

---

# Key Features

* AI-based neurological risk screening
* Voice analysis using ensemble ML models
* Handwriting analysis using CNN
* Full stack web interface
* Docker containerized deployment
* PostgreSQL data storage
* Modular microservice architecture

---

# Future Improvements

* Add additional disease models
* Real-time voice capture
* Model explainability (SHAP / LIME)
* Doctor dashboard
* Patient risk history visualization
* Mobile app integration

---

# Disclaimer

This project is intended for **research and educational purposes only**.
It is not a medical diagnostic tool and should not replace professional medical evaluation.

---

# Authors

Developed as part of a hackathon project.

AI + Full Stack + DevOps integration.

---
