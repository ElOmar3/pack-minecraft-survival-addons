import { constantTimeEqual } from "../shared/Crypto.js";

const ANOMALY_KEY = "fcx_admin:anomaly_v1";

export class AdminAnomalyDetector {
  constructor(store, config, registry, audit) {
    this.store = store;
    this.config = config;
    this.registry = registry;
    this.audit = audit;
  }

  record(principalId, type, targetId = "", now = Date.now()) {
    if (!this.config.anomalyDetectionEnabled) return { suspicious: false };
    try {
      const raw = this.store.get(ANOMALY_KEY);
      const state = raw ? globalThis.__sqlite_read_json_v3__(raw) : { schemaVersion: 1, actors: {} };
      const cutoff = now - this.config.anomalyDetection.windowMs;
      const events = (Array.isArray(state.actors[principalId]) ? state.actors[principalId] : [])
        .filter((event) => Number(event.at) > cutoff);
      events.push({ at: now, type: String(type).slice(0, 48), targetId: String(targetId).slice(0, 96) });
      state.actors[principalId] = events.slice(-128);
      const serialized = JSON.stringify(state);
      this.store.set(ANOMALY_KEY, serialized);
      if (!constantTimeEqual(String(this.store.get(ANOMALY_KEY) ?? ""), serialized)) throw new Error("anomaly_write_verification_failed");
      const denials = events.filter((event) => event.type === "DENIED").length;
      const selfEscalations = events.filter((event) => event.type === "SELF_ESCALATION").length;
      const distinctTargets = new Set(events.map((event) => event.targetId).filter(Boolean)).size;
      const suspicious = denials >= this.config.anomalyDetection.denialLimit || selfEscalations >= 2 || distinctTargets >= this.config.anomalyDetection.distinctTargetLimit;
      if (suspicious) {
        this.audit?.alert("ADMIN_ANOMALY_DETECTED", "CRITICAL", { principalId, denials, selfEscalations, distinctTargets });
        if (this.config.automaticAdminSuspensionEnabled) this.registry.suspend(principalId, now + this.config.anomalyDetection.suspensionMs);
        if (this.config.anomalyDetection.activateGlobalLockdown) this.registry.setLockdown(true);
      }
      return { suspicious, denials, selfEscalations, distinctTargets };
    } catch (error) {
      this.audit?.alert("ANOMALY_PERSISTENCE_FAILED", "CRITICAL", { error: String(error).slice(0, 160) });
      return { suspicious: true, error: String(error) };
    }
  }
}
