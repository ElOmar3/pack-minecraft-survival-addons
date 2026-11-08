import { extractFeatures, THREAT_MODELS, EVIDENCES } from './features/autoweapon/AutoWeaponFeatureExtractor.js';
import { AutoWeaponCombatWindow } from './features/autoweapon/AutoWeaponCombatWindow.js';
import fs from 'fs';

function runTests() {
    let failed = 0;
    let passed = 0;

    const assert = (condition, message) => {
        if (!condition) {
            console.error(`[FAIL] ${message}`);
            failed++;
        } else {
            passed++;
        }
    };

    console.log("Running AutoWeapon Tests...");

    const fixtures = JSON.parse(fs.readFileSync(new URL('./features/autoweapon/fixtures_auto_weapon.json', import.meta.url)));

    // Test 1: PC_MANUAL_HOTKEY_LEGITIMATE
    let fix1 = fixtures["PC_MANUAL_HOTKEY_LEGITIMATE"];
    let features1 = extractFeatures(fix1.window, fix1.context);
    assert(features1.threatModel === fix1.expectedThreatModel, "PC_MANUAL_HOTKEY_LEGITIMATE should be LEGITIMATE_FAST_SWITCH");

    // Test 2: TOUCH_BUILD_TO_COMBAT_LEGITIMATE
    let fix2 = fixtures["TOUCH_BUILD_TO_COMBAT_LEGITIMATE"];
    let features2 = extractFeatures(fix2.window, fix2.context);
    assert(features2.evidences.length === fix2.expectedEvidences, "TOUCH_BUILD_TO_COMBAT_LEGITIMATE should have 0 evidences");

    // Test 3: HUMANIZED_AUTO_WEAPON_MULTI_TARGET
    let fix3 = fixtures["HUMANIZED_AUTO_WEAPON_MULTI_TARGET"];
    let features3 = extractFeatures(fix3.window, fix3.context);
    assert(features3.threatModel === fix3.expectedThreatModel, "HUMANIZED_AUTO_WEAPON_MULTI_TARGET should match expected model");

    // Test 4: SWITCH_AND_RESTORE (1-tick swap)
    let cw4 = new AutoWeaponCombatWindow();
    cw4.addEvent(99, 'slot_change', { slot: 1 });
    cw4.addEvent(101, 'slot_change', { slot: 0 });
    let ctx4 = { hitTick: 100 };
    let features4 = extractFeatures(cw4.getWindow(100), ctx4);
    assert(features4.threatModel === THREAT_MODELS.SWITCH_AND_RESTORE, "SWITCH_AND_RESTORE should be detected");
    assert(features4.evidences.includes(EVIDENCES.AUTO_WEAPON_ONE_TICK_SWAP), "AUTO_WEAPON_ONE_TICK_SWAP evidence missing");

    // Test 5: Shadow mode adherence
    assert(features4.shadowMode === true, "Must be in shadow mode");
    assert(features4.actionTaken === "NONE", "Action must be NONE");

    console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests();
