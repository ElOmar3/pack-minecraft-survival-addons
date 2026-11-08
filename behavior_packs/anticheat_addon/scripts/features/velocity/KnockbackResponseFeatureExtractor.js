export class KnockbackResponseFeatureExtractor {
    extract(episode) {
        if (!episode.preState || episode.postStates.length === 0) return null;
        let maxHDist = 0;
        let maxVDist = 0;
        for (const state of episode.postStates) {
            const hDist = Math.sqrt(Math.pow(state.x - episode.preState.x, 2) + Math.pow(state.z - episode.preState.z, 2));
            const vDist = Math.abs(state.y - episode.preState.y);
            maxHDist = Math.max(maxHDist, hDist);
            maxVDist = Math.max(maxVDist, vDist);
        }
        return {
            maxHorizontalDelta: maxHDist,
            maxVerticalDelta: maxVDist,
            delayMs: episode.postStates[0].timestamp - episode.impactEvent.timestamp
        };
    }
}
