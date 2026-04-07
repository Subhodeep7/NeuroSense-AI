package com.neurosense.backend.service;

import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

@Service
public class FusionService {

    /** Original 2-modality fusion (legacy support) */
    public Map<String, Object> fuse(
            Map<String, Object> voiceResult,
            Map<String, Object> handwritingResult
    ) {
        return fuse(voiceResult, handwritingResult, null, null, null, null);
    }

    /** 5-modality fusion (no visual) */
    public Map<String, Object> fuse(
            Map<String, Object> voiceResult,
            Map<String, Object> handwritingResult,
            Map<String, Object> gaitResult,
            Map<String, Object> tremorResult,
            Integer reactionTimeMs
    ) {
        return fuse(voiceResult, handwritingResult, gaitResult, tremorResult, reactionTimeMs, null);
    }

    /** Full 6-modality fusion */
    public Map<String, Object> fuse(
            Map<String, Object> voiceResult,
            Map<String, Object> handwritingResult,
            Map<String, Object> gaitResult,
            Map<String, Object> tremorResult,
            Integer reactionTimeMs,
            Map<String, Object> visualResult
    ) {
        double voiceConf       = getConf(voiceResult);
        double handwritingConf = getConf(handwritingResult);
        double gaitConf        = getConf(gaitResult);
        double tremorConf      = getConf(tremorResult);
        double visualConf      = getConf(visualResult);

        // Reaction Time Scoring: normal ~250ms, Parkinsonian often >400ms
        double reactionConf = 0.0;
        if (reactionTimeMs != null && reactionTimeMs > 0) {
            reactionConf = Math.min(1.0, Math.max(0.0, (reactionTimeMs - 250.0) / 350.0));
        }

        // Weights: Voice(25%) + Handwriting(25%) + Gait(18%) + Tremor(12%) + Visual(12%) + Reaction(8%)
        double finalRisk = (voiceConf       * 0.25)
                         + (handwritingConf * 0.25)
                         + (gaitConf        * 0.18)
                         + (tremorConf      * 0.12)
                         + (visualConf      * 0.12)
                         + (reactionConf    * 0.08);

        int finalPrediction = finalRisk >= 0.5 ? 1 : 0;

        String riskLevel = finalRisk >= 0.75 ? "HIGH"
                         : finalRisk >= 0.5  ? "MEDIUM"
                         :                     "LOW";

        Map<String, Object> result = new HashMap<>();
        result.put("voice",           voiceResult);
        result.put("handwriting",     handwritingResult);
        result.put("gait",            gaitResult);
        result.put("tremor",          tremorResult);
        result.put("visual",          visualResult);
        result.put("reactionTimeMs",  reactionTimeMs);
        result.put("finalPrediction", finalPrediction);
        result.put("finalRisk",       finalRisk);
        result.put("riskLevel",       riskLevel);

        result.put("voiceConfidence",       voiceConf);
        result.put("handwritingConfidence", handwritingConf);
        result.put("gaitConfidence",        gaitConf);
        result.put("tremorConfidence",      tremorConf);
        result.put("visualConfidence",      visualConf);

        return result;
    }

    private double getConf(Map<String, Object> result) {
        if (result == null || !result.containsKey("confidence")) return 0.0;
        return ((Number) result.get("confidence")).doubleValue();
    }
}