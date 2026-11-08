import { PlayerPermissionLevel } from "@minecraft/server";
import { constantTimeEqual, sha256 } from "../shared/Crypto.js";
import { sanitizeText } from "../shared/Validation.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";

const NONCE_USED_KEY = "fcx_admin:owner_nonce_used_v1";

export class OwnerEnrollmentService {
  constructor(store, provisioning, registry, identity, audit) {
    this.store = store;
    this.provisioning = provisioning;
    this.registry = registry;
    this.identity = identity;
    this.audit = audit;
  }

  isExternalOperator(player) {
    try {
      const level = player?.playerPermissionLevel;
      return level === PlayerPermissionLevel.Operator || level === 2 || level === "Operator";
    } catch { return false; }
  }

  enroll(player, nonce) {
    const provisionalActor = {
      principalId: `PROVISIONING:${sha256(String(player?.id ?? "")).slice(0, 16)}`,
      playerNameSnapshot: sanitizeText(player?.name ?? "Unknown", 64),
      role: "UNREGISTERED",
      player
    };
    const context = this.audit.createContext(provisionalActor, "owner.enroll", "COMMAND");
    const idempotencyKey = sha256(`owner.enroll|${String(player?.id ?? "")}|${Math.floor(Date.now() / 30_000)}`);
    const deny = (code, reason) => {
      const event = this.audit.buildEvent(context, provisionalActor, undefined, "owner.enroll", {}, "", "DENIED", reason, "REJECTED", code);
      this.audit.persistIntent(context, event, sha256(`owner.enroll.denied|${context.correlationId}`));
      this.audit.persistResult(event);
      if (code === AdminErrorCode.CAPABILITY_DENIED) this.audit.alert("OWNER_ENROLLMENT_DENIED", "CRITICAL", { reason });
      return fail(code);
    };
    if (this.registry.ownerConfigured()) return deny(AdminErrorCode.TARGET_PROTECTED, "owner_already_configured");
    if (!this.provisioning?.enabled) return deny(AdminErrorCode.OWNER_NOT_CONFIGURED, "owner_provisioning_disabled");
    if (!Number.isFinite(this.provisioning.expiresAt) || Date.now() > this.provisioning.expiresAt) return deny(AdminErrorCode.OWNER_NOT_CONFIGURED, "owner_nonce_expired");
    if (!this.isExternalOperator(player)) return deny(AdminErrorCode.CAPABILITY_DENIED, "external_operator_required");
    if (this.store.get(NONCE_USED_KEY)) return deny(AdminErrorCode.TOKEN_REVOKED, "owner_nonce_already_used");
    const providedHash = sha256(String(nonce ?? ""));
    if (!constantTimeEqual(providedHash, String(this.provisioning.nonceHash ?? ""))) return deny(AdminErrorCode.CAPABILITY_DENIED, "owner_nonce_invalid");

    const intent = this.audit.buildEvent(context, provisionalActor, undefined, "owner.enroll", {}, "", "ALLOWED", "local_operator_and_nonce_verified", "SUCCESS");
    const persisted = this.audit.persistIntent(context, intent, idempotencyKey);
    if (!persisted.ok) {
      console.warn(`[FCX_ADMIN_OWNER_ENROLL_DEBUG] ${JSON.stringify({ stage: "persist_intent", ok: false, error: String(persisted.error ?? ""), duplicate: Boolean(persisted.duplicate) })}`);
      return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
    }
    const counter = this.registry.nextTokenCounter();
    const token = this.identity.provisionToken(player, counter);
    if (!token.ok) {
      this.audit.persistResult({ ...intent, timestamp: Date.now(), result: "FAILED", errorCode: token.code });
      return token;
    }
    let ownerPersisted = false;
    try {
      if (!this.registry.enrollOwner(token.value.principalId, token.value.bindingHash, provisionalActor.playerNameSnapshot)) throw new Error("owner_registry_write_failed");
      ownerPersisted = true;
      this.store.set(NONCE_USED_KEY, providedHash);
      if (!constantTimeEqual(String(this.store.get(NONCE_USED_KEY) ?? ""), providedHash)) throw new Error("owner_nonce_invalidation_failed");
      const result = this.audit.persistResult({ ...intent, timestamp: Date.now(), actorId: token.value.principalId, actorRoleSnapshot: "OWNER", result: "SUCCESS" });
      if (!result.ok) {
        this.registry.setLockdown(true);
        console.warn(`[FCX_ADMIN_ALERT_V1] ${JSON.stringify({ schemaVersion: 1, timestamp: Date.now(), type: "OWNER_RESULT_AUDIT_FAILED", severity: "CRITICAL", details: { lockdown: true } })}`);
        console.warn(`[FCX_ADMIN_OWNER_ENROLL_DEBUG] ${JSON.stringify({ stage: "persist_result", ok: false, error: String(result.error ?? ""), duplicate: Boolean(result.duplicate) })}`);
        return fail(AdminErrorCode.AUDIT_PERSISTENCE_FAILED);
      }
      this.audit.alert("OWNER_CONFIGURED", "CRITICAL", { principalIdPrefix: token.value.principalId.slice(0, 16), lockdown: true });
      return ok({ principalId: token.value.principalId });
    } catch (error) {
      if (!ownerPersisted) this.identity.revokePlayerToken(player);
      else this.registry.setLockdown(true);
      this.audit.persistResult({ ...intent, timestamp: Date.now(), result: "FAILED", errorCode: AdminErrorCode.ACTION_FAILED });
      return fail(AdminErrorCode.ACTION_FAILED, "No se pudo registrar al propietario.", String(error));
    }
  }
}
