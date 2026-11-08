import { ErrorReporter } from "../ErrorReporter.js";
import { EvidenceAggregator } from './EvidenceAggregator.js';
import { EvidencePacketBuilder } from './EvidencePacketBuilder.js';
import { GemmaIntelligenceProvider } from './GemmaIntelligenceProvider.js';
import { FusionEngine } from './FusionEngine.js';
import { PolicyEngine } from './PolicyEngine.js';

async function runTest() {
    console.log("Starting Gemma Architecture Pipeline Test...");

    const aggregator = new EvidenceAggregator();
    const packetBuilder = new EvidencePacketBuilder();
    const gemmaProvider = new GemmaIntelligenceProvider();
    const fusionEngine = new FusionEngine();
    const policyEngine = new PolicyEngine({ shadowMode: true });

    const playerId = "player_123";

    // Simulate events
    for (let i = 0; i < 15; i++) {
        aggregator.addEvent(playerId, { type: "attack", data: { distance: 4.5 } });
    }

    const windows = aggregator.getWindows(playerId);
    console.log(`Aggregated ${windows.short.length} events in short window.`);

    // Build packet
    const packet = packetBuilder.build(
        playerId, 
        windows.short, 
        { serverTick: 1000 }, 
        { os: "windows", ping: 45 }
    );
    console.log("Packet Built:", JSON.stringify(packet, null, 2).substring(0, 200) + "...");

    try {
        console.log("Sending to Gemma Intelligence Provider...");
        const gemmaResult = await gemmaProvider.analyze(packet);
        console.log("Gemma Result:", gemmaResult);

        const rawScore = 0.7; // mock raw detector score
        const fusionResult = fusionEngine.evaluate(playerId, rawScore, 45, packet.device_profile, gemmaResult);
        console.log("Fusion Engine Result:", fusionResult);

        const policyDecision = policyEngine.decideAction(fusionResult);
        console.log("Policy Engine Decision:", policyDecision);
        
        if (policyDecision.shadowMode !== true) {
            throw new Error("Shadow mode is not enforced!");
        }

        console.log("Pipeline test passed successfully.");
    } catch (err) { ErrorReporter.report(err, { addonId: "anticheat_addon", moduleId: "test_pipeline.js", operation: "try-catch", category: "runtime" });
        console.error("Pipeline test failed:", err);
        process.exit(1);
    }
}

runTest();
