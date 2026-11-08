export class BunnyHopFeatureExtractor {
    constructor(windowManager) {
        this.windowManager = windowManager;
    }
    
    analyze(playerId, playerState) {
        const session = this.windowManager.getSession(playerId);
        
        const output = {
            shadowMode: true,
            actionTaken: "NONE",
            threatModel: "NONE",
            evidence: []
        };
        
        if (!session || session.history.length < 5) return { bunnyHop: output };
        
        let hopCount = 0;
        let speedRetainedCount = 0;
        
        for (let i = 1; i < session.history.length; i++) {
            const prev = session.history[i - 1].velocity;
            const curr = session.history[i].velocity;
            
            if (prev.verticalSpeed <= 0 && curr.verticalSpeed > 0) {
                hopCount++;
                if (curr.horizontalSpeed >= prev.horizontalSpeed * 0.95 && curr.horizontalSpeed > 4.5) { 
                    speedRetainedCount++;
                }
            }
        }
        
        if (hopCount >= 2 && speedRetainedCount >= 2) {
            output.threatModel = "BUNNYHOP";
            output.evidence.push("BHOP_SPEED_RETENTION_REPEATED");
            
            const jumps = session.history.filter(h => h.velocity.verticalSpeed > 0);
            const lowHops = jumps.filter(h => h.velocity.verticalSpeed < 3.5); 
            if (lowHops.length > jumps.length / 2) {
                output.threatModel = "LOW_HOP";
            }
        }
        
        return {
            bunnyHop: output
        };
    }
}
