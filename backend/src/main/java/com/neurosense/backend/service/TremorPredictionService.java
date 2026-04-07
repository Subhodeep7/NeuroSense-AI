package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileWriter;
import java.io.InputStreamReader;
import java.util.Map;
import java.util.UUID;

@Service
public class TremorPredictionService {

    private static final String SCRIPT_PATH = "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/tremor_analysis.py";

    public Map<String, Object> predict(String jsonData) {
        try {
            // Write json data to a temp file
            File tempFile = File.createTempFile("tremor_" + UUID.randomUUID(), ".json");
            try (FileWriter writer = new FileWriter(tempFile)) {
                writer.write(jsonData);
            }
            
            ProcessBuilder pb = new ProcessBuilder("python", SCRIPT_PATH, tempFile.getAbsolutePath());
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder outputBuilder = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("TREMOR MODEL OUTPUT: " + line);
                outputBuilder.append(line);
            }
            process.waitFor();
            
            tempFile.delete();

            String output = outputBuilder.toString();
            // find json part
            int jsonStart = output.indexOf('{');
            if (jsonStart >= 0) {
                output = output.substring(jsonStart);
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(output, Map.class);
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Tremor prediction failed");
        }
    }
}
