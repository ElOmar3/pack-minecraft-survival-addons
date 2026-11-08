import { PhaseFeatureExtractor } from './PhaseFeatureExtractor.js';
import { PhaseSessionWindow } from './PhaseSessionWindow.js';
import { SweptCollision } from './SweptCollision.js';
import { CollisionOccupancyAnalyzer } from './CollisionOccupancyAnalyzer.js';
import { PlayerCollisionVolumeProvider } from './PlayerCollisionVolumeProvider.js';

class PhaseStateMachine {
    constructor(worldProvider, authRegistry, worldChanges) {
        this.worldProvider = worldProvider;
        this.authRegistry = authRegistry;
        this.worldChanges = worldChanges;
        this.sessions = new Map();
        
        this.shadowMode = true; // Strict requirement
    }
    
    update(playerId, pos, stance, inputMethod) {
        if (!this.sessions.has(playerId)) {
            this.sessions.set(playerId, new PhaseSessionWindow());
        }
        
        const session = this.sessions.get(playerId);
        const aabb = PlayerCollisionVolumeProvider.getVolume(stance);
        
        // previous pos
        const records = session.getRecords();
        let sweptHits = [];
        if (records.length > 0) {
            const prevPos = records[records.length - 1].pos;
            sweptHits = SweptCollision.intersectSweptAabbWithBlockGrid(prevPos, pos, aabb, this.worldProvider);
        }
        
        const occupiedSolidBlocks = CollisionOccupancyAnalyzer.getOccupiedSolidBlocks(pos, aabb, this.worldProvider);
        
        const record = {
            timestamp: Date.now(),
            playerId,
            pos,
            aabb,
            inputMethod,
            sweptHits,
            occupiedSolidBlocks
        };
        
        session.addRecord(record);
        
        const features = PhaseFeatureExtractor.extract(session, this.authRegistry, this.worldChanges);
        
        if (features.isViolation) {
            // Dispatch shadow mode event
            const event = {
                playerId,
                actionTaken: "NONE",
                shadowMode: this.shadowMode,
                violation: true,
                threatModel: features.threatModel,
                evidence: features.evidence,
                phase: {
                    pos,
                    stance,
                    inputMethod
                }
            };
            return event;
        }
        
        return null;
    }
}
export { PhaseStateMachine  };
