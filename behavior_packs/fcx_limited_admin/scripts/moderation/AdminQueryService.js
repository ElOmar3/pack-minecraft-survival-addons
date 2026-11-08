import { Capability } from "../authorization/Capability.js";
import { sanitizeText } from "../shared/Validation.js";

export class AdminQueryService {
  constructor(executor, journal, registry, moderation) {
    this.executor = executor;
    this.journal = journal;
    this.registry = registry;
    this.moderation = moderation;
  }

  panel(actorPlayer, source = "COMMAND") {
    return this.executor.execute({ actorPlayer, capability: Capability.ADMIN_PANEL_VIEW, action: "admin.panel.view", source, parameters: {}, reason: "panel", mutate: () => ({ locked: this.registry.isLocked() }) });
  }

  audit(actorPlayer, source = "COMMAND") {
    return this.executor.execute({ actorPlayer, capability: Capability.AUDIT_VIEW, action: "audit.view", source, parameters: {}, reason: "audit_query", mutate: () => this.journal.readRecent(25) });
  }

  reports(actorPlayer, source = "COMMAND") {
    return this.executor.execute({ actorPlayer, capability: Capability.REPORTS_VIEW, action: "reports.view", source, parameters: {}, reason: "reports_query", mutate: () => [] });
  }

  roles(actorPlayer, source = "COMMAND") {
    return this.executor.execute({
      actorPlayer, capability: Capability.ADMIN_ROLES_VIEW, action: "admin.roles.view", source, parameters: {}, reason: "roles_query",
      mutate: () => this.registry.snapshot().administrators.map((record) => ({
        principalIdPartial: `${record.principalId.slice(0, 8)}…${record.principalId.slice(-4)}`,
        role: record.role, status: record.status, nameSnapshot: sanitizeText(record.nameSnapshot, 64)
      }))
    });
  }

  inspect(actorPlayer, targetPlayer, source = "COMMAND") {
    const target = this.moderation.describeTarget(targetPlayer);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.PLAYER_INSPECT, action: "player.inspect", source,
      parameters: {}, reason: "moderation_inspection", targetStillValid: this.moderation.targetStillValid(target),
      mutate: () => ({
        name: target.playerNameSnapshot,
        principalIdPartial: `${target.principalId.slice(0, 8)}…${target.principalId.slice(-4)}`,
        dimension: String(targetPlayer.dimension?.id ?? "unknown"),
        location: { x: Math.round(targetPlayer.location.x), y: Math.round(targetPlayer.location.y), z: Math.round(targetPlayer.location.z) },
        role: target.role ?? "PLAYER"
      })
    });
  }
}
