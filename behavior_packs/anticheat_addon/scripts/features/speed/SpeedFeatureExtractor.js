import { SafeKinematicsProvider } from './SafeKinematicsProvider.js';
import { SpeedRulesetProvider } from './SpeedRulesetProvider.js';

export class SpeedFeatureExtractor {
    constructor(authRegistry, windowManager) {
        this.authRegistry = authRegistry;
        this.windowManager = windowManager;
    }
    
    analyze(playerId, oldPos, newPos, deltaTime, playerState, blockUnderneath, inputContext) {
        const kinematics = SafeKinematicsProvider.getVelocity(oldPos, newPos, deltaTime);
        this.windowManager.updateSession(playerId, kinematics, Date.now(), inputContext);
        
        const authorizedBoost = this.authRegistry.getMaxAuthorizedSpeedBoost(playerId);
        const maxAllowed = SpeedRulesetProvider.getMaxAllowedSpeed(playerState, blockUnderneath, authorizedBoost);
        
        const output = {
            shadowMode: true,
            actionTaken: "NONE",
            threatModel: "NONE",
            evidence: []
        };
        
        if (kinematics.horizontalSpeed > maxAllowed) {
            if (kinematics.horizontalSpeed > maxAllowed * 1.5) {
                output.threatModel = "SPEED_BURST";
            } else {
                output.threatModel = "SPEED_CONSTANT";
            }
            output.evidence.push("SPEED_SUSTAINED_EXCESS");
        }
        
        return {
            speed: output
        };
    }
}
