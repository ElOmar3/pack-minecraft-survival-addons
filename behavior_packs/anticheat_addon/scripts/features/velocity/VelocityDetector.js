import { KnockbackResponseFeatureExtractor } from "./KnockbackResponseFeatureExtractor.js";
import { KnockbackRulesetProvider } from "./KnockbackRulesetProvider.js";

export class VelocityDetector {
    constructor() {
        this.extractor = new KnockbackResponseFeatureExtractor();
        this.ruleset = new KnockbackRulesetProvider();
    }
    
    analyze(episode, entity, constraints) {
        const features = this.extractor.extract(episode);
        if (!features) return { shadowMode: true, actionTaken: "NONE", evidence: null };
        
        const expected = this.ruleset.getExpectedEnvelope(episode.impactEvent.type, episode.impactEvent.knockbackAmount, entity.knockbackResistance || 0);
        
        let threatModel = null;
        
        if (constraints.touchingWall || constraints.touchingCeiling) {
            // Legit constraints might reduce KB
            return { shadowMode: true, actionTaken: "NONE", evidence: null };
        }
        
        if (features.maxHorizontalDelta < expected.minHorizontal * 0.1 && features.maxVerticalDelta < expected.minVertical * 0.1) {
            threatModel = "ANTI_KB_COMPLETE";
        } else if (features.maxHorizontalDelta < expected.minHorizontal * 0.5 && features.maxVerticalDelta > expected.minVertical * 0.8) {
            threatModel = "ANTI_KB_HORIZONTAL";
        } else if (features.maxVerticalDelta < expected.minVertical * 0.5 && features.maxHorizontalDelta > expected.minHorizontal * 0.8) {
            threatModel = "ANTI_KB_VERTICAL";
        } else if (features.maxHorizontalDelta < expected.minHorizontal * 0.8 || features.maxVerticalDelta < expected.minVertical * 0.8) {
            threatModel = "ANTI_KB_PARTIAL";
        }
        
        if (features.delayMs > 200) {
            threatModel = "DELAYED";
        }
        
        if (threatModel) {
            return {
                shadowMode: true,
                actionTaken: "NONE",
                evidence: {
                    antiKnockback: {
                        threatModel: threatModel,
                        expected: expected,
                        actual: features
                    }
                }
            };
        }
        
        return { shadowMode: true, actionTaken: "NONE", evidence: null };
    }
}
