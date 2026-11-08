import { NukerSpatialWindow } from './NukerSpatialWindow.js';
import { NukerFeatureExtractor } from './NukerFeatureExtractor.js';

export class NukerSessionWindow {
    constructor(authRegistry) {
        this.sessions = new Map();
        this.authRegistry = authRegistry;
    }
    
    processBreakEvent(event) {
        const playerName = event.player.name;
        if (!this.sessions.has(playerName)) {
            this.sessions.set(playerName, {
                spatialWindow: new NukerSpatialWindow(),
                lastBreakTime: null
            });
        }
        
        const session = this.sessions.get(playerName);
        session.spatialWindow.addBreak(event.block.x, event.block.y, event.block.z, event.timestamp);
        
        const result = NukerFeatureExtractor.extract(session, session.spatialWindow, event, this.authRegistry);
        
        session.lastBreakTime = event.timestamp;
        
        this.cleanOldSessions(event.timestamp);
        
        return result;
    }
    
    cleanOldSessions(currentTimestamp) {
        for (const [playerName, session] of this.sessions.entries()) {
            if (session.lastBreakTime && currentTimestamp - session.lastBreakTime > 60000) {
                this.sessions.delete(playerName);
            }
        }
    }
}
