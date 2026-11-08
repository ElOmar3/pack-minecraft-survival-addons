import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ScaffoldPlacementEventProvider } from './ScaffoldPlacementEventProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadFixtures() {
    const data = fs.readFileSync(path.join(__dirname, 'fixtures_scaffold.json'), 'utf-8');
    return JSON.parse(data);
}

function runTests() {
    const fixtures = loadFixtures();
    let passed = 0;
    let failed = 0;

    for (const [testName, events] of Object.entries(fixtures)) {
        const provider = new ScaffoldPlacementEventProvider();
        
        events.forEach(ev => provider.onPlayerPlaceBlock(ev));
        
        const results = provider.evaluateClosedSessions(3000);
        
        if (results.length !== 1) {
            console.error(`❌ ${testName}: Expected 1 session, got ${results.length}`);
            failed++;
            continue;
        }

        const result = results[0];
        
        if (!result.enforcement.shadowMode || result.enforcement.actionTaken !== "NONE") {
            console.error(`❌ ${testName}: Shadow mode violated`);
            failed++;
            continue;
        }

        const expectedThreats = {
            "TOUCH_HOLD_BRIDGE_LEGITIMATE": "LEGITIMATE_FAST_BUILDING",
            "PC_FAST_BRIDGE_LEGITIMATE": "LEGITIMATE_FAST_BUILDING",
            "HUMANIZED_SCAFFOLD_EXPAND": "SCAFFOLD_HUMANIZED"
        };
        
        if (result.scaffold.threatModel !== expectedThreats[testName]) {
             console.error(`❌ ${testName}: Expected ${expectedThreats[testName]}, got ${result.scaffold.threatModel}`);
             failed++;
             continue;
        }

        console.log(`✅ ${testName}: Threat Model = ${result.scaffold.threatModel}`);
        passed++;
    }

    console.log(`\nRunning property-based test...`);
    const provider = new ScaffoldPlacementEventProvider();
    for (let i = 0; i < 1000; i++) {
        provider.onPlayerPlaceBlock({
            player: { id: "prop_1", headPos: {x:0, y:0, z:0}, viewVector: {x:0,y:0,z:1} },
            block: { pos: {x: 0, y: i, z: 0} },
            supportFaceNormal: {x:0, y:-1, z:0},
            timestamp: i * 50,
            timeSinceLastRotation: 10
        });
    }
    const results = provider.evaluateClosedSessions(1000 * 50 + 2000);
    const isShadow = results.every(r => r.enforcement.shadowMode && r.enforcement.actionTaken === "NONE");
    if (isShadow && results.length === 1 && results[0].scaffold.threatModel.includes("SCAFFOLD")) {
        console.log(`✅ Property test passed.`);
        passed++;
    } else {
        console.error(`❌ Property test failed. (shadow: ${isShadow}, length: ${results.length})`);
        failed++;
    }

    console.log(`\nTests Completed. Passed: ${passed}, Failed: ${failed}`);
    if (failed > 0) process.exit(1);
}

runTests();
