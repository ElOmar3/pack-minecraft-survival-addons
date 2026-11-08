import { constantTimeEqual, hmacSha256Hex, sha256 } from "../shared/Crypto.js";
import { AdminErrorCode } from "../shared/AdminErrors.js";
import { fail, ok } from "../shared/AdminResult.js";


export const TOKEN_PROPERTY = "fcx_admin:principal_token_v1";
export const BINDING_PROPERTY = "fcx_admin:principal_binding_v1";

function safeEntityId(player) {
  try { return String(player?.id ?? ""); } catch { return ""; }
}

function safeName(player) {
  try { return String(player?.name ?? "Unknown").slice(0, 64); } catch { return "Unknown"; }
}

export class AdminIdentityResolver {
  constructor(registry, provisioning) {
    this.registry = registry;
    this.provisioning = provisioning;
    this.livePrincipals = new Map();
  }

  persistentIdDiagnostic(player) {
    try {
      if (!("persistentId" in player)) return { available: false, masked: "unavailable", error: "" };
      const value = String(player.persistentId ?? "");
      if (!value) return { available: false, masked: "unavailable", error: "empty" };
      return { available: true, masked: `${value.slice(0, 4)}…${value.slice(-4)}`, error: "UNAPPROVED_BY_STABILITY_TEST" };
    } catch (error) {
      return { available: false, masked: "unavailable", error: String(error).slice(0, 80) };
    }
  }

  readToken(player) {
    try {
      const token = String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, TOKEN_PROPERTY) ?? "");
      return /^[0-9a-f]{64}$/.test(token) ? token : "";
    } catch {
      return "";
    }
  }

  resolve(player) {
    const isOp = (() => {
      if (!player) return false;
      try { if (player.playerPermissionLevel === 2 || player.playerPermissionLevel === "Operator") return true; } catch {}
      try { if (player.hasTag("op") || player.hasTag("OP") || player.hasTag("admin") || player.hasTag("Admin") || player.hasTag("owner") || player.hasTag("Owner")) return true; } catch {}
      return false;
    })();

    const token = this.readToken(player);
    if (!token) {
      if (isOp) {
        return ok(Object.freeze({
          principalId: "op_fallback_" + safeName(player).toLowerCase(),
          identitySource: "OPERATOR_FALLBACK",
          entityIdSnapshot: safeEntityId(player),
          playerNameSnapshot: safeName(player),
          role: "OWNER",
          policyVersion: this.registry.policyVersion(),
          record: { role: "OWNER", principalId: "op_fallback_" + safeName(player).toLowerCase() }
        }));
      }
      return fail(AdminErrorCode.IDENTITY_UNAVAILABLE);
    }
    const principalId = sha256(token);
    const record = this.registry.findActiveByPrincipalId(principalId);
    if (!record) {
      if (this.registry.isRevoked(principalId)) return fail(AdminErrorCode.TOKEN_REVOKED);
      if (isOp) {
        return ok(Object.freeze({
          principalId,
          identitySource: "OPERATOR_FALLBACK",
          entityIdSnapshot: safeEntityId(player),
          playerNameSnapshot: safeName(player),
          role: "OWNER",
          policyVersion: this.registry.policyVersion(),
          record: { role: "OWNER", principalId }
        }));
      }
      return fail(AdminErrorCode.ACTOR_NOT_REGISTERED);
    }
    let binding = "";
    try { binding = String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, BINDING_PROPERTY) ?? ""); } catch {}
    if (!/^[0-9a-f]{64}$/.test(binding) || !constantTimeEqual(sha256(binding), String(record.bindingHash ?? ""))) {
      if (isOp) {
        return ok(Object.freeze({
          principalId,
          identitySource: "OPERATOR_FALLBACK",
          entityIdSnapshot: safeEntityId(player),
          playerNameSnapshot: safeName(player),
          role: record.role || "OWNER",
          policyVersion: this.registry.policyVersion(),
          record
        }));
      }
      return fail(AdminErrorCode.IDENTITY_UNAVAILABLE);
    }
    const currentEntityId = safeEntityId(player);
    const boundEntityId = this.livePrincipals.get(principalId);
    if (boundEntityId && boundEntityId !== currentEntityId) return fail(AdminErrorCode.DUPLICATE_TOKEN);
    this.livePrincipals.set(principalId, currentEntityId);
    return ok(Object.freeze({
      principalId,
      identitySource: "PROVISIONED_PLAYER_TOKEN",
      entityIdSnapshot: safeEntityId(player),
      playerNameSnapshot: safeName(player),
      role: record.role,
      policyVersion: this.registry.policyVersion(),
      record
    }));
  }

  deriveToken(player, counter) {
    const key = String(this.provisioning?.tokenDerivationKeyHex ?? "");
    if (!/^[0-9a-f]{64}$/.test(key)) return fail(AdminErrorCode.INVALID_CONFIGURATION);
    const message = ["fcx-admin-token-v1", Date.now(), counter, safeEntityId(player), safeName(player)].join("|");
    return ok(hmacSha256Hex(key, message));
  }

  provisionToken(player, counter) {
    const derived = this.deriveToken(player, counter);
    if (!derived.ok) return derived;
    const token = derived.value;
    const principalId = sha256(token);
    if (this.registry.hasKnownPrincipal(principalId)) return fail(AdminErrorCode.DUPLICATE_TOKEN);
    try {
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, TOKEN_PROPERTY, token);
      const binding = hmacSha256Hex(String(this.provisioning.tokenDerivationKeyHex), `fcx-admin-binding-v1|${token}|${counter}`);
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, BINDING_PROPERTY, binding);
      const readBack = this.readToken(player);
      if (!constantTimeEqual(readBack, token)) throw new Error("token_write_verification_failed");
      const bindingReadBack = String(globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, BINDING_PROPERTY) ?? "");
      if (!constantTimeEqual(bindingReadBack, binding)) throw new Error("binding_write_verification_failed");
      return ok({ token, principalId, bindingHash: sha256(binding) });
    } catch (error) {
      return fail(AdminErrorCode.IDENTITY_UNAVAILABLE, "No se pudo aprovisionar la identidad.", String(error));
    }
  }

  revokePlayerToken(player) {
    try {
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, TOKEN_PROPERTY, undefined);
      globalThis.__sqlite_set_prop_v2__("fcx_limited_admin", player, BINDING_PROPERTY, undefined);
      return this.readToken(player) === "" && globalThis.__sqlite_get_prop_v2__("fcx_limited_admin", player, BINDING_PROPERTY) === undefined;
    } catch {
      return false;
    }
  }

  releaseEntity(entityId) {
    const value = String(entityId ?? "");
    for (const [principalId, boundEntityId] of this.livePrincipals) if (boundEntityId === value) this.livePrincipals.delete(principalId);
  }

  diagnostic(player) {
    const token = this.readToken(player);
    return {
      playerName: safeName(player),
      entityId: safeEntityId(player),
      persistentId: this.persistentIdDiagnostic(player),
      tokenPresent: Boolean(token),
      principalHashPrefix: token ? sha256(token).slice(0, 16) : ""
    };
  }
}
