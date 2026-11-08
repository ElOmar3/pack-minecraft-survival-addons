export class WeaponRulesetProvider {
    getFinalCombatScore(item) {
        if (!item || !item.typeId) return 0;
        let score = 0;
        const type = item.typeId.toLowerCase();
        
        if (type.includes("sword")) score += 10;
        if (type.includes("axe")) score += 8;
        
        if (type.includes("netherite")) score += 5;
        if (type.includes("diamond")) score += 4;
        if (type.includes("iron")) score += 3;
        if (type.includes("stone")) score += 2;
        if (type.includes("golden")) score += 1;
        if (type.includes("wood")) score += 1;
        
        if (item.hasEnchantments) score += 2; 
        return score;
    }

    isWeapon(item) {
        return this.getFinalCombatScore(item) > 0;
    }
}
