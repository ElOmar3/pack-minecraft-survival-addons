const PREFIX = "[AC_EVIDENCE_V1]";

function normalizeFeatures(features) {
  if (!Array.isArray(features)) return [];
  return features.filter((feature) => feature !== null && feature !== undefined && feature !== "");
}

function featureKey(feature) {
  return typeof feature === "string" ? feature : JSON.stringify(feature);
}

export class EvidenceRateLimiter {
  constructor({ cooldownMs = 30000, maxEntries = 2048, now = () => Date.now() } = {}) {
    this.cooldownMs = cooldownMs;
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  prepare(payload) {
    const type = String(payload?.type || "").trim();
    const player = String(payload?.player || "").trim();
    const features = normalizeFeatures(payload?.features);
    if (!type || !player || features.length === 0) return null;

    const now = this.now();
    const key = `${type}:${player}`;
    const previous = this.entries.get(key);
    if (previous && now - previous.lastEmittedAt < this.cooldownMs) {
      previous.suppressed += 1;
      previous.lastSeenAt = now;
      for (const feature of features) previous.features.set(featureKey(feature), feature);
      return null;
    }

    const aggregatedFeatures = new Map();
    if (previous) {
      for (const [keyName, feature] of previous.features) aggregatedFeatures.set(keyName, feature);
    }
    for (const feature of features) aggregatedFeatures.set(featureKey(feature), feature);

    const occurrences = (previous?.suppressed || 0) + 1;
    const prepared = {
      ...payload,
      features: [...aggregatedFeatures.values()],
      occurrences,
      windowMs: this.cooldownMs,
    };

    this.entries.set(key, {
      lastEmittedAt: now,
      lastSeenAt: now,
      suppressed: 0,
      features: new Map(),
    });
    this.prune();
    return prepared;
  }

  clearPlayer(player) {
    const suffix = `:${String(player || "").trim()}`;
    for (const key of this.entries.keys()) {
      if (key.endsWith(suffix)) this.entries.delete(key);
    }
  }

  prune() {
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }
}

export const evidenceRateLimiter = new EvidenceRateLimiter();

export function emitEvidence(payload) {
  const prepared = evidenceRateLimiter.prepare(payload);
  if (!prepared) return false;
  console.warn(PREFIX + JSON.stringify(prepared));
  return true;
}
