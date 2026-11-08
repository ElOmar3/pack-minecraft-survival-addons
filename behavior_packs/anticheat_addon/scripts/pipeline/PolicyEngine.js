import { ErrorReporter } from "../ErrorReporter.js";
import { ViolationManager } from "../ViolationManager.js";
import { world } from "@minecraft/server";

export class PolicyEngine {
    constructor(config = {}) {
        this.shadowMode = config.shadowMode !== undefined ? config.shadowMode : true;
        this.thresholds = {
            alert: 0.6,
            mitigation: 0.8,
            ban: 0.95
        };
    }

    decideAction(fusionResult) {
        let action = "none";

        if (fusionResult.finalScore >= this.thresholds.ban) {
            action = "ban";
        } else if (fusionResult.finalScore >= this.thresholds.mitigation) {
            action = "mitigation";
        } else if (fusionResult.finalScore >= this.thresholds.alert) {
            action = "alert";
        }

        const decision = {
            playerId: fusionResult.playerId,
            score: fusionResult.finalScore,
            intendedAction: action,
            shadowMode: this.shadowMode,
            actualAction: this.shadowMode ? "shadow_log" : action
        };

        return decision;
    }

    execute(fusionResult) {
        const decision = this.decideAction(fusionResult);
        
        // Discord Relay Webhook Integration (via console.error)
        if (decision.intendedAction !== "none") {
            const discordMsg = `[ANTICHEAT ALERT] 🚨 ${decision.playerId} fue detectado por Gemma Pipeline. Acción sugerida: ${decision.intendedAction.toUpperCase()}. Nivel de riesgo: ${(decision.score * 100).toFixed(1)}%`;
            console.error(discordMsg);
        }

        if (decision.actualAction !== "none" && decision.actualAction !== "shadow_log") {
            console.warn(`[PolicyEngine] Action ${decision.actualAction} applied to ${decision.playerId} with score ${decision.score}`);
        } else if (decision.actualAction === "shadow_log") {
            console.warn(`[PolicyEngine] SHADOW LOG: Would have applied ${decision.intendedAction} to ${decision.playerId}`);
            try {
                // Find player to get xuid
                const target = world.getAllPlayers().find(p => p.id === decision.playerId || p.name === decision.playerId);
                if (target) {
                    ViolationManager.ensureHistoryLoaded();
                    const key = `xuid:${target.xuid || target.name}`;
                    const history = ViolationManager.recentDetections.get(key) || [];
                    history.push({
                        time: new Date().toISOString(),
                        detector: "GEMMA_PIPELINE",
                        value: decision.score.toFixed(2),
                        action: decision.intendedAction,
                        shadowMode: true
                    });
                    ViolationManager.recentDetections.set(key, history);
                    ViolationManager.persistHistory();
                }
            } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "PolicyEngine.js", operation: "try-catch", category: "runtime" });
                console.warn("[PolicyEngine] Could not persist shadow log to DB: " + e);
            }
        }
    }
}
