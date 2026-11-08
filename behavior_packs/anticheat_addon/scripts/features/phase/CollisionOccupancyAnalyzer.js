import { BlockCollisionProfileProvider } from './BlockCollisionProfileProvider.js';

class CollisionOccupancyAnalyzer {
    static getOccupiedSolidBlocks(pos, aabb, gridProvider) {
        let hits = [];
        let minX = Math.floor(pos.x + aabb.min.x);
        let maxX = Math.floor(pos.x + aabb.max.x);
        let minY = Math.floor(pos.y + aabb.min.y);
        let maxY = Math.floor(pos.y + aabb.max.y);
        let minZ = Math.floor(pos.z + aabb.min.z);
        let maxZ = Math.floor(pos.z + aabb.max.z);
        
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                for (let z = minZ; z <= maxZ; z++) {
                    const block = gridProvider.getBlockAt(x, y, z);
                    const profile = BlockCollisionProfileProvider.getProfile(block);
                    if (profile.isSolid) {
                        hits.push({ x, y, z, profile, block });
                    }
                }
            }
        }
        return hits;
    }
}
export { CollisionOccupancyAnalyzer  };
