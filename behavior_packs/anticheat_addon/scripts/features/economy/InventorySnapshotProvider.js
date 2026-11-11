import { ErrorReporter } from "../../ErrorReporter.js";
import { system, world } from '@minecraft/server';
import { playerKey } from "../../Identity.js";

const HIGH_RISK_DELTA_LIMITS = new Map([
    ["minecraft:dragon_egg", 1],
    ["minecraft:netherite_block", 1],
    ["minecraft:netherite_ingot", 4],
    ["minecraft:trident", 1],
    ["minecraft:elytra", 1],
    ["minecraft:totem_of_undying", 4],
    ["minecraft:enchanted_golden_apple", 8],
    ["minecraft:netherite_upgrade_smithing_template", 1]
]);
const DEFAULT_SUSPICIOUS_DELTA = 2304;
export class InventorySnapshotProvider {
    constructor(economyDetector) {
        this.detector = economyDetector;
        this.snapshots = new Map(); // playerId -> snapshot data
        this.isPolling = false;
    }

    startPolling(intervalTicks = 100) {
        if (this.isPolling) return;
        this.isPolling = true;
        this.pollId = system.runInterval(() => {
            this.pollAllInventories();
        }, intervalTicks);
    }

    stopPolling() {
        if (this.pollId) {
            system.clearRun(this.pollId);
            this.pollId = null;
        }
        this.isPolling = false;
    }

    pollAllInventories() {
        try {
            for (const player of world.getAllPlayers()) {
                const invComp = player.getComponent("minecraft:inventory");
                if (!invComp || !invComp.container) continue;
                const container = invComp.container;
                let assets = [];
                for (let i = 0; i < container.size; i++) {
                    const item = container.getItem(i);
                    if (item) {
                        assets.push({ id: item.typeId, amount: item.amount });
                    }
                }
                this.takeSnapshot(playerKey(player), assets, player.name);
            }
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "InventorySnapshotProvider.js", operation: "try-catch", category: "runtime" });
            console.warn("[Economy] Error in pollAllInventories: " + e);
        }
    }
    
    takeSnapshot(playerId, inventoryAssets, displayName = playerId) {
        const hash = this._hashAssets(inventoryAssets);
        const previousSnapshot = this.snapshots.get(playerId);
        
        if (previousSnapshot) {
            this.compareSnapshots(playerId, previousSnapshot.assets, inventoryAssets, displayName);
        }
        
        this.snapshots.set(playerId, { hash, assets: [...inventoryAssets], timestamp: Date.now() });
    }

    clear(playerId) {
        this.snapshots.delete(playerId);
    }
    
    compareSnapshots(playerId, oldAssets, newAssets, displayName = playerId) {
        const oldCount = {};
        for (const item of oldAssets) {
            oldCount[item.id] = (oldCount[item.id] || 0) + item.amount;
        }
        
        const newCount = {};
        for (const item of newAssets) {
            newCount[item.id] = (newCount[item.id] || 0) + item.amount;
        }
        
        // Detect unexplained positive deltas (Dupe)
        for (const [id, count] of Object.entries(newCount)) {
            const oldAmount = oldCount[id] || 0;
            const delta = count - oldAmount;
            const threshold = HIGH_RISK_DELTA_LIMITS.get(id) ?? DEFAULT_SUSPICIOUS_DELTA;
            if (delta >= threshold) {
                this.detector.reportDiscrepancy('Unexplained Positive Delta', {
                    playerId,
                    playerName: displayName,
                    assetId: id,
                    delta,
                    threshold
                });
            }
        }

        // Potential rollback divergence check would also compare lost assets with global state, 
        // but simplified here for demonstration.
    }

    _hashAssets(assets) {
        return assets.map(a => `${a.id}:${a.amount}`).sort().join('|');
    }
}
