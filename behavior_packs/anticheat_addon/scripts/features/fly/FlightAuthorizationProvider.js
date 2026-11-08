import { ErrorReporter } from "../../ErrorReporter.js";
export class FlightAuthorizationProvider {
    static isAuthorizedToFly(player, state) {
        try {
            const gameMode = player.getGameMode ? player.getGameMode() : (player.gameMode || "survival");
            if (gameMode === "creative" || gameMode === "spectator" || gameMode === 1 || gameMode === 3) {
                return true;
            }
            if (player.hasComponent && (player.hasComponent("minecraft:is_flying") || player.hasComponent("minecraft:may_fly"))) {
                return true;
            }
            if (state.isGliding || (player.hasComponent && player.hasComponent("minecraft:is_gliding"))) {
                return true;
            }
            if (state.isInWater || state.isSwimming) {
                return true;
            }
            if (player.getEffect) {
                if (player.getEffect("levitation")) return true;
                if (player.getEffect("slow_falling")) return true;
                if (player.getEffect("jump_boost")) return true;
            }
            return false;
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "FlightAuthorizationProvider.js", operation: "try-catch", category: "runtime" });
            return false;
        }
    }
}
