export class BulkBreakAuthorizationRegistry {
    constructor() {
        this.authorizedPlayers = new Map();
    }
    
    authorize(playerName, durationMs) {
        this.authorizedPlayers.set(playerName, Date.now() + durationMs);
    }
    
    isAuthorized(playerName) {
        if (!this.authorizedPlayers.has(playerName)) return false;
        if (Date.now() > this.authorizedPlayers.get(playerName)) {
            this.authorizedPlayers.delete(playerName);
            return false;
        }
        return true;
    }
}
