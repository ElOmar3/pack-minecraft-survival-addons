export class CriticalHitEventProvider {
    constructor() {
        this.events = [];
    }
    
    recordMovement(tick, attackerId, isOnGround) {
        this.events.push({
            type: "movement",
            tick,
            attackerId,
            isOnGround
        });
    }

    recordAttack(tick, attackerId, targetId, position, velocity, isOnGround, hasGroundSupport) {
        this.events.push({
            type: "attack",
            tick,
            attackerId,
            targetId,
            position: { ...position },
            velocity: { ...velocity },
            isOnGround,
            hasGroundSupport
        });
    }

    recordDamage(tick, targetId, sourceId, damage) {
        this.events.push({
            type: "damage",
            tick,
            targetId,
            sourceId,
            damage
        });
    }
    
    getEvents(startTick, endTick) {
        return this.events.filter(e => e.tick >= startTick && e.tick <= endTick);
    }

    clearOldEvents(currentTick, retentionTicks = 100) {
        this.events = this.events.filter(e => currentTick - e.tick <= retentionTicks);
    }
}
