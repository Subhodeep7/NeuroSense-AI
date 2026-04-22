package com.neurosense.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.Map;

@Service
public class VoicePredictionService {

    private static final String PYTHON_COMMAND = "python";
    private static final String SCRIPT_PATH    = "ml-model/inference/predict_voice.py";

    @Value("${app.project.dir}")
    private String projectDir;

    public Map<String, Object> predict(String audioPath) {

        try {

            ProcessBuilder pb = new ProcessBuilder(
                    PYTHON_COMMAND,
                    SCRIPT_PATH,
                    audioPath
            );

            // Set working directory to project root so relative script path resolves correctly
            pb.directory(new File(projectDir));

            // Do NOT merge stderr into stdout — Python warnings could corrupt the JSON.
            pb.redirectErrorStream(false);

            Process process = pb.start();

            // Drain stderr on a background thread so the process doesn't block.
            Thread stderrDrainer = new Thread(() -> {
                try (BufferedReader errReader = new BufferedReader(
                        new InputStreamReader(process.getErrorStream()))) {
                    String errLine;
                    while ((errLine = errReader.readLine()) != null) {
                        System.err.println("VOICE MODEL STDERR: " + errLine);
                    }
                } catch (Exception ignored) {}
            });
            stderrDrainer.setDaemon(true);
            stderrDrainer.start();

            // Read only stdout for JSON parsing.
            BufferedReader reader =
                    new BufferedReader(
                            new InputStreamReader(process.getInputStream())
                    );

            String jsonLine = null;
            String line;

            while ((line = reader.readLine()) != null) {
                System.out.println("VOICE MODEL OUTPUT: " + line);

                if (jsonLine == null && line.trim().startsWith("{")) {
                    jsonLine = line.trim();
                }
            }

            process.waitFor();
            stderrDrainer.join(2000);

            if (jsonLine == null) {
                throw new RuntimeException("No JSON output found from voice model");
            }

            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(jsonLine, Map.class);

        } catch (Exception e) {

            e.printStackTrace();
            throw new RuntimeException("Voice prediction failed: " + e.getMessage());

        }

    }

}