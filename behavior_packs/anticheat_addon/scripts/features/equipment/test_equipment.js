import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { InventoryRevisionTracker } from './InventoryRevisionTracker.js';
import { AutoTotemFeatureExtractor } from './AutoTotemFeatureExtractor.js';
import { AutoArmorFeatureExtractor } from './AutoArmorFeatureExtractor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runTests() {
    console.log("Running Equipment Feature Tests...");
    const rawData = fs.readFileSync(join(__dirname, 'fixtures_equipment.json'));
    const fixtures = JSON.parse(rawData);

    let allPassed = true;

    // Test 1: TOUCH_TO_PC_INVENTORY_LEGITIMATE
    {
        const tracker = new InventoryRevisionTracker();
        const totemExtractor = new AutoTotemFeatureExtractor();
        
        let evidence = null;
        for (const step of fixtures["TOUCH_TO_PC_INVENTORY_LEGITIMATE"]) {
            totemExtractor.updateCombatState(step.playerId, step.tick, step.health);
            const rev = tracker.updateSnapshot(step.playerId, step.tick, step.inventory);
            if (rev.lastTick > 0) {
                evidence = totemExtractor.extractFeatures(step.playerId, rev);
            }
        }
        
        if (evidence && evidence.autoTotem.features.includes("INSTANT_REFILL")) {
            console.error("❌ Test 1 Failed: False positive on INSTANT_REFILL");
            allPassed = false;
        } else {
            console.log("✅ Test 1 Passed: TOUCH_TO_PC_INVENTORY_LEGITIMATE");
        }
    }

    // Test 2: INSTANT_REFILL_CANDIDATE
    {
        const tracker = new InventoryRevisionTracker();
        const totemExtractor = new AutoTotemFeatureExtractor();
        
        let evidence = null;
        for (const step of fixtures["INSTANT_REFILL_CANDIDATE"]) {
            totemExtractor.updateCombatState(step.playerId, step.tick, step.health);
            const rev = tracker.updateSnapshot(step.playerId, step.tick, step.inventory);
            if (rev.lastTick > 0) {
                evidence = totemExtractor.extractFeatures(step.playerId, rev);
            }
        }
        
        if (evidence && evidence.autoTotem.features.includes("INSTANT_REFILL") && evidence.autoTotem.features.includes("AUTOTOTEM_LOW_HEALTH_EQUIP")) {
            console.log("✅ Test 2 Passed: INSTANT_REFILL_CANDIDATE");
        } else {
            console.error("❌ Test 2 Failed: Missed INSTANT_REFILL or AUTOTOTEM_LOW_HEALTH_EQUIP");
            allPassed = false;
        }
    }

    // Test 3: MULTI_SLOT_ARMOR_SPOOF
    {
        const tracker = new InventoryRevisionTracker();
        const armorExtractor = new AutoArmorFeatureExtractor();
        
        let evidence = null;
        for (const step of fixtures["MULTI_SLOT_ARMOR_SPOOF"]) {
            if (step.inCombat) armorExtractor.updateCombatState(step.playerId, step.tick);
            const rev = tracker.updateSnapshot(step.playerId, step.tick, step.inventory);
            if (rev.lastTick > 0) {
                evidence = armorExtractor.extractFeatures(step.playerId, rev);
            }
        }
        
        if (evidence && evidence.autoArmor.features.includes("INSTANT_MULTI_SLOT") && evidence.autoArmor.features.includes("AUTOARMOR_COMBAT_TRIGGERED")) {
            console.log("✅ Test 3 Passed: MULTI_SLOT_ARMOR_SPOOF");
        } else {
            console.error("❌ Test 3 Failed: Missed INSTANT_MULTI_SLOT or AUTOARMOR_COMBAT_TRIGGERED");
            allPassed = false;
        }
    }

    if (!allPassed) {
        process.exit(1);
    }
}

runTests();
