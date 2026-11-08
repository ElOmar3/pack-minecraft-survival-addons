const THREAT_MODELS = {
    AUTO_SWORD: 'AUTO_SWORD',
    AUTO_WEAPON_BEST_DAMAGE: 'AUTO_WEAPON_BEST_DAMAGE',
    SWITCH_ON_TARGET: 'SWITCH_ON_TARGET',
    SWITCH_ON_ATTACK: 'SWITCH_ON_ATTACK',
    SWITCH_AND_RESTORE: 'SWITCH_AND_RESTORE',
    HUMANIZED_AUTO_WEAPON: 'HUMANIZED_AUTO_WEAPON',
    LEGITIMATE_FAST_SWITCH: 'LEGITIMATE_FAST_SWITCH'
};

const EVIDENCES = {
    AUTO_WEAPON_PREHIT_SWITCH_REPEATED: 'AUTO_WEAPON_PREHIT_SWITCH_REPEATED',
    AUTO_WEAPON_SWITCH_AND_RESTORE_REPEATED: 'AUTO_WEAPON_SWITCH_AND_RESTORE_REPEATED',
    AUTO_WEAPON_BEST_SELECTION: 'AUTO_WEAPON_BEST_SELECTION',
    AUTO_WEAPON_ONE_TICK_SWAP: 'AUTO_WEAPON_ONE_TICK_SWAP'
};

function extractFeatures(combatWindow, context) {
    let features = {
        shadowMode: true,
        actionTaken: "NONE",
        dataQualityMetrics: { falsePositiveRisk: 0 },
        threatModel: null,
        evidences: [],
        correlationGroup: `autoweapon:${context.combatSessionId || "none"}:${context.timeBucket || 0}`
    };

    if (context.inventoryModifiedRecently || context.isEating || context.isBuilding || context.brokenWeapon) {
        features.dataQualityMetrics.falsePositiveRisk = 0.8;
    }
    
    const preHitSwitches = combatWindow.filter(e => e.type === 'slot_change' && e.tick < context.hitTick);
    const postHitSwitches = combatWindow.filter(e => e.type === 'slot_change' && e.tick > context.hitTick);
    const hitTickSwitches = combatWindow.filter(e => e.type === 'slot_change' && e.tick === context.hitTick);

    if (preHitSwitches.length > 0 && postHitSwitches.length > 0) {
        const pre = preHitSwitches[preHitSwitches.length - 1];
        const post = postHitSwitches[0];
        if (post.tick - pre.tick <= 2 && pre.tick === context.hitTick - 1) {
            features.threatModel = THREAT_MODELS.SWITCH_AND_RESTORE;
            features.evidences.push(EVIDENCES.AUTO_WEAPON_ONE_TICK_SWAP);
            features.evidences.push(EVIDENCES.AUTO_WEAPON_SWITCH_AND_RESTORE_REPEATED);
        }
    } else if (hitTickSwitches.length > 0) {
        features.threatModel = THREAT_MODELS.SWITCH_ON_ATTACK;
        features.evidences.push(EVIDENCES.AUTO_WEAPON_PREHIT_SWITCH_REPEATED);
    } else if (preHitSwitches.length > 0 && context.bestWeaponSelected) {
        features.threatModel = THREAT_MODELS.AUTO_WEAPON_BEST_DAMAGE;
        features.evidences.push(EVIDENCES.AUTO_WEAPON_BEST_SELECTION);
    } else if (preHitSwitches.length > 0) {
        features.threatModel = THREAT_MODELS.AUTO_SWORD;
        features.evidences.push(EVIDENCES.AUTO_WEAPON_PREHIT_SWITCH_REPEATED);
    }
    
    if (context.inputEpochTicks > 0 && context.inputEpochTicks < 20) {
        if (features.threatModel) features.threatModel = THREAT_MODELS.LEGITIMATE_FAST_SWITCH;
    }

    if (context.isMultiTarget && preHitSwitches.length > 0) {
        features.threatModel = THREAT_MODELS.HUMANIZED_AUTO_WEAPON;
    }

    if (features.dataQualityMetrics.falsePositiveRisk > 0.5) {
        features.evidences = []; 
    }

    return features;
}

export { extractFeatures, THREAT_MODELS, EVIDENCES };
