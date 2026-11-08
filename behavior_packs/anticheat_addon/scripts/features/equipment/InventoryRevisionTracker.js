export class InventoryRevisionTracker {
    constructor() {
        this.snapshots = new Map(); // playerId -> { tick, inventory: { slot: itemId, ... } }
    }

    updateSnapshot(playerId, currentTick, inventoryMap) {
        const lastSnapshot = this.snapshots.get(playerId) || { tick: 0, inventory: {} };
        const diff = [];
        
        for (const [slot, item] of Object.entries(inventoryMap)) {
            if (lastSnapshot.inventory[slot] !== item) {
                diff.push({
                    slot,
                    oldItem: lastSnapshot.inventory[slot] || null,
                    newItem: item
                });
            }
        }
        
        this.snapshots.set(playerId, { tick: currentTick, inventory: { ...inventoryMap } });
        
        return {
            lastTick: lastSnapshot.tick,
            currentTick,
            diff
        };
    }
}
