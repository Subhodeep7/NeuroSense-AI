package com.neurosense.backend.controller;

import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.entity.Prediction;
import com.neurosense.backend.repository.PatientRepository;
import com.neurosense.backend.repository.PredictionRepository;
import com.neurosense.backend.service.AudioStorageService;
import com.neurosense.backend.service.PredictionService;
import com.neurosense.backend.service.VoicePredictionService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class PredictionController {

    @Autowired
    private PredictionService predictionService;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PredictionRepository predictionRepository;

    @Autowired
    private AudioStorageService audioStorageService;

    // Delegates to the fixed VoicePredictionService (proper stderr separation)
    @Autowired
    private VoicePredictionService voicePredictionService;


    // ── Existing feature-based endpoint (DO NOT CHANGE) ──────────────────────
    @PostMapping("/predict")
    public Patient predict(@RequestBody PredictionRequest request) {
        return predictionService.predictAndSave(
                request.getName(),
                request.getAge(),
                request.getGender(),
                request.getFeatures()
        );
    }


    // ── Patients ──────────────────────────────────────────────────────────────
    @GetMapping("/patients")
    public List<Patient> getAllPatients() {
        return patientRepository.findAll();
    }

    @PostMapping("/patients")
    public Patient createPatient(@RequestBody Patient patient) {
        return patientRepository.save(patient);
    }


    // ── Prediction history for a specific patient ─────────────────────────────
    @GetMapping("/patients/{id}/predictions")
    public List<Prediction> getPredictionHistory(@PathVariable("id") Long id) {
        return predictionRepository.findByPatientId(id);
    }


    // ── Dashboard helpers ─────────────────────────────────────────────────────

    /**
     * Returns the single most recently saved prediction.
     * Patient info is extracted manually here to avoid Hibernate proxy
     * serialization issues that crash when Jackson serializes List<Prediction>.
     */
    @GetMapping("/predictions/latest")
    public ResponseEntity<?> getLatestPrediction() {
        return predictionRepository.findTopByOrderByCreatedAtDesc()
                .map(pred -> {
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("id",                   pred.getId());
                    resp.put("finalPrediction",      pred.getFinalPrediction());
                    resp.put("finalRisk",            pred.getFinalRisk());
                    resp.put("riskLevel",            pred.getFinalRisk() != null && pred.getFinalRisk() >= 0.75 ? "HIGH"
                                                   : pred.getFinalRisk() != null && pred.getFinalRisk() >= 0.5  ? "MEDIUM" : "LOW");
                    resp.put("createdAt",            pred.getCreatedAt());
                    resp.put("voiceConfidence",       pred.getVoiceConfidence());
                    resp.put("handwritingConfidence", pred.getHandwritingConfidence());
                    resp.put("gaitConfidence",        pred.getGaitConfidence());
                    resp.put("tremorConfidence",      pred.getTremorConfidence());
                    resp.put("visualConfidence",      pred.getVisualConfidence());
                    resp.put("reactionTimeMs",        pred.getReactionTimeMs());
                    // Extract patient info without letting Jackson touch the proxy
                    if (pred.getPatient() != null) {
                        resp.put("patientId",   pred.getPatient().getId());
                        resp.put("patientName", pred.getPatient().getName());
                    }
                    return ResponseEntity.ok(resp);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    /** Returns total number of predictions saved across all patients. */
    @GetMapping("/predictions/count")
    public long getPredictionCount() {
        return predictionRepository.count();
    }

    /**
     * Returns ALL predictions sorted newest-first, with patient info manually
     * extracted to avoid Hibernate proxy serialization issues.
     * Used by the History page "All Patients" view.
     */
    @GetMapping("/predictions/all")
    public List<Map<String, Object>> getAllPredictions() {
        return predictionRepository.findAllByOrderByCreatedAtDesc()
                .stream()
                .map(pred -> {
                    Map<String, Object> resp = new LinkedHashMap<>();
                    resp.put("id",                   pred.getId());
                    resp.put("finalPrediction",      pred.getFinalPrediction());
                    resp.put("finalRisk",            pred.getFinalRisk());
                    resp.put("riskLevel",
                            pred.getFinalRisk() != null && pred.getFinalRisk() >= 0.75 ? "HIGH"
                          : pred.getFinalRisk() != null && pred.getFinalRisk() >= 0.5  ? "MEDIUM" : "LOW");
                    resp.put("createdAt",            pred.getCreatedAt());
                    resp.put("voiceConfidence",       pred.getVoiceConfidence());
                    resp.put("handwritingConfidence", pred.getHandwritingConfidence());
                    resp.put("gaitConfidence",        pred.getGaitConfidence());
                    resp.put("tremorConfidence",      pred.getTremorConfidence());
                    resp.put("visualConfidence",      pred.getVisualConfidence());
                    resp.put("reactionTimeMs",        pred.getReactionTimeMs());
                    if (pred.getPatient() != null) {
                        resp.put("patientId",   pred.getPatient().getId());
                        resp.put("patientName", pred.getPatient().getName());
                    }
                    return resp;
                })
                .collect(java.util.stream.Collectors.toList());
    }


    // ── Audio-only prediction ─────────────────────────────────────────────────
    /**
     * Previously embedded its own Python process with the broken redirectErrorStream(true).
     * Now delegates to VoicePredictionService which properly separates stderr.
     */
    @PostMapping(value = "/predict-audio", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> predictAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("patientId") Long patientId
    ) {
        try {
            String filePath = audioStorageService.store(file);

            // Use the fixed VoicePredictionService (no more redirectErrorStream(true))
            Map<String, Object> result = voicePredictionService.predict(filePath);

            Integer predictionValue = (Integer) result.get("prediction");
            Double confidenceValue  = ((Number) result.get("confidence")).doubleValue();

            Patient patient = patientRepository.findById(patientId)
                    .orElseThrow(() -> new RuntimeException("Patient not found"));

            Prediction prediction = Prediction.builder()
                    .filePath(filePath)
                    .originalFileName(file.getOriginalFilename())
                    .finalPrediction(predictionValue)
                    .finalRisk(confidenceValue)
                    .createdAt(LocalDateTime.now())
                    .patient(patient)
                    .build();

            predictionRepository.save(prediction);

            return ResponseEntity.ok(result);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Audio prediction failed: " + e.getMessage());
        }
    }


    // ── Full multimodal prediction (voice + handwriting + gait + tremor + reaction + visual) ──
    @PostMapping(value = "/predict-multimodal", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> predictMultimodal(
            @RequestParam("voiceFile") MultipartFile voiceFile,
            @RequestParam("handwritingFile") MultipartFile handwritingFile,
            @RequestParam("patientId") Long patientId
    ) {
        try {
            Map<String, Object> result = predictionService.predictMultimodal(
                    voiceFile, handwritingFile, patientId
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Multimodal prediction failed: " + e.getMessage());
        }
    }

    @PostMapping(value = "/predict-full", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> predictFull(
            @RequestParam(value = "voiceFile",       required = false) MultipartFile voiceFile,
            @RequestParam(value = "handwritingFile", required = false) MultipartFile handwritingFile,
            @RequestParam(value = "gaitData",        required = false) String gaitData,
            @RequestParam(value = "tremorData",      required = false) String tremorData,
            @RequestParam(value = "reactionTimeMs",  required = false) Integer reactionTimeMs,
            @RequestParam(value = "videoFile",       required = false) MultipartFile videoFile,
            @RequestParam("patientId") Long patientId
    ) {
        try {
            Map<String, Object> result = predictionService.predictFull(
                    voiceFile, handwritingFile, gaitData, tremorData,
                    reactionTimeMs, videoFile, patientId
            );
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Full multimodal prediction failed: " + e.getMessage());
        }
    }

}