import { SurfaceProfileProvider } from './SurfaceProfileProvider.js';

export class SpeedRulesetProvider {
    static get BASE_WALK_SPEED() { return 4.3; }
    static get BASE_SPRINT_SPEED() { return 5.6; }
    
    static getMaxAllowedSpeed(playerState, blockUnderneath, authorizedBoost) {
        let base = (playerState && playerState.isSprinting) ? this.BASE_SPRINT_SPEED : this.BASE_WALK_SPEED;
        const surfaceMult = SurfaceProfileProvider.getSurfaceMultiplier(blockUnderneath);
        
        return (base * surfaceMult) + (authorizedBoost || 0) + 1.0; 
    }
}
