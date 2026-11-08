import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";
import { Capability, MUTATING_CAPABILITIES } from "./Capability.js";
import { isKnownRole, Role } from "./RoleDefinition.js";

export class AuthorizationService {
  constructor(config, registry, targetPolicy) {
    this.config = config;
    this.registry = registry;
    this.targetPolicy = targetPolicy;
  }

  capabilitiesFor(role) {
    if (!isKnownRole(role)) return new Set();
    return new Set(this.config.roleDefinitions[role] ?? []);
  }

  authorize(actor, capability, target = undefined, options = {}) {
    if (!this.config.enabled) return fail(AdminErrorCode.ADMIN_DISABLED);
    if (!actor || !actor.principalId || !isKnownRole(actor.role)) return fail(AdminErrorCode.ACTOR_NOT_REGISTERED);
    const isFallbackOwner = actor.role === Role.OWNER || actor.identitySource === "OPERATOR_FALLBACK";
    const current = this.registry.findActiveByPrincipalId(actor.principalId);
    if (!current && !isFallbackOwner) return fail(AdminErrorCode.ADMIN_SESSION_REVOKED);
    if (current && current.role !== actor.role && !isFallbackOwner) return fail(AdminErrorCode.ADMIN_SESSION_REVOKED);
    if (this.registry.isSuspended(actor.principalId)) return fail(AdminErrorCode.ADMIN_SESSION_REVOKED);
    if (this.registry.isLocked() && actor.role !== Role.OWNER && MUTATING_CAPABILITIES.has(capability)) {
      return fail(AdminErrorCode.ADMIN_LOCKDOWN_ACTIVE);
    }
    if (!this.capabilitiesFor(actor.role).has(capability)) return fail(AdminErrorCode.CAPABILITY_DENIED);
    if (capability === Capability.PLAYER_PERMABAN && actor.role !== Role.OWNER && !this.config.allowPermanentBans) {
      return fail(AdminErrorCode.CAPABILITY_DENIED);
    }
    if (target) {
      const protectedDecision = this.targetPolicy.isProtectedTarget(actor, target, options.action ?? capability, options);
      if (!protectedDecision.ok) return protectedDecision;
    }
    return ok({ role: actor.role, capability, policyVersion: this.registry.policyVersion() });
  }

  canAssignRole(actor, target, desiredRole) {
    const base = this.authorize(actor, Capability.ADMIN_ROLES_ASSIGN, target, { action: "role.assign" });
    if (!base.ok) return base;
    if (!isKnownRole(desiredRole) || desiredRole === Role.OWNER) return fail(AdminErrorCode.ROLE_ESCALATION_DENIED);
    const actorCaps = this.capabilitiesFor(actor.role);
    const desiredCaps = this.capabilitiesFor(desiredRole);
    for (const capability of desiredCaps) if (!actorCaps.has(capability)) return fail(AdminErrorCode.ROLE_ESCALATION_DENIED);
    return ok(true);
  }
}
