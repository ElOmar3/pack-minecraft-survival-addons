const { extractFeatures, THREAT_MODELS, EVIDENCES } = require('./TriggerFeatureExtractor');
const TriggerCombatWindow = require('./TriggerCombatWindow');

// Legitimate Test: Touch Pre-aim
function testTouchPreaimLegitimate() {
    const window = new TriggerCombatWindow('session1', 'target1');
    window.updateContext({
        targetInLineOfSight: true,
        eligibleTick: 100,
        rayEntryTick: 102,
        attackTick: 110,
        rayHitDepth: 0.1,
        inputContextEpoch: "MOBILE"
    });
    
    // Simulate legitimate varied delays
    window.addEvent({ delay: 8 });
    window.addEvent({ delay: 12 });
    window.addEvent({ delay: 9 });
    window.addEvent({ delay: 15 });

    const features = extractFeatures(window.getEvents(), window.getContext());
    
    if (features.attackEligible && features.evidences.length === 0) {
        console.log("✅ TOUCH_PREAIM_LEGITIMATE passed");
    } else {
        console.error("❌ TOUCH_PREAIM_LEGITIMATE failed", features);
    }
}

// Legitimate Test: PC Fast Reaction
function testPCFastReactionLegitimate() {
    const window = new TriggerCombatWindow('session2', 'target2');
    window.updateContext({
        targetInLineOfSight: true,
        eligibleTick: 200,
        rayEntryTick: 201,
        attackTick: 204, // 3 ticks (150ms) reaction, perfectly normal for pro
        rayHitDepth: 0.5,
        inputContextEpoch: "PC"
    });
    
    // Fast but varied
    window.addEvent({ delay: 3 });
    window.addEvent({ delay: 4 });
    window.addEvent({ delay: 3 });
    window.addEvent({ delay: 5 });

    const features = extractFeatures(window.getEvents(), window.getContext());
    
    if (features.attackEligible && !features.evidences.includes(EVIDENCES.TRIGGER_ZERO_DELAY_REPEATED)) {
        console.log("✅ PC_FAST_REACTION_LEGITIMATE passed");
    } else {
        console.error("❌ PC_FAST_REACTION_LEGITIMATE failed", features);
    }
}

// Threat Test: Zero Delay TriggerBot
function testZeroDelayTriggerBot() {
    const window = new TriggerCombatWindow('session3', 'target3');
    window.updateContext({
        targetInLineOfSight: true,
        eligibleTick: 300,
        rayEntryTick: 300,
        attackTick: 300, // 0 ticks delay
        rayHitDepth: 0.9,
        inputContextEpoch: "PC"
    });
    
    // Zero delay repeatedly
    window.addEvent({ delay: 0 });
    window.addEvent({ delay: 0 });
    window.addEvent({ delay: 0 });
    window.addEvent({ delay: 0 });

    const features = extractFeatures(window.getEvents(), window.getContext());
    
    if (features.attackEligible && features.evidences.includes(EVIDENCES.TRIGGER_ZERO_DELAY_REPEATED)) {
        console.log("✅ ZERO_DELAY_TRIGGER passed");
    } else {
        console.error("❌ ZERO_DELAY_TRIGGER failed", features);
    }
}

// Threat Test: Fixed Delay TriggerBot
function testFixedDelayTriggerBot() {
    const window = new TriggerCombatWindow('session4', 'target4');
    window.updateContext({
        targetInLineOfSight: true,
        eligibleTick: 400,
        rayEntryTick: 400,
        attackTick: 405, // 5 ticks delay consistently
        rayHitDepth: 0.7,
        inputContextEpoch: "PC"
    });
    
    // Exactly 5 ticks delay every time
    window.addEvent({ delay: 5 });
    window.addEvent({ delay: 5 });
    window.addEvent({ delay: 5 });
    window.addEvent({ delay: 5 });

    const features = extractFeatures(window.getEvents(), window.getContext());
    
    if (features.attackEligible && features.evidences.includes(EVIDENCES.TRIGGER_FIXED_DELAY_LOW_VARIANCE)) {
        console.log("✅ FIXED_DELAY_TRIGGER passed");
    } else {
        console.error("❌ FIXED_DELAY_TRIGGER failed", features);
    }
}

function runTests() {
    console.log("Running TriggerBot detection tests...");
    testTouchPreaimLegitimate();
    testPCFastReactionLegitimate();
    testZeroDelayTriggerBot();
    testFixedDelayTriggerBot();
}

runTests();
