import { sha256 } from "../shared/Crypto.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";

export class AdminSessionInvalidator {
  constructor(registry, ttlMs) {
    this.registry = registry;
    this.ttlMs = ttlMs;
    this.pending = new Map();
    this.counter = 0;
  }

  create(actor, action, targetEntityId, payload) {
    this.counter += 1;
    const now = Date.now();
    const confirmationId = sha256(`${actor.principalId}|${action}|${targetEntityId}|${now}|${this.counter}`).slice(0, 32);
    this.pending.set(confirmationId, {
      confirmationId,
      actorPrincipalId: actor.principalId,
      actorEntityId: actor.entityIdSnapshot,
      action,
      targetEntityId: String(targetEntityId ?? ""),
      payload,
      policyVersion: this.registry.policyVersion(),
      expiresAt: now + this.ttlMs
    });
    return confirmationId;
  }

  consume(confirmationId, actor, targetEntityId, now = Date.now()) {
    const pending = this.pending.get(confirmationId);
    this.pending.delete(confirmationId);
    if (!pending || pending.expiresAt < now) return fail(AdminErrorCode.ACTION_CONFIRMATION_EXPIRED);
    if (pending.actorPrincipalId !== actor.principalId) return fail(AdminErrorCode.ADMIN_SESSION_REVOKED);
    if (pending.targetEntityId !== String(targetEntityId ?? "")) return fail(AdminErrorCode.PLAYER_NOT_FOUND);
    if (!this.registry.findActiveByPrincipalId(actor.principalId)) return fail(AdminErrorCode.ADMIN_SESSION_REVOKED);
    return ok(pending);
  }

  invalidatePrincipal(principalId) {
    for (const [key, pending] of this.pending) if (pending.actorPrincipalId === principalId) this.pending.delete(key);
  }

  invalidateAll() { this.pending.clear(); }
}
