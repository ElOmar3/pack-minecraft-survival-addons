import { canonicalJson, utf8Size } from "./CanonicalJson.js";
import { sha256 } from "../shared/Crypto.js";
import { sanitizeText, safeLocation } from "../shared/Validation.js";

const ALLOWED_SOURCES = new Set(["COMMAND", "UI", "SYSTEM", "DISCORD"]);

function cleanParameters(value, depth = 0) {
  if (depth > 3) return "[DEPTH_LIMIT]";
  if (value === null || value === undefined) return value ?? null;
  if (["string","number","boolean"].includes(typeof value)) return typeof value === "string" ? sanitizeText(value, 256) : value;
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => cleanParameters(item, depth + 1));
  if (typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort().slice(0, 30)) {
      if (/token|secret|webhook|nonce/i.test(key) || String(key).toLowerCase() === "authorization") result[key] = "[REDACTED]";
      else result[sanitizeText(key, 64)] = cleanParameters(value[key], depth + 1);
    }
    return result;
  }
  return sanitizeText(String(value), 128);
}

export class AdminAuditService {
  constructor(journal, config) {
    this.journal = journal;
    this.config = config;
    this.idCounter = 0;
  }

  createContext(actor, action, source = "COMMAND") {
    const timestamp = Date.now();
    this.idCounter += 1;
    const base = `${timestamp}|${this.idCounter}|${actor?.principalId ?? "SYSTEM"}|${action}`;
    return {
      auditId: sha256(`audit|${base}`).slice(0, 32),
      correlationId: sha256(`correlation|${base}`).slice(0, 32),
      timestamp,
      source: ALLOWED_SOURCES.has(source) ? source : "SYSTEM"
    };
  }

  buildEvent(context, actor, target, action, parameters, reason, decision, decisionReason, result, errorCode) {
    const event = {
      auditId: context.auditId,
      correlationId: context.correlationId,
      timestamp: Date.now(),
      actorId: actor?.principalId ?? "SYSTEM",
      actorNameSnapshot: sanitizeText(actor?.playerNameSnapshot ?? "SYSTEM", 64),
      actorRoleSnapshot: sanitizeText(actor?.role ?? "SYSTEM", 32),
      action: sanitizeText(action, 96),
      requestedParameters: cleanParameters(parameters ?? {}),
      sanitizedReason: reason ? sanitizeText(reason, this.config.maximumReasonLength) : undefined,
      permissionDecision: decision === "ALLOWED" ? "ALLOWED" : "DENIED",
      decisionReason: sanitizeText(decisionReason, 160),
      result,
      errorCode: errorCode ? sanitizeText(errorCode, 64) : undefined,
      source: context.source
    };
    if (target) {
      event.targetId = target.principalId ?? target.targetId ?? "SESSION_TARGET";
      event.targetNameSnapshot = sanitizeText(target.playerNameSnapshot ?? target.name ?? "Unknown", 64);
    }
    const player = actor?.player;
    try { event.dimension = sanitizeText(player?.dimension?.id ?? "", 64) || undefined; } catch {}
    event.location = safeLocation(player);
    for (const key of Object.keys(event)) if (event[key] === undefined) delete event[key];
    return event;
  }

  persistIntent(context, event, idempotencyKey) {
    const envelope = { eventType: "INTENT", ...event };
    const result = this.journal.append(envelope, { recordIdempotency: true, idempotencyKey });
    if (result.ok) this.export("AUDIT", { ...envelope, sequence: result.sequence });
    return result;
  }

  persistResult(event) {
    const envelope = { eventType: "RESULT", ...event };
    const result = this.journal.append(envelope);
    if (result.ok) this.export("AUDIT", { ...envelope, sequence: result.sequence });
    return result;
  }

  alert(type, severity, details = {}) {
    const payload = {
      schemaVersion: 1,
      timestamp: Date.now(),
      type: sanitizeText(type, 64),
      severity: ["INFO","WARNING","CRITICAL"].includes(severity) ? severity : "WARNING",
      discordEligible: this.config.discordAlertsEnabled === true,
      details: cleanParameters(details)
    };
    this.export("ALERT", payload);
  }

  export(kind, payload) {
    const serialized = canonicalJson(payload);
    if (utf8Size(serialized) > 8192) return;
    console.warn(`[FCX_ADMIN_${kind}_V1] ${serialized}`);
  }
}
