export class KnockbackRulesetProvider {
    getExpectedEnvelope(impactType, knockbackAmount, resistance) {
        const baseH = 0.4 * knockbackAmount * (1 - resistance);
        const baseV = 0.4 * knockbackAmount * (1 - resistance);
        return {
            minHorizontal: baseH * 0.8,
            maxHorizontal: baseH * 1.2,
            minVertical: baseV * 0.8,
            maxVertical: baseV * 1.2
        };
    }
}
