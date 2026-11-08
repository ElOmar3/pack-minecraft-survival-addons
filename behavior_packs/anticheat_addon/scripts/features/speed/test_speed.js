import { SpeedFeatureExtractor } from './SpeedFeatureExtractor.js';
import { BunnyHopFeatureExtractor } from './BunnyHopFeatureExtractor.js';
import { MovementAuthorizationRegistry } from './MovementAuthorizationRegistry.js';
import { MovementSessionWindow } from './MovementSessionWindow.js';
import * as fs from 'fs';

function runTests() {
    const authRegistry = new MovementAuthorizationRegistry();
    const windowManager = new MovementSessionWindow();
    const speedExtractor = new SpeedFeatureExtractor(authRegistry, windowManager);
    const bhopExtractor = new BunnyHopFeatureExtractor(windowManager);
    
    const fixturesPath = new URL('./fixtures_speed.json', import.meta.url).pathname;
    const fixturesStr = fs.readFileSync(fixturesPath, 'utf8');
    const fixtures = JSON.parse(fixturesStr);
    
    let passed = 0;
    let total = fixtures.length;
    let failed = false;
    
    fixtures.forEach((fixture, index) => {
        let speedResult, bhopResult;
        const playerId = "test_player_" + index;
        
        fixture.ticks.forEach(tick => {
            speedResult = speedExtractor.analyze(
                playerId, 
                tick.oldPos, 
                tick.newPos, 
                tick.deltaTime, 
                tick.playerState, 
                tick.blockUnderneath, 
                tick.inputContext
            );
            bhopResult = bhopExtractor.analyze(playerId, tick.playerState);
        });
        
        const expectedSpeedThreat = fixture.expected.speedThreatModel || "NONE";
        const expectedBhopThreat = fixture.expected.bhopThreatModel || "NONE";
        
        const speedMatches = speedResult.speed.threatModel === expectedSpeedThreat;
        const bhopMatches = bhopResult.bunnyHop.threatModel === expectedBhopThreat;
        const isShadowMode = speedResult.speed.shadowMode === true && bhopResult.bunnyHop.shadowMode === true;
        
        if (speedMatches && bhopMatches && isShadowMode) {
            console.log(`Test ${fixture.name}: PASSED`);
            passed++;
        } else {
            console.error(`Test ${fixture.name}: FAILED`);
            console.error(`  Expected Speed Threat: ${expectedSpeedThreat}, Got: ${speedResult.speed.threatModel}`);
            console.error(`  Expected Bhop Threat: ${expectedBhopThreat}, Got: ${bhopResult.bunnyHop.threatModel}`);
            console.error(`  Expected ShadowMode: true, Got: ${speedResult.speed.shadowMode} / ${bhopResult.bunnyHop.shadowMode}`);
            failed = true;
        }
    });
    
    console.log(`\nResults: ${passed}/${total} passed.`);
    if (failed) {
        process.exit(1);
    }
}

runTests();
