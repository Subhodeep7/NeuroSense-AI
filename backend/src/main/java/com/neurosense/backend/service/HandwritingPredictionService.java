package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Map;

@Service
public class HandwritingPredictionService {

    private static final String PYTHON_COMMAND = "python";

    private static final String SCRIPT_PATH =
            "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/predict_handwriting.py";

    public Map<String, Object> predict(String imagePath) {

        try {

            ProcessBuilder pb = new ProcessBuilder(
                    PYTHON_COMMAND,
                    SCRIPT_PATH,
                    imagePath
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

                System.out.println("HANDWRITING MODEL OUTPUT: " + line);

                outputBuilder.append(line);

            }

            process.waitFor();

            String output = outputBuilder.toString();

            ObjectMapper mapper = new ObjectMapper();

            Map<String, Object> result =
                    mapper.readValue(output, Map.class);

            return result;

        }
        catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException("Handwriting prediction failed");

        }

    }

}