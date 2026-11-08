/**
 * TriggerFeatureExtractor.js
 * 
 * Extracts features for TriggerBot detection.
 * Pure function implementation.
 */

const THREAT_MODELS = {
    ZERO_DELAY_TRIGGER: 'ZERO_DELAY_TRIGGER',
    FIXED_DELAY_TRIGGER: 'FIXED_DELAY_TRIGGER',
    RANDOMIZED_TRIGGER: 'RANDOMIZED_TRIGGER',
    EDGE_TRIGGER: 'EDGE_TRIGGER',
    HUMANIZED_TRIGGER: 'HUMANIZED_TRIGGER',
    HOLD_OR_CONTINUOUS_ATTACK: 'HOLD_OR_CONTINUOUS_ATTACK'
};

const EVIDENCES = {
    TRIGGER_ZERO_DELAY_REPEATED: 'TRIGGER_ZERO_DELAY_REPEATED',
    TRIGGER_FIXED_DELAY_LOW_VARIANCE: 'TRIGGER_FIXED_DELAY_LOW_VARIANCE',
    TRIGGER_ABNORMAL_REACTION_TIME: 'TRIGGER_ABNORMAL_REACTION_TIME'
};

function extractFeatures(events, context) {
    // Implement purely as a function
    let features = {
        shadowMode: true,
        actionTaken: "NONE",
        attackEligible: false,
        timeline: {},
        penetrationRatios: {},
        temporal: {
            median: 0,
            MAD: 0,
            percentiles: {},
            entropy: 0
        },
        evidences: [],
        correlationGroup: `trigger:${context.combatSessionId}:${context.targetId}:${context.timeBucket}`
    };

    // Calculate attack eligibility
    // Must be very strict to avoid false positives (pre-aim, overlaps)
    if (events.length > 0 && context.targetInLineOfSight) {
        features.attackEligible = true;
    } else {
        return features; // Not eligible
    }

    // Timeline of acquisition
    features.timeline.eligibleToAttackDelayTicks = context.attackTick - context.eligibleTick;
    features.timeline.rayEntryToAttackDelayTicks = context.attackTick - context.rayEntryTick;

    // Penetration ratios
    features.penetrationRatios.depth = context.rayHitDepth || 0.0;
    
    // Calculate Temporal features (median, MAD, etc.)
    if (events.length > 2) {
        const delays = events.map(e => e.delay);
        delays.sort((a, b) => a - b);
        
        // Median
        const mid = Math.floor(delays.length / 2);
        features.temporal.median = delays.length % 2 !== 0 ? delays[mid] : (delays[mid - 1] + delays[mid]) / 2;
        
        // MAD
        const absoluteDeviations = delays.map(d => Math.abs(d - features.temporal.median));
        absoluteDeviations.sort((a, b) => a - b);
        const madMid = Math.floor(absoluteDeviations.length / 2);
        features.temporal.MAD = absoluteDeviations.length % 2 !== 0 ? absoluteDeviations[madMid] : (absoluteDeviations[madMid - 1] + absoluteDeviations[madMid]) / 2;
        
        // Entropy approximation (simple)
        let entropy = 0;
        const counts = {};
        for (const d of delays) {
            counts[d] = (counts[d] || 0) + 1;
        }
        for (const k in counts) {
            const p = counts[k] / delays.length;
            entropy -= p * Math.log2(p);
        }
        features.temporal.entropy = entropy;
    }

    // Evidences logic (shadow mode)
    if (features.timeline.eligibleToAttackDelayTicks === 0 && events.length > 3) {
        features.evidences.push(EVIDENCES.TRIGGER_ZERO_DELAY_REPEATED);
    } else if (features.temporal.MAD < 1.0 && events.length > 3) {
        features.evidences.push(EVIDENCES.TRIGGER_FIXED_DELAY_LOW_VARIANCE);
    }

    return features;
}

export {
    extractFeatures,
    THREAT_MODELS,
    EVIDENCES
};
