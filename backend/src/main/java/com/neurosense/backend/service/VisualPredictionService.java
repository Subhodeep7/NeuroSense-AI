package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.HashMap;
import java.util.Map;

@Service
public class VisualPredictionService {

    private static final String SCRIPT_PATH = "ml-model/inference/visual_analysis.py";

    @Value("${app.project.dir}")
    private String projectDir;

    @Value("${app.upload.dir}")
    private String uploadDir;

    public Map<String, Object> predict(String videoFilePath) {
        try {
            // Pass uploadDir as 2nd arg so Python saves annotated frame there
            ProcessBuilder pb = new ProcessBuilder(
                    "python", SCRIPT_PATH, videoFilePath, uploadDir
            );
            pb.directory(new File(projectDir));
            pb.redirectErrorStream(false);

            Process process = pb.start();

            // Drain stderr so process doesn't block
            Thread stderrDrainer = new Thread(() -> {
                try (BufferedReader errReader = new BufferedReader(
                        new InputStreamReader(process.getErrorStream()))) {
                    String errLine;
                    while ((errLine = errReader.readLine()) != null) {
                        System.err.println("VISUAL MODEL STDERR: " + errLine);
                    }
                } catch (Exception ignored) {}
            });
            stderrDrainer.setDaemon(true);
            stderrDrainer.start();

            // Read stdout for JSON
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String jsonLine = null;
            String line;
            while ((line = reader.readLine()) != null) {
                System.out.println("VISUAL MODEL OUTPUT: " + line);
                if (jsonLine == null && line.trim().startsWith("{")) {
                    jsonLine = line.trim();
                }
            }

            process.waitFor();
            stderrDrainer.join(2000);

            if (jsonLine == null) {
                throw new RuntimeException("No JSON output found from visual model");
            }

            ObjectMapper mapper = new ObjectMapper();
            Map<String, Object> result = new HashMap<>(mapper.readValue(jsonLine, Map.class));

            // Convert annotated image filename → public URL served by WebConfig
            if (result.containsKey("annotated_image_filename")) {
                String filename = (String) result.get("annotated_image_filename");
                result.put("annotated_image_url", "/uploads/" + filename);
            }

            return result;

        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Visual analysis failed: " + e.getMessage(), e);
        }
    }
}
