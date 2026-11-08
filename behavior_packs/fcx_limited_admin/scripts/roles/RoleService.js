import { Capability } from "../authorization/Capability.js";
import { isKnownRole, Role } from "../authorization/RoleDefinition.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";

export class RoleService {
  constructor(identity, registry, authorization, executor, sessionInvalidator, badges = undefined) {
    this.identity = identity;
    this.registry = registry;
    this.authorization = authorization;
    this.executor = executor;
    this.sessionInvalidator = sessionInvalidator;
    this.badges = badges;
  }

  targetDescriptor(player) {
    const resolved = this.identity.resolve(player);
    if (resolved.ok) return { ...resolved.value, player };
    return {
      principalId: `UNPROVISIONED:${String(player?.id ?? "")}`,
      entityIdSnapshot: String(player?.id ?? ""),
      playerNameSnapshot: String(player?.name ?? "Unknown"),
      role: undefined,
      player
    };
  }

  assign(actorPlayer, targetPlayer, desiredRole, source = "COMMAND") {
    const role = String(desiredRole ?? "").toUpperCase();
    const target = this.targetDescriptor(targetPlayer);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.ADMIN_ROLES_ASSIGN, action: "admin.roles.assign", source,
      reason: "role_assignment", parameters: { role }, rateAction: "roleChange",
      targetStillValid: () => String(targetPlayer?.id ?? "") === target.entityIdSnapshot,
      validate: (actor) => {
        if (!isKnownRole(role) || role === Role.OWNER) return fail(AdminErrorCode.ROLE_ESCALATION_DENIED);
        return this.authorization.canAssignRole(actor, target, role);
      },
      mutate: (actor) => {
        const existing = this.identity.resolve(targetPlayer);
        if (existing.ok) {
          if (!this.registry.setRole(existing.value.principalId, role, actor.principalId)) throw new Error("role_update_failed");
          this.sessionInvalidator.invalidatePrincipal(existing.value.principalId);
          this.badges?.syncPlayer(targetPlayer);
          return { principalId: existing.value.principalId, role, updated: true };
        }
        const counter = this.registry.nextTokenCounter();
        const token = this.identity.provisionToken(targetPlayer, counter);
        if (!token.ok) throw Object.assign(new Error("token_provision_failed"), { code: token.code });
        if (!this.registry.addAdministrator(token.value.principalId, token.value.bindingHash, role, String(targetPlayer.name), actor.principalId)) {
          this.identity.revokePlayerToken(targetPlayer);
          throw new Error("administrator_registry_write_failed");
        }
        this.badges?.syncPlayer(targetPlayer);
        return { principalId: token.value.principalId, role, updated: false };
      }
    });
  }

  revoke(actorPlayer, targetPlayer, source = "COMMAND") {
    const targetResult = this.identity.resolve(targetPlayer);
    const target = targetResult.ok ? { ...targetResult.value, player: targetPlayer } : this.targetDescriptor(targetPlayer);
    return this.executor.execute({
      actorPlayer, target, capability: Capability.ADMIN_ROLES_REVOKE, action: "admin.roles.revoke", source,
      reason: "immediate_revocation", parameters: {}, rateAction: "roleChange",
      targetStillValid: () => String(targetPlayer?.id ?? "") === target.entityIdSnapshot,
      validate: () => targetResult.ok ? ok(true) : fail(AdminErrorCode.ACTOR_NOT_REGISTERED),
      mutate: (actor) => {
        if (!this.registry.revoke(target.principalId, actor.principalId)) throw new Error("administrator_revocation_failed");
        this.identity.revokePlayerToken(targetPlayer);
        this.sessionInvalidator.invalidatePrincipal(target.principalId);
        this.badges?.syncPlayer(targetPlayer);
        return { principalId: target.principalId, revoked: true };
      }
    });
  }
}
