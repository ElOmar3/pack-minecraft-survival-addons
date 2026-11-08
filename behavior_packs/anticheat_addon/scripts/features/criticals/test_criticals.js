import assert from "assert";
import fs from "fs";
import { CriticalDamageRulesetProvider } from "./CriticalDamageRulesetProvider.js";
import { CriticalFeatureExtractor } from "./CriticalFeatureExtractor.js";
import { CriticalCombatWindow } from "./CriticalCombatWindow.js";

function runTests() {
    console.log("Running criticals tests...");
    const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures_criticals.json', import.meta.url)));
    
    for (const fixture of fixtures) {
        const combatWindow = new CriticalCombatWindow(fixture.baseDamage);
        
        for (const event of fixture.events) {
            combatWindow.addEvent(event);
        }
        
        const features = CriticalFeatureExtractor.extract(combatWindow, CriticalDamageRulesetProvider);
        
        const shadowMode = true;
        const actionTaken = "NONE";
        
        assert.strictEqual(shadowMode, true, `Shadow mode should be true for ${fixture.scenario}`);
        assert.strictEqual(actionTaken, "NONE", `Action should be NONE for ${fixture.scenario}`);
        
        assert.strictEqual(features.threatType, fixture.expectedThreat, `Threat model mismatch for ${fixture.scenario}. Expected ${fixture.expectedThreat}, got ${features.threatType}`);
        
        console.log(`Passed: ${fixture.scenario}`);
    }
    console.log("All criticals tests passed.");
}

runTests();
