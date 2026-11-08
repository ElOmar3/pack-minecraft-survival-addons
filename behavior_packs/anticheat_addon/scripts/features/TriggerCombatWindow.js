/**
 * TriggerCombatWindow.js
 * 
 * Manages combat windows for TriggerBot detection.
 */

class TriggerCombatWindow {
    constructor(sessionId, targetId) {
        this.sessionId = sessionId;
        this.targetId = targetId;
        this.events = [];
        this.context = {
            combatSessionId: sessionId,
            targetId: targetId,
            timeBucket: Math.floor(Date.now() / 10000), // 10 second buckets
            targetInLineOfSight: false,
            eligibleTick: 0,
            rayEntryTick: 0,
            attackTick: 0,
            rayHitDepth: 0.0,
            inputContextEpoch: "PC" // Default to PC, update as needed
        };
    }

    addEvent(event) {
        this.events.push(event);
    }

    updateContext(newContext) {
        this.context = { ...this.context, ...newContext };
        
        // Handle input context changes (e.g. PC to Mobile)
        if (newContext.inputContextEpoch && newContext.inputContextEpoch !== this.context.inputContextEpoch) {
            // Keep separate baselines but do not erase score
            this.context.inputContextEpoch = newContext.inputContextEpoch;
        }
    }

    getEvents() {
        return this.events;
    }

    getContext() {
        return this.context;
    }
}

module.exports = TriggerCombatWindow;
