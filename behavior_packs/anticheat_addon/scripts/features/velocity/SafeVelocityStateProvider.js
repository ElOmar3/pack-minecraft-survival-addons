import { ErrorReporter } from "../../ErrorReporter.js";
export class SafeVelocityStateProvider {
    sample(entity, windowDuration) {
        try {
            return {
                x: entity.velocity.x,
                y: entity.velocity.y,
                z: entity.velocity.z,
                timestamp: Date.now()
            };
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "SafeVelocityStateProvider.js", operation: "try-catch", category: "runtime" });
            return null;
        }
    }
}
