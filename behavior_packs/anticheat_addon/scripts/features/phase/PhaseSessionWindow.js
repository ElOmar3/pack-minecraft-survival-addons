class PhaseSessionWindow {
    constructor() {
        this.history = [];
        this.inputContextEpoch = 0;
        this.lastInputMethod = null;
    }
    
    addRecord(record) {
        // record has timestamp, pos, aabb, inputMethod, hits, etc.
        if (this.lastInputMethod !== null && record.inputMethod !== this.lastInputMethod) {
            this.inputContextEpoch++;
            // InputContextEpoch changes PC/Touch but we don't wipe history to preserve phase evidence
        }
        this.lastInputMethod = record.inputMethod;
        
        this.history.push({ ...record, epoch: this.inputContextEpoch });
        // Keep last 20 ticks
        if (this.history.length > 20) {
            this.history.shift();
        }
    }
    
    getRecords() {
        return this.history;
    }
}
export { PhaseSessionWindow  };
