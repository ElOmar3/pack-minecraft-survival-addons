import { EquipmentRulesetProvider } from './EquipmentRulesetProvider.js';
import { EquipmentCapabilityProvider } from './EquipmentCapabilityProvider.js';

export class AutoTotemFeatureExtractor {
    constructor() {
        this.rules = EquipmentRulesetProvider.getAutoTotemRules();
        this.lastCombatTicks = new Map();
        this.lastHealth = new Map();
    }

    updateCombatState(playerId, tick, health) {
        this.lastHealth.set(playerId, health);
        if (health < this.rules.lethalHealthThreshold) {
            this.lastCombatTicks.set(playerId, tick);
        }
    }

    extractFeatures(playerId, revisionResult) {
        const features = [];
        const { diff, currentTick, lastTick } = revisionResult;
        
        const tickDelta = currentTick - lastTick;
        const health = this.lastHealth.get(playerId) || 20;
        const lastCombat = this.lastCombatTicks.get(playerId) || 0;
        const combatDelta = currentTick - lastCombat;

        for (const change of diff) {
            if (change.slot === 'offhand' && EquipmentCapabilityProvider.isTotem(change.newItem) && !EquipmentCapabilityProvider.isTotem(change.oldItem)) {
                if (tickDelta <= this.rules.maxTicksForLegitEquip) {
                    features.push("INSTANT_REFILL");
                }
                if (health <= this.rules.lethalHealthThreshold) {
                    features.push("AUTOTOTEM_LOW_HEALTH_EQUIP");
                    features.push("LETHAL_RISK_EQUIP");
                }
                if (combatDelta <= 20) {
                    features.push("AUTOTOTEM_COMBAT_EQUIP");
                }
            }
        }

        if (features.length > 0) {
            return {
                autoTotem: {
                    features,
                    shadowMode: this.rules.shadowMode,
                    actionTaken: this.rules.actionTaken
                }
            };
        }
        return null;
    }
}
