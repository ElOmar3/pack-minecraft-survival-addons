const { AimFeatureExtractor } = require('./features/AimFeatureExtractor.js');
const { AimCombatWindow } = require('./features/AimCombatWindow.js');
const fs = require('fs');
const assert = require('assert');

function runTests() {
    const fixtures = JSON.parse(fs.readFileSync('./fixtures.json', 'utf8'));
    
    console.log("Running tests...");
    
    // Test Legitimate Touch to Keyboard
    let window1 = new AimCombatWindow();
    let features1 = AimFeatureExtractor.extract(fixtures.TOUCH_TO_KEYBOARD_LEGITIMATE.state, fixtures.TOUCH_TO_KEYBOARD_LEGITIMATE.dataQuality);
    window1.addInput('Keyboard');
    let evidence1 = window1.evaluate(features1);
    assert.strictEqual(evidence1.length, 0, "Legitimate keyboard aim should not generate evidence");

    // Test Gamepad Smooth Tracking Legitimate
    let window2 = new AimCombatWindow();
    let features2 = AimFeatureExtractor.extract(fixtures.GAMEPAD_SMOOTH_TRACKING_LEGITIMATE.state, fixtures.GAMEPAD_SMOOTH_TRACKING_LEGITIMATE.dataQuality);
    let evidence2 = window2.evaluate(features2);
    assert.strictEqual(evidence2.length, 0, "Legitimate gamepad aim should not generate evidence");

    // Test AimBot
    let window3 = new AimCombatWindow();
    let features3 = {
        aimError: 0.05,
        visibilityToAcquisitionTicks: 2,
        trackingGain: 1.0,
        aimErrorVariance: 0.01
    };
    let evidence3 = window3.evaluate(features3);
    assert.strictEqual(evidence3.length, 2, "AimBot should generate evidence");
    assert.strictEqual(evidence3[0].shadowMode, true, "Must be in shadow mode");
    assert.strictEqual(evidence3[0].actionTaken, "NONE", "No action should be taken");

    console.log("All tests passed successfully.");
}

runTests();
