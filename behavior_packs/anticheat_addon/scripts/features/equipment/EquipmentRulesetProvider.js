import { EquipmentCapabilityProvider } from './EquipmentCapabilityProvider.js';

export class EquipmentRulesetProvider {
    static getAutoTotemRules() {
        return {
            shadowMode: true,
            actionTaken: "NONE",
            maxTicksForLegitEquip: 10,
            lethalHealthThreshold: 6.0 // 3 hearts
        };
    }

    static getAutoArmorRules() {
        return {
            shadowMode: true,
            actionTaken: "NONE",
            maxTicksForMultiSlot: 5,
            combatTickWindow: 40 // 2 seconds
        };
    }
}
