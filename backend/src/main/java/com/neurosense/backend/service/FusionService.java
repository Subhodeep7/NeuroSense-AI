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

        // Reaction Time Scoring: healthy baseline ≤400ms → zero risk.
        // Parkinsonian responses typically >500ms.
        // Formula: anything ≤400ms clamps to 0.0; risk rises linearly above 400ms,
        // reaching 1.0 at 750ms (400 + 350).
        double reactionConf = 0.0;
        if (reactionTimeMs != null && reactionTimeMs > 0) {
            reactionConf = Math.min(1.0, Math.max(0.0, (reactionTimeMs - 400.0) / 350.0));
        }

        // Base weights per modality
        double wVoice       = 0.25;
        double wHandwriting = 0.25;
        double wGait        = 0.18;
        double wTremor      = 0.12;
        double wVisual      = 0.12;
        double wReaction    = 0.08;

        // Only count weight for modalities that were actually provided.
        // Without normalization, missing modalities (0 risk, full weight) dilute
        // the score – e.g., voice+handwriting only Parkinson's caps at ~55%.
        double totalWeight = 0.0;
        double weightedSum = 0.0;

        if (voiceResult != null)       { weightedSum += voiceConf       * wVoice;       totalWeight += wVoice; }
        if (handwritingResult != null) { weightedSum += handwritingConf * wHandwriting; totalWeight += wHandwriting; }
        if (gaitResult != null)        { weightedSum += gaitConf        * wGait;        totalWeight += wGait; }
        if (tremorResult != null)      { weightedSum += tremorConf      * wTremor;      totalWeight += wTremor; }
        if (visualResult != null)      { weightedSum += visualConf      * wVisual;      totalWeight += wVisual; }
        if (reactionTimeMs != null && reactionTimeMs > 0) {
            weightedSum += reactionConf * wReaction;
            totalWeight += wReaction;
        }

        double finalRisk = totalWeight > 0 ? weightedSum / totalWeight : 0.0;

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

    /**
     * Extracts the Parkinson's RISK PROBABILITY from a model result map.
     *
     * The Python scripts output:
     *   { "prediction": 0|1, "confidence": <prob of predicted class> }
     *
     * "confidence" = how sure the model is about its own prediction — NOT the
     * probability of Parkinson's.  We need to correct for the direction:
     *
     *   prediction=1 (Parkinson's), confidence=0.85 → risk = 0.85   ✓
     *   prediction=0 (healthy),     confidence=0.85 → risk = 0.15   ✓  (was 0.85 — BUG)
     *   prediction=-1 (model error)                → risk = 0.0
     */
    private double getConf(Map<String, Object> result) {
        if (result == null || !result.containsKey("confidence")) return 0.0;

        double confidence = ((Number) result.get("confidence")).doubleValue();

        int prediction = result.containsKey("prediction")
                ? ((Number) result.get("prediction")).intValue()
                : -1;

        if (prediction == 1) {
            // Model is confident it IS Parkinson's → high risk
            return confidence;
        } else if (prediction == 0) {
            // Model is confident it is HEALTHY → Parkinson's risk is the complement
            return 1.0 - confidence;
        } else {
            // prediction == -1: model error (e.g. file not found, script crash)
            // Treat as no signal (0 risk contribution) so other modalities decide
            return 0.0;
        }
    }
}