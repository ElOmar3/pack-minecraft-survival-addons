export class CriticalDamageRulesetProvider {
    static isCriticalDamage(baseDamage, actualDamage) {
        const minCritDamage = Math.floor(baseDamage * 1.5);
        return actualDamage >= minCritDamage;
    }
}
