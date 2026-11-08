import { BlockBreakGeometryExtractor } from './BlockBreakGeometryExtractor.js';
import { BlockBreakRulesetProvider } from './BlockBreakRulesetProvider.js';

export class NukerFeatureExtractor {
    static extract(sessionData, spatialWindow, breakEvent, authRegistry) {
        const isAuth = authRegistry.isAuthorized(breakEvent.player.name);
        if (isAuth) {
            return { flag: "LEGITIMATE_BULK_BREAK", shadowMode: true, actionTaken: "NONE" };
        }
        
        const geom = BlockBreakGeometryExtractor.evaluateGeometry(
            breakEvent.player.location || breakEvent.player.position, 
            breakEvent.block.location || breakEvent.block.position || { x: breakEvent.block.x, y: breakEvent.block.y, z: breakEvent.block.z }, 
            breakEvent.player.getRotation ? breakEvent.player.getRotation() : breakEvent.player.rotation
        );
        
        if (!geom.inReach) {
            return { flag: "OUT_OF_REACH", shadowMode: true, actionTaken: "NONE" };
        }
        
        if (sessionData.lastBreakTime) {
            const timeDiff = breakEvent.timestamp - sessionData.lastBreakTime;
            if (timeDiff < 15) {
                return { flag: "FAST_BREAK", shadowMode: true, actionTaken: "NONE" };
            }
        }
        
        const pattern = spatialWindow.classifyPattern();
        if (pattern === "RADIUS") {
            return { flag: "NUKER_RADIUS", shadowMode: true, actionTaken: "NONE" };
        } else if (pattern !== "NONE") {
            return { flag: pattern, shadowMode: true, actionTaken: "NONE" };
        }
        
        return { flag: "NONE", shadowMode: true, actionTaken: "NONE" };
    }
}
