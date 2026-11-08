import assert from "assert";
import fs from "fs";
import { VelocityDetector } from "./VelocityDetector.js";
import { KnockbackEpisode } from "./KnockbackEpisode.js";

function runTests() {
    console.log("Running velocity tests...");
    const detector = new VelocityDetector();
    const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures_velocity.json', import.meta.url)));
    
    for (const fixture of fixtures) {
        const episode = new KnockbackEpisode(fixture.impactEvent);
        episode.preState = fixture.preState;
        fixture.postStates.forEach(s => episode.addPostState(s));
        
        const result = detector.analyze(episode, fixture.entity, fixture.constraints);
        
        assert.strictEqual(result.shadowMode, true, `Shadow mode should be true for ${fixture.name}`);
        assert.strictEqual(result.actionTaken, "NONE", `Action should be NONE for ${fixture.name}`);
        
        if (fixture.expectedThreat) {
            assert(result.evidence, `Expected evidence for ${fixture.name}`);
            assert.strictEqual(result.evidence.antiKnockback.threatModel, fixture.expectedThreat, `Threat model mismatch for ${fixture.name}`);
        } else {
            assert(!result.evidence, `Expected no evidence for ${fixture.name}`);
        }
        console.log(`Passed: ${fixture.name}`);
    }
    console.log("All velocity tests passed.");
}

runTests();
