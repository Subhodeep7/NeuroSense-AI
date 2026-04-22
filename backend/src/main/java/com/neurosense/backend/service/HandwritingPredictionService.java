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
            "ml-model/inference/predict_handwriting.py";

    public Map<String, Object> predict(String imagePath) {

        try {

            ProcessBuilder pb = new ProcessBuilder(
                    PYTHON_COMMAND,
                    SCRIPT_PATH,
                    imagePath
            );

            // Do NOT merge stderr into stdout — Python warnings (e.g. file-path
            // deprecation warnings starting with "C:\...") would corrupt the JSON.
            pb.redirectErrorStream(false);

            Process process = pb.start();

            // Drain stderr on a background thread so the process doesn't block.
            Thread stderrDrainer = new Thread(() -> {
                try (BufferedReader errReader = new BufferedReader(
                        new InputStreamReader(process.getErrorStream()))) {
                    String errLine;
                    while ((errLine = errReader.readLine()) != null) {
                        System.err.println("HANDWRITING MODEL STDERR: " + errLine);
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
                System.out.println("HANDWRITING MODEL OUTPUT: " + line);

                // Safety net: find the first line that looks like a JSON object,
                // in case any non-JSON noise ever reaches stdout.
                if (jsonLine == null && line.trim().startsWith("{")) {
                    jsonLine = line.trim();
                }
            }

            process.waitFor();
            stderrDrainer.join(2000); // wait up to 2 s for stderr drainer

            if (jsonLine == null) {
                throw new RuntimeException("No JSON output found from handwriting model");
            }

            ObjectMapper mapper = new ObjectMapper();

            Map<String, Object> result = mapper.readValue(jsonLine, Map.class);

            return result;

        } catch (Exception e) {

            e.printStackTrace();

            throw new RuntimeException("Handwriting prediction failed: " + e.getMessage());

        }

    }

}