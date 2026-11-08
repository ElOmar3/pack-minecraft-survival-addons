import { Capability } from "../authorization/Capability.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";
import { sanitizeReason } from "../shared/Validation.js";

export class ObservationService {
  constructor(config, identity, moderation, executor) {
    this.config = config;
    this.identity = identity;
    this.moderation = moderation;
    this.executor = executor;
    this.sessions = new Map();
  }

  teleportTo(actorPlayer, targetPlayer, reason, source = "COMMAND") {
    const target = this.moderation.describeTarget(targetPlayer);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_TELEPORT_SELF, action: "player.teleport.self_to_player", source,
      reason: safeReason, parameters: {}, rateAction: "teleport", targetStillValid: this.moderation.targetStillValid(target),
      validate: () => safeReason ? ok(true) : fail(AdminErrorCode.ACTION_FAILED),
      mutate: () => actorPlayer.teleport(targetPlayer.location, { dimension: targetPlayer.dimension })
    });
  }

  spectate(actorPlayer, targetPlayer, reason, source = "COMMAND") {
    const target = this.moderation.describeTarget(targetPlayer);
    const safeReason = sanitizeReason(reason, this.config.maximumReasonLength);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_SPECTATE, action: "player.spectate", source,
      reason: safeReason, parameters: {}, rateAction: "teleport", targetStillValid: this.moderation.targetStillValid(target),
      validate: () => safeReason ? ok(true) : fail(AdminErrorCode.ACTION_FAILED),
      mutate: (actor) => {
        const originalMode = String(actorPlayer.getGameMode?.() ?? "survival");
        const originalLocation = { x: actorPlayer.location.x, y: actorPlayer.location.y, z: actorPlayer.location.z };
        const originalDimension = actorPlayer.dimension;
        if (typeof actorPlayer.setGameMode === "function") {
          try { actorPlayer.setGameMode("spectator"); } catch { actorPlayer.runCommand("gamemode spectator @s"); }
        } else {
          actorPlayer.runCommand("gamemode spectator @s");
        }
        actorPlayer.teleport(targetPlayer.location, { dimension: targetPlayer.dimension });
        this.sessions.set(actor.principalId, { originalMode, originalLocation, originalDimension });
        return { spectating: target.playerNameSnapshot };
      }
    });
  }

  stop(actorPlayer, source = "COMMAND") {
    const actor = this.identity.resolve(actorPlayer);
    if (!actor.ok) return actor;
    const session = this.sessions.get(actor.value.principalId);
    if (!session) return fail(AdminErrorCode.ACTION_FAILED);
    return this.executor.execute({
      actorPlayer, capability: Capability.PLAYER_SPECTATE, action: "player.spectate.stop", source,
      reason: "spectate_complete", parameters: {},
      mutate: () => {
        const allowedModes = new Set(["survival","creative","adventure","spectator"]);
        const mode = allowedModes.has(session.originalMode) ? session.originalMode : "survival";
        if (typeof actorPlayer.setGameMode === "function") {
          try { actorPlayer.setGameMode(mode); } catch { actorPlayer.runCommand(`gamemode ${mode} @s`); }
        } else {
          actorPlayer.runCommand(`gamemode ${mode} @s`);
        }
        actorPlayer.teleport(session.originalLocation, { dimension: session.originalDimension });
        this.sessions.delete(actor.value.principalId);
        return { stopped: true };
      }
    });
  }
}
