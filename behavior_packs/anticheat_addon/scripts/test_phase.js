import { ErrorReporter } from "./ErrorReporter.js";
const fs = require('fs');
const path = require('path');
const { PhaseStateMachine } = require('./features/phase/PhaseStateMachine.js');
const { SafeWorldCollisionProvider } = require('./features/phase/SafeWorldCollisionProvider.js');
const { PhaseAuthorizationRegistry } = require('./features/phase/PhaseAuthorizationRegistry.js');
const { WorldChangeRegistry } = require('./features/phase/WorldChangeRegistry.js');
const assert = require('assert');

function runTests() {
    const fixturesPath = path.join(__dirname, 'features/phase/fixtures_phase.json');
    const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8'));

    let totalTests = 0;
    let passedTests = 0;

    for (const [testName, fixture] of Object.entries(fixtures)) {
        totalTests++;
        console.log(`Running test: ${testName}`);
        
        const worldProvider = new SafeWorldCollisionProvider(fixture.world);
        const authRegistry = new PhaseAuthorizationRegistry();
        const worldChanges = new WorldChangeRegistry();
        
        const stateMachine = new PhaseStateMachine(worldProvider, authRegistry, worldChanges);
        let violationEvent = null;

        for (const step of fixture.sequence) {
            if (step.authorized) {
                authRegistry.authorize("player1", step.authorized, 1000);
            }
            
            const event = stateMachine.update("player1", step.pos, step.stance, step.inputMethod);
            if (event) {
                violationEvent = event;
            }
            
            // Advance time manually or conceptually if we were fully mocking Date.now
        }

        try {
            if (fixture.expectedViolation) {
                assert.ok(violationEvent !== null, `Expected a violation but got none in ${testName}`);
                assert.strictEqual(violationEvent.shadowMode, true, "Must be in shadow mode");
                assert.strictEqual(violationEvent.actionTaken, "NONE", "Must take no action");
                assert.strictEqual(violationEvent.threatModel, fixture.expectedThreatModel, `Expected threat model ${fixture.expectedThreatModel}`);
            } else {
                assert.ok(violationEvent === null, `Expected no violation but got one in ${testName}`);
            }
            console.log(`✅ ${testName} passed`);
            passedTests++;
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "test_phase.js", operation: "try-catch", category: "runtime" });
            console.error(`❌ ${testName} failed: ${e.message}`);
        }
    }

    console.log(`\nTests completed: ${passedTests}/${totalTests} passed.`);
    if (passedTests !== totalTests) {
        process.exit(1);
    }
}

runTests();
