import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";
import { ROLE_RANK, Role } from "./RoleDefinition.js";

export class TargetProtectionPolicy {
  isProtectedTarget(actor, target, action, options = {}) {
    if (!actor || !target) return fail(AdminErrorCode.TARGET_PROTECTED);
    if (actor.principalId === target.principalId) return fail(AdminErrorCode.SELF_ACTION_DENIED);
    if (target.role === Role.OWNER) return fail(AdminErrorCode.TARGET_PROTECTED);
    const actorRank = ROLE_RANK[actor.role] ?? -1;
    const targetRank = ROLE_RANK[target.role] ?? 0;
    if (target.role && targetRank > actorRank) return fail(AdminErrorCode.TARGET_ROLE_TOO_HIGH);
    if (target.role && targetRank === actorRank && options.allowEqualRank !== true) return fail(AdminErrorCode.TARGET_ROLE_TOO_HIGH);
    if (action === "owner.transfer" || action === "owner.revoke") return fail(AdminErrorCode.TARGET_PROTECTED);
    return ok(true);
  }
}
