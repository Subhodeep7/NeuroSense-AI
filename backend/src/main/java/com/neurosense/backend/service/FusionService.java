package com.neurosense.backend.service;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class FusionService {

    public Map<String, Object> fuse(
            Map<String, Object> voiceResult,
            Map<String, Object> handwritingResult
    ) {

        double voiceConfidence =
                ((Number) voiceResult.get("confidence")).doubleValue();

        double handwritingConfidence =
                ((Number) handwritingResult.get("confidence")).doubleValue();

        int voicePrediction =
                ((Number) voiceResult.get("prediction")).intValue();

        int handwritingPrediction =
                ((Number) handwritingResult.get("prediction")).intValue();


        // Simple average fusion
        double finalRisk =
                (voiceConfidence + handwritingConfidence) / 2.0;


        int finalPrediction =
                finalRisk >= 0.5 ? 1 : 0;


        String riskLevel;

        if (finalRisk >= 0.75) {

            riskLevel = "HIGH";

        } else if (finalRisk >= 0.5) {

            riskLevel = "MEDIUM";

        } else {

            riskLevel = "LOW";

        }


        Map<String, Object> result = new HashMap<>();

        result.put("voice", voiceResult);

        result.put("handwriting", handwritingResult);

        result.put("finalPrediction", finalPrediction);

        result.put("finalRisk", finalRisk);

        result.put("riskLevel", riskLevel);

        return result;

    }

}