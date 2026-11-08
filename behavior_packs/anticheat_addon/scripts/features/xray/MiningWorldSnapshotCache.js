// Extremely simplified cache that stores recent snapshots of small bounding boxes to prevent full chunk scans.
export class MiningWorldSnapshotCache {
    constructor() {
        this.cache = new Map();
        this.maxSize = 100; // Limit cache entries to avoid memory leak
    }

    cacheSnapshot(key, blocks) {
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, blocks);
    }

    getSnapshot(key) {
        return this.cache.get(key) || null;
    }

    clear() {
        this.cache.clear();
    }
}
