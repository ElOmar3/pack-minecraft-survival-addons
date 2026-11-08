import { ErrorReporter } from "./ErrorReporter.js";
export class ExemptionManager {
  static exemptions = new Map();
  static EVENT_EXEMPTION_TAGS = [
    "anticheat_bypass",
    "ac_bypass",
    "event_mode",
    "staff_mode"
  ];

  static addExemption(playerName, reason, durationMs) {
    const expires = Date.now() + durationMs;
    const playerExemptions = this.exemptions.get(playerName) || {};
    playerExemptions[reason] = expires;
    this.exemptions.set(playerName, playerExemptions);
  }

  static isExempt(playerName, reason) {
    const playerExemptions = this.exemptions.get(playerName);
    if (!playerExemptions) return false;

    const expires = playerExemptions[reason];
    if (!expires) return false;

    if (Date.now() > expires) {
      delete playerExemptions[reason];
      if (Object.keys(playerExemptions).length === 0) {
        this.exemptions.delete(playerName);
      } else {
        this.exemptions.set(playerName, playerExemptions);
      }
      return false;
    }

    return true;
  }

  static isPlayerSoftExempt(player) {
    try {
      if (!player) return false;
      for (const tag of this.EVENT_EXEMPTION_TAGS) {
        if (player.hasTag?.(tag)) return true;
      }
      return false;
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "ExemptionManager.js", operation: "try-catch", category: "runtime" });
      return false;
    }
  }

  static clearPlayer(playerName) {
    this.exemptions.delete(playerName);
  }
}
