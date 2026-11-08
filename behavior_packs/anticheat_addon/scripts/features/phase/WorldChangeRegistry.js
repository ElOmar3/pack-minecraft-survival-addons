class WorldChangeRegistry {
    constructor() {
        this.changes = [];
    }
    
    registerChange(pos, type, timestamp = Date.now()) {
        this.changes.push({ pos, type, timestamp });
        // keep only recent changes
        this.changes = this.changes.filter(c => Date.now() - c.timestamp < 2000);
    }
    
    wasRecentlyChanged(x, y, z) {
        return this.changes.some(c => 
            Math.abs(c.pos.x - x) < 1.5 && 
            Math.abs(c.pos.y - y) < 1.5 && 
            Math.abs(c.pos.z - z) < 1.5
        );
    }
}
export { WorldChangeRegistry  };
