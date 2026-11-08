class PhaseFeatureExtractor {
    static extract(sessionWindow, authorizations, worldChanges) {
        const records = sessionWindow.getRecords();
        if (records.length < 2) return { isViolation: false };
        
        const current = records[records.length - 1];
        const previous = records[records.length - 2];
        
        if (authorizations.isAuthorized(current.playerId)) {
            return { isViolation: false, reason: "AUTHORIZED" };
        }
        
        // Analyze movement
        const dy = current.pos.y - previous.pos.y;
        const dx = current.pos.x - previous.pos.x;
        const dz = current.pos.z - previous.pos.z;
        const horizontalDist = Math.sqrt(dx*dx + dz*dz);
        
        const isHorizontalPhase = current.sweptHits && current.sweptHits.some(h => 
            worldChanges.wasRecentlyChanged(h.x, h.y, h.z) === false
        );
        
        let evidence = null;
        let threatModel = null;
        
        const isInsideSolid = current.occupiedSolidBlocks && current.occupiedSolidBlocks.length > 0;
        const wasInsideSolid = previous.occupiedSolidBlocks && previous.occupiedSolidBlocks.length > 0;
        
        if (isHorizontalPhase && horizontalDist > 0.1) {
            const hit = current.sweptHits[0];
            const profile = hit && hit.block && hit.block.profile ? hit.block.profile : null;
            if (profile && profile.type === "thin_wall") {
                threatModel = "THIN_WALL_CLIP";
                evidence = "PHASE_SOLID_CROSSING_REPEATED";
            } else if (!isInsideSolid) {
                threatModel = "PHASE_HORIZONTAL";
                evidence = "PHASE_SOLID_CROSSING_REPEATED";
            }
        }
        
        if (!threatModel && Math.abs(dy) > 0.1 && isHorizontalPhase) {
            threatModel = "PHASE_VERTICAL";
            evidence = "PHASE_SOLID_CROSSING_REPEATED";
        } else if (!threatModel && isInsideSolid && wasInsideSolid) {
            // Incremental phase or Burrow
            const blocks = current.occupiedSolidBlocks;
            if (blocks.some(b => b.profile && b.profile.type === "full_block")) {
                if (horizontalDist < 0.05 && Math.abs(dy) < 0.05) {
                    threatModel = "BURROW_OR_INSIDE_BLOCK";
                } else if (records.filter(r => r.occupiedSolidBlocks && r.occupiedSolidBlocks.length > 0).length >= 5) {
                    threatModel = "NOCLIP_SUSTAINED";
                } else {
                    threatModel = "INCREMENTAL_PHASE";
                }
                evidence = "NOCLIP_MOVEMENT_INSIDE_SOLID";
            }
        } else if (!threatModel && isInsideSolid && !wasInsideSolid && horizontalDist < 0.1) {
             threatModel = "CORNER_CLIP";
             evidence = "NOCLIP_MOVEMENT_INSIDE_SOLID";
        }
        
        // Handle false positives like Touch to PC Doorway
        if (threatModel) {
            const hasDoor = current.occupiedSolidBlocks && current.occupiedSolidBlocks.some(b => b.profile && b.profile.type === "open_door");
            if (hasDoor || worldChanges.wasRecentlyChanged(current.pos.x, current.pos.y, current.pos.z)) {
                 return { isViolation: false, reason: "FALSE_POSITIVE_MITIGATED" };
            }
        }
        
        if (threatModel) {
             return { isViolation: true, threatModel, evidence };
        }
        
        return { isViolation: false };
    }
}
export { PhaseFeatureExtractor  };
