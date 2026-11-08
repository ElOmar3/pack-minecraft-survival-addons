export class MovementAuthorizationRegistry {
    constructor() {
        this.authorizations = new Map();
    }
    
    registerAuthorization(playerId, source, speedBoost, durationMs) {
        const expiresAt = Date.now() + durationMs;
        const current = this.authorizations.get(playerId) || [];
        current.push({ source, speedBoost, expiresAt });
        this.authorizations.set(playerId, current);
    }
    
    getMaxAuthorizedSpeedBoost(playerId) {
        const current = this.authorizations.get(playerId);
        if (!current) return 0;
        
        const now = Date.now();
        let maxBoost = 0;
        const valid = [];
        
        for (let i = 0; i < current.length; i++) {
            if (current[i].expiresAt > now) {
                if (current[i].speedBoost > maxBoost) {
                    maxBoost = current[i].speedBoost;
                }
                valid.push(current[i]);
            }
        }
        
        this.authorizations.set(playerId, valid);
        return maxBoost;
    }
}
