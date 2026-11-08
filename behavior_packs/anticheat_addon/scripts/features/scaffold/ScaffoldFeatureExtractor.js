export class ScaffoldFeatureExtractor {
    static extract(sessionWindow) {
        const chainFeatures = sessionWindow.supportChain.buildChainFeatures();
        
        let silentPlaceSuspicion = 0;
        let autoBlockSuspicion = 0;
        let rotationInjectionSuspicion = 0;
        let isHumanized = false;
        
        for (const placement of sessionWindow.placements) {
            // Perfect alignment means view vector is opposite to face normal (dot = -1)
            // If dot > -0.2, they are not looking towards the face.
            if (placement.geometry.alignmentDot > -0.2) {
                // Not looking at the face -> Silent Place / AutoBlock
                silentPlaceSuspicion += 1;
            }
            if (placement.timeSinceLastRotation < 50 && placement.timeSinceLastRotation > 0) {
                // Very quick rotation -> Rotation Injection
                rotationInjectionSuspicion += 1;
            }
        }
        
        let avgPlacementDelay = 0;
        if (sessionWindow.placements.length > 1) {
            const firstT = sessionWindow.placements[0].timestamp;
            const lastT = sessionWindow.placements[sessionWindow.placements.length-1].timestamp;
            avgPlacementDelay = (lastT - firstT) / (sessionWindow.placements.length - 1);
        }
        
        if (avgPlacementDelay > 150 && avgPlacementDelay < 350) {
            isHumanized = true;
        }

        const model = chainFeatures?.isTower ? "SCAFFOLD_TOWER" :
                      chainFeatures?.isBridge ? "SCAFFOLD_BRIDGE" : "SCAFFOLD_EXPAND";

        let threatModel = model;
        if (silentPlaceSuspicion > 2) threatModel = "SCAFFOLD_SILENT_PLACE";
        else if (autoBlockSuspicion > 2) threatModel = "SCAFFOLD_AUTO_BLOCK";
        else if (rotationInjectionSuspicion > 2) threatModel = "SCAFFOLD_ROTATION_INJECTION";
        else if (silentPlaceSuspicion === 0) {
            threatModel = avgPlacementDelay < 350 ? "LEGITIMATE_FAST_BUILDING" : "LEGITIMATE_BUILDING";
        }
        
        // Handling HUMANIZED SCAFFOLD EXPAND
        if (isHumanized && silentPlaceSuspicion > 0) {
            threatModel = "SCAFFOLD_HUMANIZED";
        }

        return {
            threatModel,
            isHumanized,
            avgPlacementDelay,
            silentPlaceSuspicion
        };
    }
}
