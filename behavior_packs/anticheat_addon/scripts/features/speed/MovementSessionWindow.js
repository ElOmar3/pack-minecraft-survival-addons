export class MovementSessionWindow {
    constructor() {
        this.sessions = new Map();
    }
    
    updateSession(playerId, velocity, timestamp, inputContext) {
        let session = this.sessions.get(playerId);
        if (!session) {
            session = {
                history: [],
                inputContext: inputContext
            };
            this.sessions.set(playerId, session);
        }
        
        if (session.inputContext !== inputContext) {
            session.inputContext = inputContext;
        }
        
        session.history.push({ velocity, timestamp });
        if (session.history.length > 20) {
            session.history.shift();
        }
        
        return session;
    }
    
    getSession(playerId) {
        return this.sessions.get(playerId);
    }
}
