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
        Double voiceConf       = getConf(voiceResult);
        Double handwritingConf = getConf(handwritingResult);
        Double gaitConf        = getConf(gaitResult);
        Double tremorConf      = getConf(tremorResult);
        Double visualConf      = getConf(visualResult);

        // Reaction Time Scoring: healthy baseline ≤400ms → zero risk.
        Double reactionConf = null;
        if (reactionTimeMs != null && reactionTimeMs > 0) {
            reactionConf = Math.min(1.0, Math.max(0.0, (reactionTimeMs - 400.0) / 200.0));
        }

        // Base weights per modality
        double wVoice       = 0.20;
        double wHandwriting = 0.15;
        double wGait        = 0.25;
        double wTremor      = 0.30;
        double wReaction    = 0.10;

        double totalWeight = 0.0;
        double weightedSum = 0.0;

        if (voiceConf != null)       { weightedSum += voiceConf       * wVoice;       totalWeight += wVoice; }
        if (handwritingConf != null) { weightedSum += handwritingConf * wHandwriting; totalWeight += wHandwriting; }
        if (gaitConf != null || visualConf != null) {
            double combinedGaitConf = (gaitConf != null && visualConf != null) 
                ? (gaitConf + visualConf) / 2.0 
                : (gaitConf != null ? gaitConf : visualConf);
            weightedSum += combinedGaitConf * wGait;
            totalWeight += wGait;
        }
        if (tremorConf != null)      { weightedSum += tremorConf      * wTremor;      totalWeight += wTremor; }
        if (reactionConf != null)    { weightedSum += reactionConf    * wReaction;    totalWeight += wReaction; }

        double finalRisk = totalWeight > 0 ? weightedSum / totalWeight : 0.0;
        int finalPrediction = finalRisk >= 0.5 ? 1 : 0;
        String riskLevel = finalRisk >= 0.75 ? "HIGH" : finalRisk >= 0.5 ? "MEDIUM" : "LOW";

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

    /** Returns null if result is missing, otherwise calculates Parkinson's risk. */
    private Double getConf(Map<String, Object> result) {
        if (result == null || !result.containsKey("confidence")) return null;

        double confidence = ((Number) result.get("confidence")).doubleValue();
        int prediction = result.containsKey("prediction") ? ((Number) result.get("prediction")).intValue() : -1;

        if (prediction == 1) return confidence;
        if (prediction == 0) return 1.0 - confidence;
        return 0.0; // Error state, but non-null to indicate attempt
    }
}