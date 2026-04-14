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

    private static final String SCRIPT_PATH =
            "C:/Users/mitra/Documents/NeuroSense-AI/ml-model/inference/tremor_analysis.py";

    public Map<String, Object> predict(String jsonData) {
        try {
            // Write json data to a temp file
            File tempFile = File.createTempFile("tremor_" + UUID.randomUUID(), ".json");
            try (FileWriter writer = new FileWriter(tempFile)) {
                writer.write(jsonData);
            }

            ProcessBuilder pb = new ProcessBuilder("python", SCRIPT_PATH, tempFile.getAbsolutePath());

            // Do NOT merge stderr into stdout — Python warnings would corrupt the JSON.
            pb.redirectErrorStream(false);

            Process process = pb.start();

            // Drain stderr on a background thread so the process doesn't block.
            Thread stderrDrainer = new Thread(() -> {
                try (BufferedReader errReader = new BufferedReader(
                        new InputStreamReader(process.getErrorStream()))) {
                    String errLine;
                    while ((errLine = errReader.readLine()) != null) {
                        System.err.println("TREMOR MODEL STDERR: " + errLine);
                    }
                } catch (Exception ignored) {}
            });
            stderrDrainer.setDaemon(true);
            stderrDrainer.start();

            // Read only stdout for JSON parsing.
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String jsonLine = null;
            String line;

            while ((line = reader.readLine()) != null) {
                System.out.println("TREMOR MODEL OUTPUT: " + line);
                if (jsonLine == null && line.trim().startsWith("{")) {
                    jsonLine = line.trim();
                }
            }

            process.waitFor();
            stderrDrainer.join(2000);
            tempFile.delete();

            if (jsonLine == null) {
                throw new RuntimeException("No JSON output found from tremor model");
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(jsonLine, Map.class);

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Tremor prediction failed: " + e.getMessage(), e);
        }
    }
}
