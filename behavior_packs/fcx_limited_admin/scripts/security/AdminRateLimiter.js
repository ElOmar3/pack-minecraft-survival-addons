import { constantTimeEqual } from "../shared/Crypto.js";

const RATE_KEY = "fcx_admin:rate_limits_v1";

export class AdminRateLimiter {
  constructor(store, config, registry, audit) {
    this.store = store;
    this.config = config;
    this.registry = registry;
    this.audit = audit;
  }

  load() {
    const raw = this.store.get(RATE_KEY);
    if (raw === undefined) return { schemaVersion: 1, buckets: {} };
    const parsed = JSON.parse(String(raw));
    if (parsed?.schemaVersion !== 1 || !parsed.buckets || typeof parsed.buckets !== "object" || Array.isArray(parsed.buckets)) throw new Error("rate_limit_state_invalid");
    for (const [key, timestamps] of Object.entries(parsed.buckets)) {
      if (key.length > 192 || !Array.isArray(timestamps) || timestamps.some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error("rate_limit_bucket_invalid");
    }
    return parsed;
  }

  save(state) {
    const serialized = JSON.stringify(state);
    this.store.set(RATE_KEY, serialized);
    if (!constantTimeEqual(String(this.store.get(RATE_KEY) ?? ""), serialized)) throw new Error("rate_limit_write_verification_failed");
  }

  attempt(principalId, action, now = Date.now()) {
    const limit = this.config.rateLimits[action];
    if (!limit) return { ok: false, reason: "rate_limit_configuration_missing" };
    try {
      const state = this.load();
      const key = `${principalId}:${action}`;
      const previous = Array.isArray(state.buckets[key]) ? state.buckets[key] : [];
      const recent = previous.filter((timestamp) => Number(timestamp) > now - limit.windowMs);
      recent.push(now);
      state.buckets[key] = recent.slice(-Math.max(limit.critical + 1, limit.limit + 1));
      for (const bucketKey of Object.keys(state.buckets)) if (!state.buckets[bucketKey].some((timestamp) => Number(timestamp) > now - 24 * 60 * 60_000)) delete state.buckets[bucketKey];
      this.save(state);
      const exceeded = recent.length > limit.limit;
      const critical = recent.length >= limit.critical;
      if (exceeded) {
        this.audit?.alert("RATE_LIMIT_EXCEEDED", critical ? "CRITICAL" : "WARNING", { principalId, action, count: recent.length, windowMs: limit.windowMs });
      }
      if (critical && this.config.automaticAdminSuspensionEnabled) {
        this.registry.suspend(principalId, now + this.config.anomalyDetection.suspensionMs);
      }
      return { ok: !exceeded, exceeded, critical, count: recent.length, retryAfterMs: Math.max(0, recent[0] + limit.windowMs - now) };
    } catch (error) {
      return { ok: false, reason: String(error) };
    }
  }
}
