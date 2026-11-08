import { PlacementGeometryExtractor } from './PlacementGeometryExtractor.js';
import { ScaffoldSessionWindow } from './ScaffoldSessionWindow.js';
import { ScaffoldFeatureExtractor } from './ScaffoldFeatureExtractor.js';

export class ScaffoldPlacementEventProvider {
    constructor() {
        this.sessions = new Map();
    }

    onPlayerPlaceBlock(event) {
        const playerId = event.player.id;
        
        if (!this.sessions.has(playerId)) {
            this.sessions.set(playerId, new ScaffoldSessionWindow(playerId));
        }
        
        const session = this.sessions.get(playerId);
        
        const headLocation = event.player.getHeadLocation ? event.player.getHeadLocation() : { x: 0, y: 0, z: 0 };
        const viewDirection = event.player.getViewDirection ? event.player.getViewDirection() : { x: 0, y: 0, z: 0 };
        const blockLocation = event.block ? (event.block.location || { x: event.block.x, y: event.block.y, z: event.block.z }) : { x: 0, y: 0, z: 0 };

        const geom = PlacementGeometryExtractor.extract(
            headLocation,
            viewDirection,
            blockLocation,
            { x: 0, y: 1, z: 0 } // Fallback face normal since Bedrock doesn't provide it natively in the after event
        );
        
        session.addPlacement({
            blockPos: blockLocation,
            geometry: geom,
            timestamp: Date.now(),
            timeSinceLastRotation: 100 // fallback
        });
    }

    evaluateClosedSessions(currentTime) {
        const packets = [];
        for (const [playerId, session] of this.sessions.entries()) {
            if (session.isWindowClosed(currentTime)) {
                const features = ScaffoldFeatureExtractor.extract(session);
                
                packets.push({
                    playerId,
                    scaffold: features,
                    enforcement: {
                        shadowMode: session.shadowMode,
                        actionTaken: session.actionTaken
                    }
                });
                
                this.sessions.delete(playerId);
            }
        }
        return packets;
    }
}
