export class KnockbackSourceEventProvider {
    constructor() {}
    captureImpact(event) {
        return {
            timestamp: Date.now(),
            sourceId: event.sourceId,
            targetId: event.targetId,
            knockbackAmount: event.amount || 1.0,
            type: event.type || "melee"
        };
    }
}
