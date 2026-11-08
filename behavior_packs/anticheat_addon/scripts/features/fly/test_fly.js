import { FlyFeatureExtractor } from './FlyFeatureExtractor.js';
import * as fs from 'fs';
import * as path from 'path';

function runTests() {
    const fixturesRaw = fs.readFileSync('./fixtures_fly.json', 'utf-8');
    const fixtures = JSON.parse(fixturesRaw);

    let allPassed = true;

    console.log('Testing TOUCH_TO_PC_LEGITIMATE_ELYTRA');
    const elytraFeatures = FlyFeatureExtractor.extractFeatures(fixtures.TOUCH_TO_PC_LEGITIMATE_ELYTRA);
    if (elytraFeatures.threatModels.length !== 0) {
        console.error('FAILED: TOUCH_TO_PC_LEGITIMATE_ELYTRA should have 0 threat models.');
        allPassed = false;
    } else {
        console.log('PASSED: TOUCH_TO_PC_LEGITIMATE_ELYTRA');
    }

    console.log('Testing EDGE_SUPPORT_AIRWALK_FALSE_POSITIVE');
    const edgeFeatures = FlyFeatureExtractor.extractFeatures(fixtures.EDGE_SUPPORT_AIRWALK_FALSE_POSITIVE);
    if (edgeFeatures.threatModels.length !== 0) {
        console.error('FAILED: EDGE_SUPPORT_AIRWALK_FALSE_POSITIVE should have 0 threat models.');
        allPassed = false;
    } else {
        console.log('PASSED: EDGE_SUPPORT_AIRWALK_FALSE_POSITIVE');
    }

    console.log('Testing HUMANIZED_PULSE_FLY');
    const pulseFeatures = FlyFeatureExtractor.extractFeatures(fixtures.HUMANIZED_PULSE_FLY);
    if (!pulseFeatures.threatModels.includes("PULSE_FLY") && !pulseFeatures.threatModels.includes("GRAVITY_BYPASS")) {
        console.error('FAILED: HUMANIZED_PULSE_FLY should detect PULSE_FLY or GRAVITY_BYPASS.', pulseFeatures.threatModels);
        allPassed = false;
    } else {
        console.log('PASSED: HUMANIZED_PULSE_FLY');
    }

    if (allPassed) {
        console.log('All fly tests passed!');
        process.exit(0);
    } else {
        console.error('Some tests failed.');
        process.exit(1);
    }
}

runTests();
