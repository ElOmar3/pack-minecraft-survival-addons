import { EquipmentRulesetProvider } from './EquipmentRulesetProvider.js';

export class SafeEquipmentProvider {
    static isActionSafe(actionType, threatLevel) {
        // Enforced shadow mode means we only return observation state
        return { safe: true, shadowMode: true, actionTaken: "NONE" };
    }
}
