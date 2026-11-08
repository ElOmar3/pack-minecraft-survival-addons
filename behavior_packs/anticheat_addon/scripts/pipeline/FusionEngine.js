export class FusionEngine {
    constructor(weights = {}) {
        this.weights = {
            rawDetector: weights.rawDetector || 0.3,
            gemmaRisk: weights.gemmaRisk || 0.6,
            latencyPenalty: weights.latencyPenalty || 0.1
        };
    }

    evaluate(playerId, rawDetectorScore, latencyMs, deviceProfile, gemmaResult) {
        let latencyFactor = 0;
        if (latencyMs > 200) {
            latencyFactor = 0.2; 
        }

        const finalScore = 
            (rawDetectorScore * this.weights.rawDetector) + 
            (gemmaResult.risk_score * this.weights.gemmaRisk) -
            (latencyFactor * this.weights.latencyPenalty);

        return {
            playerId: playerId,
            finalScore: Math.max(0, Math.min(1, finalScore)),
            gemmaClassification: gemmaResult.classification,
            gemmaConfidence: gemmaResult.confidence
        };
    }
}
