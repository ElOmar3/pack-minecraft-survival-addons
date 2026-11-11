import { canonicalJson, utf8Size } from "./CanonicalJson.js";
import { constantTimeEqual, sha256 } from "../shared/Crypto.js";

const META_KEY = "fcx_admin:audit_meta_v1";
const SEGMENT_PREFIX = "fcx_admin:audit_segment_v1:";
const GENESIS_HASH = sha256("FCX_ADMIN_AUDIT_V1_GENESIS");

function segmentKey(sequence) { return `${SEGMENT_PREFIX}${sequence}`; }

function segmentBody(segment) {
  return {
    schemaVersion: segment.schemaVersion,
    segmentSeq: segment.segmentSeq,
    previousHash: segment.previousHash,
    firstEventSeq: segment.firstEventSeq,
    lastEventSeq: segment.lastEventSeq,
    events: segment.events
  };
}

function sealSegment(segment) {
  const body = segmentBody(segment);
  const checksum = sha256(canonicalJson(body));
  return { ...body, checksum, chainHash: sha256(`${body.previousHash}|${checksum}|${body.segmentSeq}`) };
}

function sealMeta(meta) {
  const body = { ...meta };
  delete body.checksum;
  return { ...body, checksum: sha256(canonicalJson(body)) };
}

export class SegmentedAuditJournal {
  constructor(store, limits) {
    this.store = store;
    this.limits = limits;
    this.meta = null;
    this.ready = false;
    this.lastError = "";
  }

  writeVerified(key, value) {
    const serialized = canonicalJson(value);
    this.store.set(key, serialized);
    const readBack = String(this.store.get(key) ?? "");
    if (!constantTimeEqual(readBack, serialized)) throw new Error(`write_verification_failed:${key}`);
  }

  readJson(key) {
    const raw = this.store.get(key);
    if (raw === undefined) return undefined;
    return globalThis.__sqlite_read_json_v3__(raw);
  }

  validateMeta(meta) {
    if (meta?.schemaVersion !== 1 || !Number.isSafeInteger(meta.currentSegmentSeq) || !Number.isSafeInteger(meta.nextEventSeq)) throw new Error("audit_meta_schema_invalid");
    const expected = sealMeta(meta).checksum;
    if (!constantTimeEqual(meta.checksum, expected)) throw new Error("audit_meta_checksum_invalid");
    if (!Array.isArray(meta.idempotencyKeys)) throw new Error("audit_idempotency_index_invalid");
  }

  validateSegment(segment, expectedSequence, expectedPreviousHash, expectedEventSequence) {
    if (segment?.schemaVersion !== 1 || segment.segmentSeq !== expectedSequence || !Array.isArray(segment.events)) throw new Error(`audit_segment_schema_invalid:${expectedSequence}`);
    const sealed = sealSegment(segment);
    if (!constantTimeEqual(segment.checksum, sealed.checksum)) throw new Error(`audit_segment_checksum_invalid:${expectedSequence}`);
    if (!constantTimeEqual(segment.chainHash, sealed.chainHash)) throw new Error(`audit_chain_hash_invalid:${expectedSequence}`);
    if (!constantTimeEqual(segment.previousHash, expectedPreviousHash)) throw new Error(`audit_previous_hash_invalid:${expectedSequence}`);
    let next = expectedEventSequence;
    for (const event of segment.events) {
      if (event.sequence !== next) throw new Error(`audit_event_sequence_invalid:${expectedSequence}:${event.sequence}`);
      next += 1;
    }
    if (segment.events.length === 0) {
      if (segment.firstEventSeq !== 0 || segment.lastEventSeq !== 0) throw new Error(`audit_empty_segment_bounds_invalid:${expectedSequence}`);
    } else if (segment.firstEventSeq !== expectedEventSequence || segment.lastEventSeq !== next - 1) {
      throw new Error(`audit_segment_bounds_invalid:${expectedSequence}`);
    }
    return next;
  }

  initialize() {
    try {
      const storedMeta = this.readJson(META_KEY);
      if (!storedMeta) {
        const first = sealSegment({ schemaVersion: 1, segmentSeq: 1, previousHash: GENESIS_HASH, firstEventSeq: 0, lastEventSeq: 0, events: [] });
        this.writeVerified(segmentKey(1), first);
        this.meta = sealMeta({
          schemaVersion: 1, currentSegmentSeq: 1, oldestSegmentSeq: 1,
          nextEventSeq: 1, lastChainHash: first.chainHash,
          retentionRootHash: GENESIS_HASH, idempotencyKeys: []
        });
        this.writeVerified(META_KEY, this.meta);
      } else {
        this.validateMeta(storedMeta);
        let previousHash = storedMeta.retentionRootHash;
        let eventSequence = 1;
        for (let sequence = storedMeta.oldestSegmentSeq; sequence <= storedMeta.currentSegmentSeq; sequence++) {
          const segment = this.readJson(segmentKey(sequence));
          if (!segment) throw new Error(`audit_segment_missing:${sequence}`);
          if (sequence === storedMeta.oldestSegmentSeq && sequence > 1) {
            if (!Number.isSafeInteger(segment.firstEventSeq) || segment.firstEventSeq < 1) throw new Error("audit_retention_event_sequence_invalid");
            eventSequence = segment.firstEventSeq;
          }
          eventSequence = this.validateSegment(segment, sequence, previousHash, eventSequence);
          previousHash = segment.chainHash;
        }
        if (eventSequence !== storedMeta.nextEventSeq) throw new Error("audit_meta_event_sequence_mismatch");
        if (!constantTimeEqual(previousHash, storedMeta.lastChainHash)) throw new Error("audit_meta_chain_mismatch");
        this.meta = storedMeta;
      }
      this.ready = true;
      this.lastError = "";
      return { ok: true };
    } catch (error) {
      this.ready = false;
      this.lastError = String(error);
      return { ok: false, error: this.lastError };
    }
  }

  hasIdempotencyKey(key) {
    return this.meta?.idempotencyKeys?.includes(String(key)) === true;
  }

  append(event, options = {}) {
    if (!this.ready || !this.meta) {
      const recovered = this.initialize();
      if (!recovered.ok) return { ok: false, error: this.lastError || "audit_not_ready" };
    }
    try {
      const idempotencyKey = String(options.idempotencyKey ?? "");
      if (options.recordIdempotency && idempotencyKey && this.hasIdempotencyKey(idempotencyKey)) return { ok: false, duplicate: true, error: "duplicate_idempotency_key" };
      const entry = { ...event, sequence: this.meta.nextEventSeq };
      if (utf8Size(canonicalJson(entry)) > this.limits.maxEventBytes) throw new Error("audit_event_too_large");
      let segment = this.readJson(segmentKey(this.meta.currentSegmentSeq));
      const previous = this.meta.currentSegmentSeq === this.meta.oldestSegmentSeq
        ? this.meta.retentionRootHash
        : this.readJson(segmentKey(this.meta.currentSegmentSeq - 1))?.chainHash;
      if (!previous) throw new Error("audit_previous_segment_missing");
      this.validateSegment(segment, this.meta.currentSegmentSeq, previous, segment.events.length ? segment.firstEventSeq : this.meta.nextEventSeq);
      if (!constantTimeEqual(segment.chainHash, this.meta.lastChainHash)) throw new Error("audit_live_chain_mismatch");
      if (segment.events.length && segment.lastEventSeq !== this.meta.nextEventSeq - 1) throw new Error("audit_live_sequence_mismatch");
      const candidate = sealSegment({
        ...segmentBody(segment),
        firstEventSeq: segment.events.length ? segment.firstEventSeq : entry.sequence,
        lastEventSeq: entry.sequence,
        events: [...segment.events, entry]
      });
      if (utf8Size(canonicalJson(candidate)) > this.limits.maxSerializedSegmentBytes) {
        segment = sealSegment({
          schemaVersion: 1,
          segmentSeq: this.meta.currentSegmentSeq + 1,
          previousHash: segment.chainHash,
          firstEventSeq: entry.sequence,
          lastEventSeq: entry.sequence,
          events: [entry]
        });
      } else {
        segment = candidate;
      }
      if (utf8Size(canonicalJson(segment)) > this.limits.maxSerializedSegmentBytes) throw new Error("audit_segment_limit_exceeded");
      this.writeVerified(segmentKey(segment.segmentSeq), segment);
      const nextMeta = { ...this.meta, currentSegmentSeq: segment.segmentSeq, nextEventSeq: entry.sequence + 1, lastChainHash: segment.chainHash };
      if (options.recordIdempotency && idempotencyKey) {
        nextMeta.idempotencyKeys = [...nextMeta.idempotencyKeys, idempotencyKey].slice(-this.limits.recentIdempotencyKeys);
      }
      this.rotate(nextMeta);
      this.meta = sealMeta(nextMeta);
      this.writeVerified(META_KEY, this.meta);
      return { ok: true, sequence: entry.sequence, chainHash: segment.chainHash };
    } catch (error) {
      const errorText = String(error);
      if (errorText.includes("audit_live_chain_mismatch") && options.__auditRecoveryAttempt !== true) {
        const recovered = this.initialize();
        if (recovered.ok) return this.append(event, { ...options, __auditRecoveryAttempt: true });
      }
      this.ready = false;
      this.lastError = errorText;
      console.warn(`[FCX_ADMIN_AUDIT_APPEND_FAILED] ${JSON.stringify({ error: this.lastError.slice(0, 240), nextEventSeq: this.meta?.nextEventSeq ?? 0, currentSegmentSeq: this.meta?.currentSegmentSeq ?? 0 })}`);
      return { ok: false, error: this.lastError };
    }
  }

  rotate(meta) {
    while (meta.currentSegmentSeq - meta.oldestSegmentSeq + 1 > this.limits.maxSegments) {
      const old = this.readJson(segmentKey(meta.oldestSegmentSeq));
      if (!old) throw new Error(`audit_rotation_segment_missing:${meta.oldestSegmentSeq}`);
      meta.retentionRootHash = old.chainHash;
      this.store.delete(segmentKey(meta.oldestSegmentSeq));
      meta.oldestSegmentSeq += 1;
    }
  }

  readRecent(limit = 50) {
    if (!this.ready || !this.meta) return [];
    const result = [];
    try {
      for (let sequence = this.meta.currentSegmentSeq; sequence >= this.meta.oldestSegmentSeq && result.length < limit; sequence--) {
        const segment = this.readJson(segmentKey(sequence));
        if (!segment) break;
        for (let index = segment.events.length - 1; index >= 0 && result.length < limit; index--) result.push(segment.events[index]);
      }
      return result;
    } catch {
      return [];
    }
  }
}
