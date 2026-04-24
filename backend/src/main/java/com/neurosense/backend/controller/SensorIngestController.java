package com.neurosense.backend.controller;

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
 * Only "tremor" mode is supported — gait analysis uses phone/video, not ESP32.
 * Also provides /latest endpoint for frontend polling.
 */
@RestController
@RequestMapping("/api/sensor")
@CrossOrigin(origins = "*")
public class SensorIngestController {

    @Autowired
    private TremorPredictionService tremorPredictionService;

    // In-memory store for latest tremor reading — no DB needed for real-time polling
    private final ConcurrentHashMap<String, Map<String, Object>> latestByMode = new ConcurrentHashMap<>();
    private final AtomicInteger globalId = new AtomicInteger(0);

    /**
     * ESP32 POSTs here after tremor capture.
     * Only mode="tremor" is accepted. Gait analysis is handled via phone/video, not wearable.
     * Body: { "mode": "tremor", "patientId": 1, ... compact features ... }
     */
    @PostMapping("/ingest")
    public ResponseEntity<?> ingest(@RequestBody Map<String, Object> payload) {
        try {
            String mode = (String) payload.getOrDefault("mode", "tremor");

            // Gait analysis is done via phone sensor / video — not ESP32 wearable
            if ("gait".equals(mode)) {
                return ResponseEntity.badRequest().body(
                    Map.of("status", "error",
                           "message", "Gait analysis via wearable is disabled. Use phone sensor or video upload."));
            }

            if (!"tremor".equals(mode)) {
                return ResponseEntity.badRequest().body(
                    Map.of("status", "error", "message", "Unknown mode: " + mode + ". Only 'tremor' is supported."));
            }

            int sampleCount = getSampleCount(payload);

            // Strip routing keys before passing to ML script
            Map<String, Object> sensorData = new HashMap<>(payload);
            sensorData.remove("mode");
            sensorData.remove("patientId");
            String jsonData = new ObjectMapper().writeValueAsString(sensorData);

            Map<String, Object> result = tremorPredictionService.predict(jsonData);

            // Store latest for frontend polling
            Map<String, Object> stored = new HashMap<>();
            stored.put("id",          globalId.incrementAndGet());
            stored.put("mode",        mode);
            stored.put("sampleCount", sampleCount);
            stored.put("patientId",   payload.get("patientId"));
            stored.put("result",      result);
            payload.forEach((k, v) -> {
                if (!k.equals("mode") && !k.equals("patientId")) stored.put(k, v);
            });
            latestByMode.put(mode, stored);

            Map<String, Object> response = new HashMap<>();
            response.put("status",      "ok");
            response.put("mode",        mode);
            response.put("sampleCount", sampleCount);
            response.put("result",      result);
            System.out.println("[Sensor] ingest [tremor] " + sampleCount
                    + " samples -> confidence: " + result.get("confidence"));
            return ResponseEntity.ok(response);

        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    /**
     * Frontend polls this to detect when the wearable sends new tremor data.
     * GET /api/sensor/latest?mode=tremor
     */
    @GetMapping("/latest")
    public ResponseEntity<?> latest(@RequestParam(name = "mode", defaultValue = "tremor") String mode) {
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
        // Compact ESP32 payload sends 'sample_count' directly
        if (payload.containsKey("sample_count")) {
            try { return ((Number) payload.get("sample_count")).intValue(); } catch (Exception ignored) {}
        }
        // Raw-array payload: count from timestamps list
        try {
            return ((java.util.List<?>) payload.get("timestamps")).size();
        } catch (Exception e) { return 0; }
    }
}
