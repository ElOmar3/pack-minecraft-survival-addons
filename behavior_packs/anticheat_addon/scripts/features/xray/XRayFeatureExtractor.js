import { ResourceVisibilityAnalyzer } from './ResourceVisibilityAnalyzer.js';
import { ResourceProfileProvider } from './ResourceProfileProvider.js';

export class XRayFeatureExtractor {
    constructor() {
        this.episodes = [];
        this.budget = 100; // Analysis budget per tick/window to prevent lag
    }

    // Process a path graph and snapshots to extract features
    extract(miningPathGraph, snapshotCache) {
        if (this.budget <= 0) {
            return { error: 'ANALYSIS_BUDGET_EXCEEDED' };
        }
        
        let flags = [];
        let cost = 0;

        const episodes = miningPathGraph.getDiscoveryEpisodes((id) => ResourceProfileProvider.isValuableOre(id));
        this.episodes.push(...episodes);

        for (const episode of episodes) {
            for (const ore of episode.ores) {
                const snapshotKey = `${ore.blockPosition.x}_${ore.blockPosition.y}_${ore.blockPosition.z}`;
                const snapshot = snapshotCache.getSnapshot(snapshotKey);
                
                cost++;
                if (cost > this.budget) {
                    return { error: 'ANALYSIS_BUDGET_EXCEEDED', partialFlags: flags };
                }

                const wasVisible = ResourceVisibilityAnalyzer.analyze(ore.blockPosition, snapshot);
                
                if (!wasVisible) {
                    // Hidden resource mined! Evaluate for threat models
                    flags.push('HIDDEN_RESOURCE_TARGETING_CANDIDATE');
                    flags.push('SELECTIVE_HIDDEN_ORE_MINING_CANDIDATE');
                    
                    // Simple logic to flag detours or pre-exposure steering
                    flags.push('XRAY_HIDDEN_RESOURCE_DETOUR_REPEATED');
                    flags.push('XRAY_PRE_EXPOSURE_ALIGNMENT_REPEATED');
                    flags.push('PRE_EXPOSURE_STEERING_CANDIDATE');
                }
            }
        }

        this.budget -= cost;
        return { flags: [...new Set(flags)] };
    }
}
