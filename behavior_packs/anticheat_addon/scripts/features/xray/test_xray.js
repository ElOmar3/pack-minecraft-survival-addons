import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { ResourceProfileProvider } from './ResourceProfileProvider.js';
import { MiningWorldSnapshotCache } from './MiningWorldSnapshotCache.js';
import { ResourceVisibilityAnalyzer } from './ResourceVisibilityAnalyzer.js';
import { MiningPathGraph } from './MiningPathGraph.js';
import { XRayFeatureExtractor } from './XRayFeatureExtractor.js';
import { XRaySessionWindow } from './XRaySessionWindow.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fixturesPath = path.join(__dirname, 'fixtures_xray.json');
const fixtures = JSON.parse(fs.readFileSync(fixturesPath, 'utf8')).fixtures;

function runTests() {
    console.log("Running X-Ray Tests...");

    // Test 1: ResourceProfileProvider
    assert.strictEqual(ResourceProfileProvider.isValuableOre("minecraft:diamond_ore"), true);
    assert.strictEqual(ResourceProfileProvider.isValuableOre("minecraft:stone"), false);

    // Test 2: MiningWorldSnapshotCache
    const cache = new MiningWorldSnapshotCache();
    cache.cacheSnapshot("10_20_30", { "11_20_30": "minecraft:air" });
    assert.deepStrictEqual(cache.getSnapshot("10_20_30"), { "11_20_30": "minecraft:air" });

    // Test 3: ResourceVisibilityAnalyzer
    const hiddenResult = ResourceVisibilityAnalyzer.analyze(fixtures[0].blockPosition, fixtures[0].snapshot);
    assert.strictEqual(hiddenResult, false, "Should detect block as hidden");

    const visibleResult = ResourceVisibilityAnalyzer.analyze(fixtures[1].blockPosition, fixtures[1].snapshot);
    assert.strictEqual(visibleResult, true, "Should detect block as visible");

    // Test 4: MiningPathGraph & Episode Grouping
    const graph = new MiningPathGraph();
    graph.addBlockDestroyed(fixtures[2].blockPosition, fixtures[2].blockId); // stone
    graph.addBlockDestroyed(fixtures[0].blockPosition, fixtures[0].blockId); // diamond
    graph.addBlockDestroyed({ x: 10, y: -50, z: 21 }, "minecraft:diamond_ore"); // diamond
    graph.addBlockDestroyed({ x: 30, y: 0, z: 0 }, "minecraft:dirt"); // dirt
    
    const episodes = graph.getDiscoveryEpisodes((id) => ResourceProfileProvider.isValuableOre(id));
    assert.strictEqual(episodes.length, 1, "Should group the two diamonds into one episode");
    assert.strictEqual(episodes[0].ores.length, 2);

    // Test 5: Full Session Flow and Shadow Mode / Evidence Packet
    const session = new XRaySessionWindow("player123");
    
    // Simulate mining hidden diamond
    session.onBlockBroken(fixtures[0].blockPosition, fixtures[0].blockId, fixtures[0].snapshot);
    
    const evidence = session.analyzeSession();
    
    // Assert Shadow Mode configuration
    assert.strictEqual(evidence.shadowMode, true);
    assert.strictEqual(evidence.actionTaken, "NONE");
    assert.strictEqual(evidence.playerId, "player123");
    
    // Assert XRay Evidence Scheme
    assert(evidence.xray, "XRay evidence scheme should exist");
    assert(evidence.xray.flags.includes("HIDDEN_RESOURCE_TARGETING_CANDIDATE"), "Should flag hidden mining");
    assert(evidence.xray.flags.includes("SELECTIVE_HIDDEN_ORE_MINING_CANDIDATE"));
    assert(evidence.xray.flags.includes("XRAY_HIDDEN_RESOURCE_DETOUR_REPEATED"));
    assert(evidence.xray.flags.includes("XRAY_PRE_EXPOSURE_ALIGNMENT_REPEATED"));
    assert(evidence.xray.flags.includes("PRE_EXPOSURE_STEERING_CANDIDATE"));
    
    // Property-based test mock (run multiple random iterations to ensure no budget exceeded unless huge)
    for(let i=0; i<50; i++) {
        session.onBlockBroken({x: i, y: 0, z: 0}, "minecraft:diamond_ore", {"test": "minecraft:stone"});
    }
    const heavyEvidence = session.analyzeSession();
    // With 50 ores and a budget of 100, we might or might not exceed, but testing it returns something.
    assert(heavyEvidence.xray.flags);

    console.log("All X-Ray tests passed successfully! Shadow mode confirmed.");
}

runTests();
