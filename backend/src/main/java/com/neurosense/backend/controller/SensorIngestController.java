package com.neurosense.backend.controller;

import com.neurosense.backend.service.GaitPredictionService;
import com.neurosense.backend.service.TremorPredictionService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Receives raw sensor JSON from ESP32 wearable device over WiFi.
 * Also provides /latest endpoint for frontend polling.
 */
@RestController
@RequestMapping("/api/sensor")
@CrossOrigin(origins = "*")
public class SensorIngestController {

    @Autowired
    private GaitPredictionService gaitPredictionService;

    @Autowired
    private TremorPredictionService tremorPredictionService;

    // In-memory store for latest reading per mode — no DB needed for real-time polling
    private final ConcurrentHashMap<String, Map<String, Object>> latestByMode = new ConcurrentHashMap<>();
    private final AtomicInteger globalId = new AtomicInteger(0);

    /**
     * ESP32 POSTs here after each capture.
     * Body: { "mode": "gait"|"tremor", "patientId": 1, "timestamps": [...], "ax": [...], "ay": [...], "az": [...] }
     */
    @PostMapping("/ingest")
    public ResponseEntity<?> ingest(@RequestBody Map<String, Object> payload) {
        try {
            String mode = (String) payload.getOrDefault("mode", "gait");
            int sampleCount = getSampleCount(payload);

            // Run ML analysis
            Map<String, Object> sensorData = new HashMap<>(payload);
            sensorData.remove("mode");
            sensorData.remove("patientId");
            String jsonData = new ObjectMapper().writeValueAsString(sensorData);

            Map<String, Object> result = "tremor".equals(mode)
                    ? tremorPredictionService.predict(jsonData)
                    : gaitPredictionService.predict(jsonData);

            // Store latest for frontend polling
            Map<String, Object> stored = new HashMap<>();
            stored.put("id", globalId.incrementAndGet());
            stored.put("mode", mode);
            stored.put("sampleCount", sampleCount);
            stored.put("timestamps", payload.get("timestamps"));
            stored.put("ax", payload.get("ax"));
            stored.put("ay", payload.get("ay"));
            stored.put("az", payload.get("az"));
            stored.put("result", result);
            latestByMode.put(mode, stored);

            Map<String, Object> response = new HashMap<>();
            response.put("status", "ok");
            response.put("mode", mode);
            response.put("sampleCount", sampleCount);
            response.put("result", result);
            System.out.println("Sensor ingest [" + mode + "] " + sampleCount + " samples → confidence: " + result.get("confidence"));
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * Frontend polls this to detect when the wearable sends new data.
     * GET /api/sensor/latest?mode=gait
     */
    @GetMapping("/latest")
    public ResponseEntity<?> latest(@RequestParam(defaultValue = "gait") String mode) {
        Map<String, Object> latest = latestByMode.get(mode);
        if (latest == null) return ResponseEntity.ok(Map.of("id", 0));
        return ResponseEntity.ok(latest);
    }

    /** Health check — ESP32 pings this before sending to verify backend is reachable. */
    @GetMapping("/ping")
    public ResponseEntity<String> ping() {
        return ResponseEntity.ok("NeuroSense backend online");
    }

    private int getSampleCount(Map<String, Object> payload) {
        try {
            return ((java.util.List<?>) payload.get("timestamps")).size();
        } catch (Exception e) { return 0; }
    }
}
