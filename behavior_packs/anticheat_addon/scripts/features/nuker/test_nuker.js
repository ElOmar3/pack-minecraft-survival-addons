import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { NukerSessionWindow } from './NukerSessionWindow.js';
import { BulkBreakAuthorizationRegistry } from './BulkBreakAuthorizationRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fixtures = JSON.parse(fs.readFileSync(join(__dirname, 'fixtures_nuker.json'), 'utf-8'));

function runTests() {
    console.log("Running Nuker tests in Shadow Mode...");
    let passed = 0;
    let failed = 0;
    
    const authRegistry = new BulkBreakAuthorizationRegistry();
    const sessionWindow = new NukerSessionWindow(authRegistry);
    
    console.log("Testing TOUCH_TO_PC_EFFICIENCY_MINING_LEGITIMATE");
    let result1;
    for (const event of fixtures.TOUCH_TO_PC_EFFICIENCY_MINING_LEGITIMATE) {
        result1 = sessionWindow.processBreakEvent(event);
    }
    if (result1.flag === "NONE" && result1.shadowMode === true) {
        passed++;
    } else {
        console.error("Failed test 1:", result1);
        failed++;
    }
    
    console.log("Testing AUTHORIZED_VEIN_MINER_LEGITIMATE");
    authRegistry.authorize("Alex", 5000);
    let result2;
    for (const event of fixtures.AUTHORIZED_VEIN_MINER_LEGITIMATE) {
        result2 = sessionWindow.processBreakEvent(event);
    }
    if (result2.flag === "LEGITIMATE_BULK_BREAK" && result2.shadowMode === true) {
        passed++;
    } else {
        console.error("Failed test 2:", result2);
        failed++;
    }
    
    console.log("Testing HUMANIZED_RADIUS_NUKER");
    let result3;
    for (const event of fixtures.HUMANIZED_RADIUS_NUKER) {
        result3 = sessionWindow.processBreakEvent(event);
    }
    if (result3.flag === "NUKER_RADIUS" && result3.shadowMode === true) {
        passed++;
    } else {
        console.error("Failed test 3:", result3);
        failed++;
    }
    
    console.log(`\nTests completed: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

runTests();
