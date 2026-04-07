package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.Map;

@Service
public class VisualPredictionService {

    private static final String SCRIPT_PATH =
            "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/visual_analysis.py";

    public Map<String, Object> predict(String videoFilePath) {
        try {
            ProcessBuilder pb = new ProcessBuilder("python", SCRIPT_PATH, videoFilePath);
            pb.redirectErrorStream(true);
            Process process = pb.start();

            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("VISUAL MODEL OUTPUT: " + line);
                sb.append(line);
            }
            process.waitFor();

            String output = sb.toString();
            int jsonStart = output.indexOf('{');
            if (jsonStart >= 0) output = output.substring(jsonStart);

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(output, Map.class);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Visual analysis failed", e);
        }
    }
}
