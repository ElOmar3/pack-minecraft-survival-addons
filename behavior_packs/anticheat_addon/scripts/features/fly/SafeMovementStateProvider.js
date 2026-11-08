import { ErrorReporter } from "../../ErrorReporter.js";
export class SafeMovementStateProvider {
    static getPlayerState(player) {
        try {
            const location = player.location;
            const velocity = player.getVelocity();
            const isOnGround = player.isOnGround;
            const isFlying = player.isFlying;
            const isGliding = player.isGliding;
            const isSwimming = player.isSwimming;
            const isInWater = player.isInWater;
            
            return {
                valid: true,
                location: { x: location.x, y: location.y, z: location.z },
                velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
                isOnGround,
                isFlying,
                isGliding,
                isSwimming,
                isInWater
            };
        } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "SafeMovementStateProvider.js", operation: "try-catch", category: "runtime" });
            return {
                valid: false
            };
        }
    }
}
