import { EquipmentRulesetProvider } from './EquipmentRulesetProvider.js';
import { EquipmentCapabilityProvider } from './EquipmentCapabilityProvider.js';

export class AutoArmorFeatureExtractor {
    constructor() {
        this.rules = EquipmentRulesetProvider.getAutoArmorRules();
        this.lastCombatTicks = new Map();
    }

    updateCombatState(playerId, tick) {
        this.lastCombatTicks.set(playerId, tick);
    }

    extractFeatures(playerId, revisionResult) {
        const features = [];
        const { diff, currentTick, lastTick } = revisionResult;
        
        const tickDelta = currentTick - lastTick;
        const lastCombat = this.lastCombatTicks.get(playerId) || 0;
        const combatDelta = currentTick - lastCombat;

        let armorEquips = 0;
        let betterArmorEquips = 0;

        for (const change of diff) {
            if (EquipmentCapabilityProvider.isArmor(change.newItem)) {
                const oldScore = EquipmentCapabilityProvider.getArmorScore(change.oldItem);
                const newScore = EquipmentCapabilityProvider.getArmorScore(change.newItem);
                
                if (newScore > oldScore) {
                    armorEquips++;
                    betterArmorEquips++;
                } else if (newScore > 0 && oldScore > 0 && newScore === oldScore) {
                    armorEquips++;
                    features.push("DURABILITY_SWAP");
                }
            }
        }

        if (armorEquips >= 2 && tickDelta <= this.rules.maxTicksForMultiSlot) {
            features.push("INSTANT_MULTI_SLOT");
        }
        
        if (betterArmorEquips > 0) {
            features.push("BEST_SET");
        }

        if (armorEquips > 0 && combatDelta <= this.rules.combatTickWindow) {
            features.push("AUTOARMOR_COMBAT_TRIGGERED");
        }

        if (features.length > 0) {
            // Remove duplicates
            const uniqueFeatures = [...new Set(features)];
            return {
                autoArmor: {
                    features: uniqueFeatures,
                    shadowMode: this.rules.shadowMode,
                    actionTaken: this.rules.actionTaken
                }
            };
        }
        return null;
    }
}
