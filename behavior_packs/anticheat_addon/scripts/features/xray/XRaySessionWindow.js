import { MiningPathGraph } from './MiningPathGraph.js';
import { MiningWorldSnapshotCache } from './MiningWorldSnapshotCache.js';
import { XRayFeatureExtractor } from './XRayFeatureExtractor.js';

export class XRaySessionWindow {
    constructor(playerId) {
        this.playerId = playerId;
        this.shadowMode = true;
        this.actionTaken = "NONE";
        
        this.pathGraph = new MiningPathGraph();
        this.snapshotCache = new MiningWorldSnapshotCache();
        this.extractor = new XRayFeatureExtractor();
    }

    onBlockBroken(blockPosition, blockId, localSnapshot) {
        // Only accept if we have budget/shadow mode enabled
        if (!this.shadowMode) return;

        this.pathGraph.addBlockDestroyed(blockPosition, blockId);
        
        const snapshotKey = `${blockPosition.x}_${blockPosition.y}_${blockPosition.z}`;
        this.snapshotCache.cacheSnapshot(snapshotKey, localSnapshot);
    }

    analyzeSession() {
        const result = this.extractor.extract(this.pathGraph, this.snapshotCache);
        
        // Evidence packet scheme update
        const evidencePacket = {
            playerId: this.playerId,
            actionTaken: this.actionTaken,
            shadowMode: this.shadowMode,
            xray: {
                flags: result.flags || [],
                episodesCount: this.extractor.episodes.length,
                budgetExceeded: result.error === 'ANALYSIS_BUDGET_EXCEEDED'
            }
        };

        return evidencePacket;
    }
}
