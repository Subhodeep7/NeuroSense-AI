package com.neurosense.backend.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.entity.Prediction;
import com.neurosense.backend.repository.PatientRepository;
import com.neurosense.backend.repository.PredictionRepository;
import com.neurosense.backend.service.AudioStorageService;
import com.neurosense.backend.service.PredictionService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
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


    // Existing endpoint (DO NOT CHANGE)
    @PostMapping("/predict")
    public Patient predict(@RequestBody PredictionRequest request) {

        return predictionService.predictAndSave(
                request.getName(),
                request.getAge(),
                request.getGender(),
                request.getFeatures()
        );
    }


    // Existing endpoint
    @GetMapping("/patients")
    public List<Patient> getAllPatients() {

        return patientRepository.findAll();

    }


    // Audio prediction endpoint
    @PostMapping(
            value = "/predict-audio",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> predictAudio(
            @RequestParam("file") MultipartFile file,
            @RequestParam("patientId") Long patientId
    ) {

        try {

            // 1 Store file
            String filePath = audioStorageService.store(file);


            // 2 Run python model
            ProcessBuilder pb = new ProcessBuilder(
                    "python",
                    "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/predict_voice.py",
                    filePath
            );

            pb.redirectErrorStream(true);

            Process process = pb.start();

            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    process.getInputStream()
                            )
                    );

            StringBuilder outputBuilder = new StringBuilder();

            String line;

            while ((line = reader.readLine()) != null) {

                System.out.println("PYTHON OUTPUT: " + line);

                outputBuilder.append(line);

            }

            process.waitFor();

            String output = outputBuilder.toString();

            ObjectMapper mapper = new ObjectMapper();

            Map<String, Object> result =
                    mapper.readValue(output, Map.class);


            Integer predictionValue =
                    (Integer) result.get("prediction");

            Double confidenceValue =
                    ((Number) result.get("confidence")).doubleValue();


            // 3 Get patient
            Patient patient =
                    patientRepository.findById(patientId)
                            .orElseThrow(
                                    () -> new RuntimeException("Patient not found")
                            );


            // 4 Save prediction (UPDATED FIELDS)
            Prediction prediction =
                    Prediction.builder()
                            .filePath(filePath)
                            .originalFileName(file.getOriginalFilename())
                            .finalPrediction(predictionValue)
                            .finalRisk(confidenceValue)
                            .createdAt(java.time.LocalDateTime.now())
                            .patient(patient)
                            .build();

            predictionRepository.save(prediction);


            // 5 Return response
            return ResponseEntity.ok(result);

        }
        catch (Exception e) {

            e.printStackTrace();

            return ResponseEntity
                    .status(500)
                    .body("Prediction failed");

        }

    }


    // Prediction history
    @GetMapping("/patients/{id}/predictions")
    public List<Prediction> getPredictionHistory(
            @PathVariable Long id
    ) {

        return predictionRepository.findByPatientId(id);

    }


    // Create patient
    @PostMapping("/patients")
    public Patient createPatient(
            @RequestBody Patient patient
    ) {

        return patientRepository.save(patient);

    }


    // Multimodal prediction endpoint
    @PostMapping(
            value = "/predict-multimodal",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE
    )
    public ResponseEntity<?> predictMultimodal(

            @RequestParam("voiceFile") MultipartFile voiceFile,
            @RequestParam("handwritingFile") MultipartFile handwritingFile,
            @RequestParam("patientId") Long patientId
    ) {

        try {

            Map<String, Object> result =
                    predictionService.predictMultimodal(
                            voiceFile,
                            handwritingFile,
                            patientId
                    );

            return ResponseEntity.ok(result);

        }
        catch (Exception e) {

            e.printStackTrace();

            return ResponseEntity
                    .status(500)
                    .body("Multimodal prediction failed");

        }

    }

}