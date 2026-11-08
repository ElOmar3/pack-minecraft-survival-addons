export class CriticalFeatureExtractor {
    static extract(combatWindow, rulesetProvider) {
        const events = combatWindow.getEvents();
        const attacks = events.filter(e => e.type === "attack");
        const damages = events.filter(e => e.type === "damage");
        const movements = events.filter(e => e.type === "movement");

        const features = {
            threatType: "NONE",
            criticalRatio: 0,
            suspiciousHits: 0,
            shadowMode: true,
            actionTaken: "NONE"
        };

        let totalHits = 0;
        let criticalHits = 0;
        let forcedCritCount = 0;
        let spoofCritCount = 0;
        let microHopCount = 0;

        for (const damage of damages) {
            const attack = attacks.find(a => 
                a.attackerId === damage.sourceId && 
                a.targetId === damage.targetId &&
                damage.tick - a.tick >= 0 && damage.tick - a.tick <= 5
            );

            if (attack) {
                totalHits++;
                const isCritical = rulesetProvider.isCriticalDamage(combatWindow.baseDamage, damage.damage);
                
                if (isCritical) {
                    criticalHits++;
                    
                    if (attack.hasGroundSupport && attack.velocity.y < 0) {
                        spoofCritCount++;
                    } else if (attack.velocity.y >= 0) {
                        forcedCritCount++;
                    } else {
                        const recentMovement = movements.find(m => m.attackerId === attack.attackerId && m.tick >= attack.tick - 3 && m.tick < attack.tick);
                        if (recentMovement && recentMovement.isOnGround) {
                            microHopCount++;
                        }
                    }
                }
            }
        }

        if (totalHits > 0) {
            features.criticalRatio = criticalHits / totalHits;
        }

        if (spoofCritCount > 0) {
            features.threatType = "GROUND_SPOOF_CRITICAL_CANDIDATE";
        } else if (forcedCritCount > 0) {
            features.threatType = "FORCED_CRITICAL_CANDIDATE";
        } else if (microHopCount > 0) {
            features.threatType = "MICRO_HOP_CRITICAL_CANDIDATE";
        } else if (totalHits >= 5 && features.criticalRatio >= 0.8) {
            features.threatType = "ALWAYS_CRITICAL_PATTERN";
        }

        return features;
    }
}
