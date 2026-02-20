package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.neurosense.backend.entity.Patient;
import com.neurosense.backend.entity.Prediction;
import com.neurosense.backend.repository.PatientRepository;
import com.neurosense.backend.repository.PredictionRepository;

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

    @Autowired
    private PredictionRepository predictionRepository;


    public Patient predictAndSave(
            String name,
            Integer age,
            String gender,
            double[] features
    ) {

        try {

            // Convert features to JSON
            ObjectMapper mapper =
                    new ObjectMapper();

            String featuresJson =
                    mapper.writeValueAsString(features);


            // Python script path
            String pythonScriptPath =
                    "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/predict.py";


            // Run python
            ProcessBuilder processBuilder =
                    new ProcessBuilder(
                            "python",
                            pythonScriptPath,
                            featuresJson
                    );


            processBuilder.redirectErrorStream(true);


            Process process =
                    processBuilder.start();


            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(
                                    process.getInputStream()
                            )
                    );


            StringBuilder outputBuilder =
                    new StringBuilder();


            String line;


            while ((line = reader.readLine()) != null) {

                System.out.println(
                        "PYTHON OUTPUT: " + line
                );

                outputBuilder.append(line);

            }


            process.waitFor();


            String output =
                    outputBuilder.toString();


            System.out.println(
                    "FINAL OUTPUT: " + output
            );


            // Parse JSON result
            Map<String, Object> predictionResult =
                    mapper.readValue(output, Map.class);


            Integer predictionValue =
                    (Integer) predictionResult.get("prediction");


            Double confidenceValue =
                    ((Number) predictionResult.get("confidence"))
                            .doubleValue();


            // STEP 1: Create and save Patient
            Patient patient =
                    Patient.builder()
                            .name(name)
                            .age(age)
                            .gender(gender)
                            .build();


            patient =
                    patientRepository.save(patient);


            // STEP 2: Create and save Prediction
            Prediction prediction =
                    Prediction.builder()
                            .prediction(predictionValue)
                            .confidence(confidenceValue)
                            .createdAt(LocalDateTime.now())
                            .patient(patient)
                            .build();


            predictionRepository.save(prediction);


            // Return patient
            return patient;


        }
        catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException(
                    "Prediction failed"
            );

        }

    }

}
