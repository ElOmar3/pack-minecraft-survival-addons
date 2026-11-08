export class NukerSpatialWindow {
    constructor() {
        this.recentBreaks = [];
    }
    
    addBreak(x, y, z, timestamp) {
        this.recentBreaks.push({ x, y, z, timestamp });
        this.cleanUp(timestamp);
    }
    
    cleanUp(currentTimestamp) {
        this.recentBreaks = this.recentBreaks.filter(b => currentTimestamp - b.timestamp <= 2000);
    }
    
    classifyPattern() {
        if (this.recentBreaks.length < 60) return "NONE";
        
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        let minZ = Infinity, maxZ = -Infinity;
        
        for (const b of this.recentBreaks) {
            minX = Math.min(minX, b.x);
            maxX = Math.max(maxX, b.x);
            minY = Math.min(minY, b.y);
            maxY = Math.max(maxY, b.y);
            minZ = Math.min(minZ, b.z);
            maxZ = Math.max(maxZ, b.z);
        }
        
        const dx = maxX - minX;
        const dy = maxY - minY;
        const dz = maxZ - minZ;
        
        if (dx > 0 && dy > 0 && dz > 0 && dx < 3 && dy < 3 && dz < 3) return "RADIUS";
        if ((dx > 3 && dy < 2 && dz < 2) || (dz > 3 && dx < 2 && dy < 2)) return "TUNNEL";
        if (dx > 3 && dz > 3 && dy < 2) return "LAYER";
        
        return "MULTI_BLOCK";
    }
}
