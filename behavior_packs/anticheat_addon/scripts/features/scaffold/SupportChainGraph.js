export class SupportChainGraph {
    constructor() {
        this.placements = [];
        this.voxelMap = new Map(); // Para voxel hashing O(1) de busqueda, total O(n)
    }

    hashPos(pos) {
        return `${Math.floor(pos.x)}_${Math.floor(pos.y)}_${Math.floor(pos.z)}`;
    }

    addPlacement(placement) {
        const hash = this.hashPos(placement.blockPos);
        this.voxelMap.set(hash, placement);
        this.placements.push(placement);
    }

    buildChainFeatures() {
        if (this.placements.length === 0) return null;
        let dx = 0, dy = 0, dz = 0;
        for (let i = 1; i < this.placements.length; i++) {
            dx += Math.abs(this.placements[i].blockPos.x - this.placements[i-1].blockPos.x);
            dy += Math.abs(this.placements[i].blockPos.y - this.placements[i-1].blockPos.y);
            dz += Math.abs(this.placements[i].blockPos.z - this.placements[i-1].blockPos.z);
        }
        return {
            isTower: dy > dx && dy > dz,
            isBridge: (dx > dy || dz > dy),
            length: this.placements.length
        };
    }
}
