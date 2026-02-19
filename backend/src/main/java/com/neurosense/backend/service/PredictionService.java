package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.repository.PatientRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.time.LocalDateTime;
import java.util.Map;

@Service
public class PredictionService {

    @Autowired
    private PatientRepository patientRepository;

    public Patient predictAndSave(String name, Integer age, String gender, double[] features) {

        try {

            // Convert features to JSON
            ObjectMapper mapper = new ObjectMapper();
            String featuresJson = mapper.writeValueAsString(features);

            // Python script path
            String pythonScriptPath =
                    "C:\\Users\\mitra\\Documents\\NeuroSense-AI\\ml-model\\inference\\predict.py";

            ProcessBuilder processBuilder =
                    new ProcessBuilder("python", pythonScriptPath, featuresJson);

            processBuilder.redirectErrorStream(true);

            Process process = processBuilder.start();

            BufferedReader reader =
                    new BufferedReader(new InputStreamReader(process.getInputStream()));

            String result = reader.readLine();

            Map<String, Object> predictionResult =
                    mapper.readValue(result, Map.class);

            Integer prediction = (Integer) predictionResult.get("prediction");

            Double confidence = (Double) predictionResult.get("confidence");

            // Save to database
            Patient patient = Patient.builder()
                    .name(name)
                    .age(age)
                    .gender(gender)
                    .prediction(prediction)
                    .confidence(confidence)
                    .createdAt(LocalDateTime.now())
                    .build();

            return patientRepository.save(patient);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Prediction failed");
        }
    }
}
