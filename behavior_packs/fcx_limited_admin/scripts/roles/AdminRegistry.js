import { constantTimeEqual } from "../shared/Crypto.js";
import { Role, isKnownRole } from "../authorization/RoleDefinition.js";

const REGISTRY_KEY = "fcx_admin:registry_v1";
const MAX_REVOKED = 512;

function initialState(forceLocked) {
  return {
    schemaVersion: 1,
    policyVersion: 1,
    ownerPrincipalId: "",
    administrators: [],
    revokedPrincipalIds: [],
    tokenCounter: 0,
    adminSystemLocked: forceLocked !== false,
    suspendedUntil: {}
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class AdminRegistry {
  constructor(store, config) {
    this.store = store;
    this.config = config;
    this.state = initialState(config.adminSystemLocked);
    this.ready = false;
  }

  load() {
    try {
      const raw = this.store.get(REGISTRY_KEY);
      if (raw === undefined || raw === null) {
        this.ready = true;
        return { ok: true, created: true };
      }
      const parsed = typeof raw === "object" ? raw : JSON.parse(String(raw));
      if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.administrators) || !Array.isArray(parsed.revokedPrincipalIds)) throw new Error("registry_schema_invalid");
      if (!Number.isSafeInteger(parsed.policyVersion) || parsed.policyVersion < 1) throw new Error("policy_version_invalid");
      parsed.adminSystemLocked = Boolean(this.config.adminSystemLocked);
      this.state = parsed;
      this.ready = true;
      return { ok: true, created: false };
    } catch (error) {
      this.ready = false;
      return { ok: false, error: String(error) };
    }
  }

  persist(next) {
    const serialized = JSON.stringify(next);
    this.store.set(REGISTRY_KEY, serialized);
    const readBack = String(this.store.get(REGISTRY_KEY) ?? "");
    if (!constantTimeEqual(readBack, serialized)) throw new Error("registry_write_verification_failed");
    this.state = next;
  }

  mutate(callback) {
    const next = clone(this.state);
    const result = callback(next);
    if (result === false) return false;
    next.policyVersion += 1;
    this.persist(next);
    return result ?? true;
  }

  policyVersion() { return this.state.policyVersion; }
  ownerConfigured() { return Boolean(this.state.ownerPrincipalId) || Boolean(this.config?.ownerConfigured); }
  isLocked() { return Boolean(this.state.adminSystemLocked); }
  snapshot() { return clone(this.state); }

  nextTokenCounter() {
    let value = 0;
    this.mutate((state) => { state.tokenCounter += 1; value = state.tokenCounter; });
    return value;
  }

  findActiveByPrincipalId(principalId) {
    return this.state.administrators.find((record) => record.status === "ACTIVE" && constantTimeEqual(record.principalId, principalId));
  }

  hasKnownPrincipal(principalId) {
    return Boolean(this.state.administrators.some((record) => constantTimeEqual(record.principalId, principalId)) || this.isRevoked(principalId));
  }

  isRevoked(principalId) {
    return this.state.revokedPrincipalIds.some((value) => constantTimeEqual(value, principalId));
  }

  enrollOwner(principalId, bindingHash, nameSnapshot, now = Date.now()) {
    if (this.ownerConfigured() || this.hasKnownPrincipal(principalId)) return false;
    return this.mutate((state) => {
      state.ownerPrincipalId = principalId;
      state.administrators.push({
        principalId, bindingHash, role: Role.OWNER, status: "ACTIVE", nameSnapshot,
        provisionedAt: now, provisionedBy: "LOCAL_OWNER_ENROLLMENT", method: "ONE_TIME_NONCE", revision: 1
      });
      state.adminSystemLocked = true;
      return true;
    });
  }

  addAdministrator(principalId, bindingHash, role, nameSnapshot, actorPrincipalId, now = Date.now()) {
    if (!isKnownRole(role) || role === Role.OWNER || this.hasKnownPrincipal(principalId)) return false;
    return this.mutate((state) => {
      state.administrators.push({
        principalId, bindingHash, role, status: "ACTIVE", nameSnapshot,
        provisionedAt: now, provisionedBy: actorPrincipalId, method: "OWNER_ASSIGNMENT", revision: 1
      });
      return true;
    });
  }

  setRole(principalId, role, actorPrincipalId, now = Date.now()) {
    if (!isKnownRole(role) || role === Role.OWNER || constantTimeEqual(principalId, this.state.ownerPrincipalId)) return false;
    return this.mutate((state) => {
      const record = state.administrators.find((item) => item.status === "ACTIVE" && constantTimeEqual(item.principalId, principalId));
      if (!record) return false;
      record.role = role;
      record.updatedAt = now;
      record.updatedBy = actorPrincipalId;
      record.revision += 1;
      return true;
    });
  }

  revoke(principalId, actorPrincipalId, now = Date.now()) {
    if (constantTimeEqual(principalId, this.state.ownerPrincipalId)) return false;
    return this.mutate((state) => {
      const record = state.administrators.find((item) => item.status === "ACTIVE" && constantTimeEqual(item.principalId, principalId));
      if (!record) return false;
      record.status = "REVOKED";
      record.revokedAt = now;
      record.revokedBy = actorPrincipalId;
      record.revision += 1;
      state.revokedPrincipalIds.push(principalId);
      state.revokedPrincipalIds = state.revokedPrincipalIds.slice(-MAX_REVOKED);
      delete state.suspendedUntil[principalId];
      return true;
    });
  }

  setLockdown(locked) {
    return this.mutate((state) => { state.adminSystemLocked = Boolean(locked); return true; });
  }

  suspend(principalId, until) {
    if (constantTimeEqual(principalId, this.state.ownerPrincipalId)) return false;
    return this.mutate((state) => { state.suspendedUntil[principalId] = Math.max(Date.now(), Number(until) || 0); return true; });
  }

  isSuspended(principalId, now = Date.now()) {
    return Number(this.state.suspendedUntil[principalId] || 0) > now;
  }
}
