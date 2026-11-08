import { sha256 } from "../shared/Crypto.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail } from "../shared/AdminResult.js";

export class AdminActionExecutor {
  constructor(config, identity, authorization, audit, rateLimiter, anomaly) {
    this.config = config;
    this.identity = identity;
    this.authorization = authorization;
    this.audit = audit;
    this.rateLimiter = rateLimiter;
    this.anomaly = anomaly;
  }

  fallbackActor(player) {
    let entityId = "";
    let name = "Unknown";
    try { entityId = String(player?.id ?? ""); name = String(player?.name ?? "Unknown"); } catch {}
    return { principalId: `UNREGISTERED:${sha256(entityId).slice(0, 16)}`, playerNameSnapshot: name, role: "PLAYER", entityIdSnapshot: entityId, player };
  }

  rejected(context, actor, target, request, code, reason) {
    const event = this.audit.buildEvent(context, actor, target, request.action, request.parameters, request.reason, "DENIED", reason, "REJECTED", code);
    const key = sha256(`denied|${context.correlationId}`);
    this.audit.persistIntent(context, event, key);
    this.audit.persistResult(event);
    if (actor.role !== "PLAYER") this.anomaly?.record(actor.principalId, code === AdminErrorCode.ROLE_ESCALATION_DENIED ? "SELF_ESCALATION" : "DENIED", target?.principalId);
    return fail(code);
  }

  prepare(request) {
    const resolved = this.identity.resolve(request.actorPlayer);
    const actor = resolved.ok ? { ...resolved.value, player: request.actorPlayer } : this.fallbackActor(request.actorPlayer);
    const preparedAction = `${request.action}.confirmation`;
    const preparedRequest = { ...request, action: preparedAction };
    const context = this.audit.createContext(actor, preparedAction, request.source ?? "COMMAND");
    if (!resolved.ok) return this.rejected(context, actor, request.target, preparedRequest, resolved.code, "actor_identity_denied");
    const decision = this.authorization.authorize(actor, request.capability, request.target, { action: request.action });
    if (!decision.ok) return this.rejected(context, actor, request.target, preparedRequest, decision.code, "authorization_denied");
    const validation = request.validate?.(actor, request.target) ?? { ok: true };
    if (!validation.ok) return this.rejected(context, actor, request.target, preparedRequest, validation.code ?? AdminErrorCode.ACTION_FAILED, "validation_denied");
    const event = this.audit.buildEvent(context, actor, request.target, preparedAction, request.parameters, request.reason, "ALLOWED", "confirmation_prepared", "SUCCESS");
    const key = sha256(`confirmation|${context.correlationId}`);
    const intent = this.audit.persistIntent(context, event, key);
    if (!intent.ok && this.config.requireAuditPersistence) return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
    if (!intent.ok) this.audit.alert("AUDIT_INTENT_PERSISTENCE_FAILED", "CRITICAL", { action: preparedAction, correlationId: context.correlationId });
    if (!this.audit.persistResult(event).ok && this.config.requireAuditPersistence) return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
    return { ok: true, value: actor };
  }

  execute(request) {
    const resolved = this.identity.resolve(request.actorPlayer);
    const actor = resolved.ok ? { ...resolved.value, player: request.actorPlayer } : this.fallbackActor(request.actorPlayer);
    const context = this.audit.createContext(actor, request.action, request.source ?? "COMMAND");
    if (!resolved.ok) return this.rejected(context, actor, request.target, request, resolved.code, "actor_identity_denied");
    let decision = this.authorization.authorize(actor, request.capability, request.target, { action: request.action });
    if (!decision.ok) return this.rejected(context, actor, request.target, request, decision.code, "authorization_denied");
    const validation = request.validate?.(actor, request.target) ?? { ok: true };
    if (!validation.ok) return this.rejected(context, actor, request.target, request, validation.code ?? AdminErrorCode.ACTION_FAILED, "validation_denied");
    if (request.rateAction) {
      const rate = this.rateLimiter.attempt(actor.principalId, request.rateAction);
      if (!rate.ok) return this.rejected(context, actor, request.target, request, AdminErrorCode.RATE_LIMIT_EXCEEDED, rate.reason ?? "rate_limit_exceeded");
    }
    const idempotencyKey = request.idempotencyKey ?? sha256([
      actor.principalId, request.action, request.target?.principalId ?? "",
      JSON.stringify(request.parameters ?? {}), request.reason ?? "", Math.floor(Date.now() / 10_000)
    ].join("|"));
    const intent = this.audit.buildEvent(context, actor, request.target, request.action, request.parameters, request.reason, "ALLOWED", "authorized_and_validated", "SUCCESS");
    const persisted = this.audit.persistIntent(context, intent, idempotencyKey);
    if (persisted.duplicate) {
      const duplicateEvent = { ...intent, timestamp: Date.now(), result: "REJECTED", errorCode: AdminErrorCode.DUPLICATE_ACTION, decisionReason: "duplicate_idempotency_key" };
      this.audit.persistIntent(context, duplicateEvent, sha256(`${idempotencyKey}|retry|${context.correlationId}`));
      this.audit.persistResult(duplicateEvent);
      return { ok: true, value: { duplicate: true }, correlationId: context.correlationId };
    }
    if (!persisted.ok && this.config.requireAuditPersistence) return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
    if (!persisted.ok) this.audit.alert("AUDIT_INTENT_PERSISTENCE_FAILED", "CRITICAL", { action: request.action, correlationId: context.correlationId });
    try {
      const currentActorResult = this.identity.resolve(request.actorPlayer);
      if (!currentActorResult.ok) throw Object.assign(new Error("admin_session_changed"), { code: AdminErrorCode.ADMIN_SESSION_REVOKED });
      const currentActor = { ...currentActorResult.value, player: request.actorPlayer };
      decision = this.authorization.authorize(currentActor, request.capability, request.target, { action: request.action });
      if (!decision.ok) throw Object.assign(new Error("authorization_changed"), { code: decision.code });
      if (typeof request.targetStillValid === "function" && !request.targetStillValid()) throw Object.assign(new Error("target_changed"), { code: AdminErrorCode.PLAYER_NOT_FOUND });
      if (this.config.auditOnlyMode || !this.config.enforcementEnabled) {
        const dryRunEvent = { ...intent, timestamp: Date.now(), result: "SUCCESS", decisionReason: "audit_only_no_mutation" };
        if (!this.audit.persistResult(dryRunEvent).ok && this.config.requireAuditPersistence) return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
        return { ok: true, value: { auditOnly: true }, correlationId: context.correlationId };
      }
      const value = request.mutate(currentActor, request.target, { auditId: context.auditId, correlationId: context.correlationId });
      const resultEvent = { ...intent, timestamp: Date.now(), result: "SUCCESS", decisionReason: "mutation_completed" };
      const resultPersisted = this.audit.persistResult(resultEvent);
      if (!resultPersisted.ok) {
        this.audit.alert("AUDIT_RESULT_PERSISTENCE_FAILED", "CRITICAL", { correlationId: context.correlationId, action: request.action });
      }
      return { ok: true, value, correlationId: context.correlationId };
    } catch (error) {
      const code = error?.code ?? AdminErrorCode.ACTION_FAILED;
      this.audit.persistResult({ ...intent, timestamp: Date.now(), result: "FAILED", errorCode: code, decisionReason: "mutation_failed" });
      this.audit.alert("ADMIN_ACTION_FAILED", "CRITICAL", { correlationId: context.correlationId, action: request.action, errorCode: code });
      return fail(code);
    }
  }
}
