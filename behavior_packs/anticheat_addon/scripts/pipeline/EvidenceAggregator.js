export class EvidenceAggregator {
    constructor() {
        this.playerWindows = new Map();
        this.config = {
            short: 5000,
            medium: 30000,
            long: 120000
        };
    }

    addEvent(playerId, event) {
        if (!this.playerWindows.has(playerId)) {
            this.playerWindows.set(playerId, { short: [], medium: [], long: [] });
        }
        
        const windows = this.playerWindows.get(playerId);
        const now = Date.now();
        const ev = { ...event, timestamp: now };
        
        windows.short.push(ev);
        windows.medium.push(ev);
        windows.long.push(ev);
        
        this._cleanup(playerId, now);
    }

    getWindows(playerId) {
        this._cleanup(playerId, Date.now());
        return this.playerWindows.get(playerId) || { short: [], medium: [], long: [] };
    }

    getReadyWindows() {
        const ready = [];
        const now = Date.now();
        for (const [playerId, windows] of this.playerWindows.entries()) {
            this._cleanup(playerId, now);
            if (windows.short.length === 0 && windows.medium.length === 0 && windows.long.length === 0) {
                this.playerWindows.delete(playerId);
            } else {
                ready.push({ playerId, events: windows });
            }
        }
        return ready;
    }

    _cleanup(playerId, now) {
        const windows = this.playerWindows.get(playerId);
        if (!windows) return;
        
        const cleanArray = (arr, maxAge) => {
            let i = 0;
            while (i < arr.length && now - arr[i].timestamp >= maxAge) {
                i++;
            }
            if (i > 0) {
                arr.splice(0, i);
            }
        };

        cleanArray(windows.short, this.config.short);
        cleanArray(windows.medium, this.config.medium);
        cleanArray(windows.long, this.config.long);
    }
}
