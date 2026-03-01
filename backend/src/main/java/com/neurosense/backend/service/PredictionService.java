package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.entity.Prediction;
import com.neurosense.backend.repository.PatientRepository;
import com.neurosense.backend.repository.PredictionRepository;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.Map;

@Service
public class PredictionService {

    @Autowired
    private AudioStorageService storageService;

    @Autowired
    private VoicePredictionService voicePredictionService;

    @Autowired
    private HandwritingPredictionService handwritingPredictionService;

    @Autowired
    private FusionService fusionService;

    @Autowired
    private PatientRepository patientRepository;

    @Autowired
    private PredictionRepository predictionRepository;


    public Map<String, Object> predictMultimodal(
            MultipartFile voiceFile,
            MultipartFile handwritingFile,
            Long patientId
    ) {

        try {

            // 1 Store files
            String voicePath =
                    storageService.store(voiceFile);

            String handwritingPath =
                    storageService.store(handwritingFile);


            // 2 Run voice model
            Map<String, Object> voiceResult =
                    voicePredictionService.predict(voicePath);


            // 3 Run handwriting model
            Map<String, Object> handwritingResult =
                    handwritingPredictionService.predict(handwritingPath);


            // 4 Fuse predictions
            Map<String, Object> fusionResult =
                    fusionService.fuse(
                            voiceResult,
                            handwritingResult
                    );


            // 5 Get patient
            Patient patient =
                    patientRepository
                            .findById(patientId)
                            .orElseThrow(
                                    () -> new RuntimeException("Patient not found")
                            );


            // 6 Save prediction
            Prediction prediction =
                    Prediction.builder()
                            .voiceConfidence(
                                    ((Number) voiceResult.get("confidence")).doubleValue()
                            )
                            .handwritingConfidence(
                                    ((Number) handwritingResult.get("confidence")).doubleValue()
                            )
                            .finalPrediction(
                                    ((Number) fusionResult.get("finalPrediction")).intValue()
                            )
                            .finalRisk(
                                    ((Number) fusionResult.get("finalRisk")).doubleValue()
                            )
                            .filePath(voicePath)
                            .originalFileName(voiceFile.getOriginalFilename())
                            .createdAt(LocalDateTime.now())
                            .patient(patient)
                            .build();


            predictionRepository.save(prediction);


            // 7 Return fusion result
            return fusionResult;

        }
        catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException("Multimodal prediction failed");

        }

    }

    public Patient predictAndSave(
            String name,
            Integer age,
            String gender,
            double[] features
    ) {

        try {

            ObjectMapper mapper = new ObjectMapper();

            String featuresJson =
                    mapper.writeValueAsString(features);

            String pythonScriptPath =
                    "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/predict_voice.py";

            ProcessBuilder processBuilder =
                    new ProcessBuilder(
                            "python",
                            pythonScriptPath,
                            featuresJson
                    );

            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();

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

            Map<String, Object> predictionResult =
                    mapper.readValue(output, Map.class);

            Integer predictionValue =
                    (Integer) predictionResult.get("prediction");

            Double confidenceValue =
                    ((Number) predictionResult.get("confidence")).doubleValue();


            Patient patient =
                    Patient.builder()
                            .name(name)
                            .age(age)
                            .gender(gender)
                            .build();

            patient = patientRepository.save(patient);


            Prediction prediction =
                    Prediction.builder()
                            .finalPrediction(predictionValue)
                            .finalRisk(confidenceValue)
                            .createdAt(LocalDateTime.now())
                            .patient(patient)
                            .build();

            predictionRepository.save(prediction);

            return patient;

        }
        catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException("Prediction failed");

        }

    }

}