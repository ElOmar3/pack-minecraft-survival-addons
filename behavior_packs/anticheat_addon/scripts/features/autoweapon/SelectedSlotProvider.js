export class SelectedSlotProvider {
    constructor() {
        this.fingerprintCache = new Map();
    }
    
    getSlotFingerprint(slot, itemType, tick) {
        const key = `${slot}_${itemType}`;
        if (!this.fingerprintCache.has(key)) {
            this.fingerprintCache.set(key, { slot, itemType, firstSeen: tick });
        }
        return this.fingerprintCache.get(key);
    }
    
    getCurrentSlot(playerTelemetry) {
        return playerTelemetry.selectedSlot || 0;
    }
}
