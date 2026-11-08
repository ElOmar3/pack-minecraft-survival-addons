class PhaseAuthorizationRegistry {
    constructor() {
        this.authorizations = new Map();
    }
    
    authorize(playerId, reason, durationMs = 1000) {
        this.authorizations.set(playerId, {
            reason,
            expiresAt: Date.now() + durationMs
        });
    }
    
    isAuthorized(playerId) {
        const auth = this.authorizations.get(playerId);
        if (auth) {
            if (Date.now() < auth.expiresAt) {
                return true;
            } else {
                this.authorizations.delete(playerId);
                return false;
            }
        }
        return false;
    }
}
export { PhaseAuthorizationRegistry  };
