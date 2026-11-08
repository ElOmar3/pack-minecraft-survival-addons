export class EquipmentCapabilityProvider {
    static getArmorScore(itemId) {
        if (!itemId) return 0;
        const name = itemId.toLowerCase();
        let score = 0;
        if (name.includes('leather')) score = 1;
        else if (name.includes('gold') || name.includes('golden')) score = 2;
        else if (name.includes('chainmail')) score = 3;
        else if (name.includes('iron')) score = 4;
        else if (name.includes('diamond')) score = 5;
        else if (name.includes('netherite')) score = 6;
        
        if (name.includes('chestplate')) score *= 4;
        else if (name.includes('leggings')) score *= 3;
        else if (name.includes('helmet')) score *= 2;
        else if (name.includes('boots')) score *= 1;
        return score;
    }

    static isTotem(itemId) {
        if (!itemId) return false;
        return itemId.includes('totem_of_undying');
    }
    
    static isArmor(itemId) {
        return this.getArmorScore(itemId) > 0;
    }
}
