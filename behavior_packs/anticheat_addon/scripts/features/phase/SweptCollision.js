import { BlockCollisionProfileProvider } from './BlockCollisionProfileProvider.js';

class SweptCollision {
    static intersectSweptAabbWithBlockGrid(startPos, endPos, aabb, gridProvider, maxBlocksPerSegment = 50) {
        // DDA voxel traversal
        let hits = [];
        let dx = endPos.x - startPos.x;
        let dy = endPos.y - startPos.y;
        let dz = endPos.z - startPos.z;
        let dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
        if (dist === 0) return hits;
        
        let stepX = dx / dist;
        let stepY = dy / dist;
        let stepZ = dz / dist;
        
        // Simulating the swept AABB by sampling points along the ray or doing full swept AABB.
        // For simplicity in this pure JS implementation, we do a basic raycast + AABB check.
        const samples = Math.ceil(dist * 2); 
        let blocksChecked = 0;
        let visited = new Set();
        
        for (let i = 0; i <= samples && blocksChecked < maxBlocksPerSegment; i++) {
            let cx = startPos.x + stepX * (i / 2);
            let cy = startPos.y + stepY * (i / 2);
            let cz = startPos.z + stepZ * (i / 2);
            
            // Get blocks intersecting AABB at this point
            let minX = Math.floor(cx + aabb.min.x);
            let maxX = Math.floor(cx + aabb.max.x);
            let minY = Math.floor(cy + aabb.min.y);
            let maxY = Math.floor(cy + aabb.max.y);
            let minZ = Math.floor(cz + aabb.min.z);
            let maxZ = Math.floor(cz + aabb.max.z);
            
            for (let x = minX; x <= maxX; x++) {
                for (let y = minY; y <= maxY; y++) {
                    for (let z = minZ; z <= maxZ; z++) {
                        let key = `${x},${y},${z}`;
                        if (!visited.has(key)) {
                            visited.add(key);
                            blocksChecked++;
                            const blockInfo = gridProvider.getBlockAt(x, y, z);
                            const profile = BlockCollisionProfileProvider.getProfile(blockInfo);
                            if (profile.isSolid) {
                                hits.push({ x, y, z, block: { ...blockInfo, profile } });
                            }
                        }
                    }
                }
            }
        }
        return hits;
    }
}
export { SweptCollision  };
