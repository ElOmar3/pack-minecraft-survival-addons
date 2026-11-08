import { ErrorReporter } from "./ErrorReporter.js";
export class ConsoleNdjsonSink {
  constructor() {
    this.prefix = "[AC_EVIDENCE_V1]";
    this.maxLineLength = 32000; // BDS console length limits safe zone
    this.health = "HEALTHY";
  }

  tryFlush(outbox, context) {
    if (!outbox) return;
    
    // Get batch
    const batch = outbox.peekBatch();
    if (batch.length === 0) return;

    const successfulIds = [];
    const rejectedIds = [];

    for (const record of batch) {
      const line = `${this.prefix}${record.serializedPacket}`;
      
      if (line.length > this.maxLineLength) {
        rejectedIds.push(record.packetId);
        continue;
      }

      try {
        // Output exactly one line
        console.warn(line);
        successfulIds.push(record.packetId);
      } catch (e) { ErrorReporter.report(e, { addonId: "anticheat_addon", moduleId: "ConsoleNdjsonSink.js", operation: "try-catch", category: "runtime" });
        // In case console.warn fails (e.g. string encoding issues in sandbox)
        this.health = "DEGRADED";
        rejectedIds.push(record.packetId);
      }
    }

    if (successfulIds.length > 0) {
      outbox.acknowledge(successfulIds);
    }
    if (rejectedIds.length > 0) {
      outbox.reject(rejectedIds, "SINK_ERROR");
    }
  }

  getHealth() {
    return this.health;
  }
}
