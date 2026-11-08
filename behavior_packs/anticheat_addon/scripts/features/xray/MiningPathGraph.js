export class MiningPathGraph {
    constructor() {
        this.nodes = [];
    }

    addBlockDestroyed(blockPosition, blockId) {
        this.nodes.push({ blockPosition, blockId, timestamp: Date.now() });
    }

    // Groups valuable connected ores into a single episode
    getDiscoveryEpisodes(isValuableFn) {
        let episodes = [];
        let currentEpisode = [];

        for (let i = 0; i < this.nodes.length; i++) {
            const node = this.nodes[i];
            if (isValuableFn(node.blockId)) {
                currentEpisode.push(node);
            } else {
                if (currentEpisode.length > 0) {
                    episodes.push({ type: "RESOURCE_DISCOVERY_EPISODE", ores: [...currentEpisode] });
                    currentEpisode = [];
                }
            }
        }
        if (currentEpisode.length > 0) {
            episodes.push({ type: "RESOURCE_DISCOVERY_EPISODE", ores: [...currentEpisode] });
        }
        return episodes;
    }
}
