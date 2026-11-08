import { ErrorReporter } from "./ErrorReporter.js";
export class EvidenceOutbox {
  constructor(config = {}) {
    this.config = {
      maxRecords: config.maxRecords || 512,
      maxBytes: config.maxBytes || 2 * 1024 * 1024,
      maxRecordBytes: config.maxRecordBytes || 64 * 1024,
      maxFlushRecordsPerTick: config.maxFlushRecordsPerTick || 2
    };
    
    this.queue = [];
    this.metrics = {
      queuedRecords: 0,
      queuedBytes: 0,
      enqueuedTotal: 0,
      emittedTotal: 0,
      rejectedTotal: 0,
      droppedTotal: 0,
      duplicateTotal: 0,
      highWatermarkRecords: 0,
      highWatermarkBytes: 0,
      droppedByReason: {}
    };
  }

  _incrementDropped(reason) {
    this.metrics.droppedTotal++;
    this.metrics.droppedByReason[reason] = (this.metrics.droppedByReason[reason] || 0) + 1;
  }

  enqueue(packet, priority) {
    const packetId = packet.packetId;
    
    // Deduplication
    if (this.queue.some(r => r.packetId === packetId)) {
      this.metrics.duplicateTotal++;
      return false;
    }

    let serialized;
    try {
      serialized = JSON.stringify(packet);
    } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "EvidenceOutbox.js", operation: "try-catch", category: "runtime" });
      this.metrics.rejectedTotal++;
      this._incrementDropped("SERIALIZATION_FAILED");
      return false;
    }

    const estimatedBytes = serialized.length; // 1 byte per char approx for ASCII JSON

    if (estimatedBytes > this.config.maxRecordBytes) {
      this.metrics.rejectedTotal++;
      this._incrementDropped("RECORD_TOO_LARGE");
      return false;
    }

    // Eviction if full
    while (this.metrics.queuedRecords >= this.config.maxRecords || (this.metrics.queuedBytes + estimatedBytes) > this.config.maxBytes) {
      // Find lowest priority to drop (DEBUG -> OBSERVATION)
      let droppedIndex = -1;
      let lowestPriority = "REVIEW_REQUIRED";
      
      const priorityOrder = { "DEBUG": 0, "OBSERVATION": 1, "SUSPICIOUS": 2, "REVIEW_REQUIRED": 3 };
      
      for (let i = 0; i < this.queue.length; i++) {
        if (priorityOrder[this.queue[i].priority] < priorityOrder[lowestPriority]) {
          lowestPriority = this.queue[i].priority;
          droppedIndex = i;
        }
      }

      if (droppedIndex !== -1 && priorityOrder[lowestPriority] < priorityOrder[priority]) {
        // Drop the lower priority item
        const dropped = this.queue.splice(droppedIndex, 1)[0];
        this.metrics.queuedRecords--;
        this.metrics.queuedBytes -= dropped.estimatedBytes;
        this._incrementDropped(`CAPACITY_EXCEEDED_${dropped.priority}`);
      } else {
        // Can't drop anything lower, reject this packet
        this.metrics.rejectedTotal++;
        this._incrementDropped("CAPACITY_EXCEEDED_REJECTED_SELF");
        return false;
      }
    }

    this.queue.push({
      packetId,
      combatSessionId: packet.combat?.combatSessionId,
      priority,
      enqueuedTick: Date.now(), // Simulating tick for standard environment
      estimatedBytes,
      attempts: 0,
      serializedPacket: serialized
    });

    this.metrics.queuedRecords++;
    this.metrics.queuedBytes += estimatedBytes;
    this.metrics.enqueuedTotal++;
    
    if (this.metrics.queuedRecords > this.metrics.highWatermarkRecords) this.metrics.highWatermarkRecords = this.metrics.queuedRecords;
    if (this.metrics.queuedBytes > this.metrics.highWatermarkBytes) this.metrics.highWatermarkBytes = this.metrics.queuedBytes;

    return true;
  }

  peekBatch(options = {}) {
    const limit = options.limit || this.config.maxFlushRecordsPerTick;
    return this.queue.slice(0, limit);
  }

  acknowledge(packetIds) {
    const initialLen = this.queue.length;
    this.queue = this.queue.filter(r => {
      if (packetIds.includes(r.packetId)) {
        this.metrics.queuedRecords--;
        this.metrics.queuedBytes -= r.estimatedBytes;
        this.metrics.emittedTotal++;
        return false;
      }
      return true;
    });
  }

  reject(packetIds, reason) {
    // Only increment attempts or drop if too many
    for (const r of this.queue) {
      if (packetIds.includes(r.packetId)) {
        r.attempts++;
        if (r.attempts > 3) {
          this.queue = this.queue.filter(x => x.packetId !== r.packetId);
          this.metrics.queuedRecords--;
          this.metrics.queuedBytes -= r.estimatedBytes;
          this._incrementDropped(`REJECTED_MAX_ATTEMPTS_${reason}`);
        }
      }
    }
  }

  getMetrics() {
    return { ...this.metrics };
  }

  clear() {
    this.queue = [];
    this.metrics.queuedRecords = 0;
    this.metrics.queuedBytes = 0;
  }
}
