export class BlockBreakGeometryExtractor {
    static evaluateGeometry(playerPos, blockPos, playerRotation) {
        const dx = blockPos.x - playerPos.x;
        const dy = blockPos.y - playerPos.y;
        const dz = blockPos.z - playerPos.z;
        const distanceSq = dx*dx + dy*dy + dz*dz;
        
        const inReach = distanceSq <= 36; 
        
        const inFOV = true; 

        return {
            distanceSq,
            inReach,
            inFOV
        };
    }
}
