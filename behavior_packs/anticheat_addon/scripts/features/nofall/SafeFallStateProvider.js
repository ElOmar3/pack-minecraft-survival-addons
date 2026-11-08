import { ErrorReporter } from "../../ErrorReporter.js";
export class SafeFallStateProvider {
  constructor() {
  }
  getSafeFallState(playerState) {
    try {
      if (!playerState || typeof playerState.fallDistance !== 'number') {
        return { valid: false };
      }
      return {
        valid: true,
        fallDistance: playerState.fallDistance,
        onGround: playerState.onGround,
        motionY: playerState.motion ? playerState.motion.y : 0
      };
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "SafeFallStateProvider.js", operation: "try-catch", category: "runtime" });
      return { valid: false };
    }
  }
}
