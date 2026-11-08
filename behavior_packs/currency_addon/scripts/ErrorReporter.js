// ErrorReporter.js
import { system } from "@minecraft/server";

export const CollectorClientConfig = {
    enabled: true,
    endpoint: "http://localhost:3000/api/v1/events/alerts",
    environment: "production",
    serverId: "server1",
    serverName: "Main Server",
    requestTimeoutMs: 5000,
    maxRetries: 3,
    initialRetryDelayMs: 1000,
    maxRetryDelayMs: 5000,
    maxQueueSize: 100,
    batchSize: 10,
    flushIntervalMs: 5000,
    hmacKeyId: "key-1"
};

class OutboxQueue {
    constructor() {
        this.queue = [];
        this.flushing = false;
        this.flushRunId = undefined;
        this.recentFingerprints = new Map();
    }

    push(event) {
        const now = Date.now();
        const previous = this.recentFingerprints.get(event.fingerprint);
        if (previous && now - previous.lastEmittedAt < 60000) {
            previous.suppressed += 1;
            previous.lastSeenAt = event.timestamp;
            return false;
        }

        if (previous?.suppressed) {
            event.occurrence.count += previous.suppressed;
            event.occurrence.firstSeenAt = previous.firstSeenAt;
        }
        this.recentFingerprints.set(event.fingerprint, {
            firstSeenAt: event.occurrence.firstSeenAt,
            lastEmittedAt: now,
            lastSeenAt: event.timestamp,
            suppressed: 0
        });
        while (this.recentFingerprints.size > 500) {
            this.recentFingerprints.delete(this.recentFingerprints.keys().next().value);
        }

        if (this.queue.length >= CollectorClientConfig.maxQueueSize) {
            // Drop oldest non-fatal
            const idx = this.queue.findIndex(e => e.event.severity !== "fatal");
            if (idx !== -1) {
                this.queue.splice(idx, 1);
            } else {
                this.queue.shift(); // queue is full of fatals, drop oldest
            }
        }
        
        this.queue.push({
            event: event,
            status: "pending",
            attempts: 0,
            createdAt: now,
            nextAttemptAt: now
        });
        this.scheduleFlush();
        return true;
    }

    scheduleFlush() {
        if (this.flushRunId !== undefined) return;
        const delayTicks = Math.max(1, Math.floor(CollectorClientConfig.flushIntervalMs / 50));
        this.flushRunId = system.runTimeout(() => {
            this.flushRunId = undefined;
            this.flush();
        }, delayTicks);
    }

    async flush() {
        this.flushing = true;
        try {
            const now = Date.now();
            const toSend = this.queue.filter(r => r.status === "pending" || (r.status === "retry" && r.nextAttemptAt <= now)).slice(0, CollectorClientConfig.batchSize);
            
            if (toSend.length === 0) return;

            toSend.forEach(r => { r.status = "sending"; r.lastAttemptAt = now; });

            // In Bedrock, if direct HTTP is not fully stable, the instruction says:
            // "La ruta preferida será: Addon Script API -> Bridge local -> Collector HTTP/API"
            // So we emit via console.warn, and the bridge will read stdout and forward via HTTP.
            
            for (const record of toSend) {
                const payload = {
                    schemaVersion: 1,
                    events: [record.event]
                };
                
                // Format that bridge local or python script parses
                console.warn("[SOFTFIX_COLLECTOR_V1] " + JSON.stringify(payload));
                
                // Since it's sent to stdout locally, we assume it's acknowledged immediately by the local bridge queue
                record.status = "acknowledged";
                record.acknowledgedAt = Date.now();
            }
            
            // Clean up acknowledged
            this.queue = this.queue.filter(r => r.status !== "acknowledged" && r.status !== "dead_letter");

        } catch (e) {
            console.warn("[SoftFix][EmergencyLogger] Error en el flush del outbox: " + e);
        } finally {
            this.flushing = false;
            if (this.queue.length > 0) this.scheduleFlush();
        }
    }
}

const outbox = new OutboxQueue();

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function redact(obj) {
    if (!obj) return obj;
    const sensitiveKeys = ["token", "secret", "password", "authorization", "cookie", "apiKey", "api_key", "webhook", "hmac", "privateKey", "connectionString"];
    
    if (typeof obj === 'string') {
        return obj;
    }
    if (Array.isArray(obj)) {
        return obj.map(redact);
    }
    if (typeof obj === 'object') {
        const redactedObj = {};
        for (const [key, value] of Object.entries(obj)) {
            if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk.toLowerCase()))) {
                redactedObj[key] = "[REDACTED]";
            } else {
                redactedObj[key] = redact(value);
            }
        }
        return redactedObj;
    }
    return obj;
}

export class ErrorReporter {
    static report(error, context, severity = "error") {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return this.reportMessage(severity, message, context, stack);
    }

    static reportMessage(severity, message, context, stack = undefined) {
        if (!CollectorClientConfig.enabled) return "disabled";

        const eventId = generateUUID();
        const timestamp = new Date().toISOString();
        
        const fingerprintStr = `${context.addonId}:${context.moduleId}:${context.operation}:${severity}:${message.substring(0, 100)}`;
        const fingerprint = fingerprintStr; // Simple string as fingerprint

        const idempotencyKey = `${CollectorClientConfig.serverId}:${context.addonId}:${context.moduleId}:${fingerprint}:${Date.now()}`;

        const alertEvent = {
            schemaVersion: 1,
            eventId,
            idempotencyKey,
            fingerprint,
            timestamp,
            severity,
            category: context.category,
            environment: CollectorClientConfig.environment,
            serverId: CollectorClientConfig.serverId,
            serverName: CollectorClientConfig.serverName,
            addonId: context.addonId,
            moduleId: context.moduleId,
            operation: context.operation,
            message,
            errorType: stack ? "Error" : "Message",
            stack,
            context: redact(context),
            occurrence: {
                count: 1,
                firstSeenAt: timestamp,
                lastSeenAt: timestamp
            },
            source: {
                component: "minecraft-addon",
                apiVersion: "2.8.0",
                bedrockVersion: "1.26.32.2"
            }
        };

        outbox.push(alertEvent);
        return eventId;
    }
}

export function safeEventHandler(context, handler) {
    return (event) => {
        try {
            const result = handler(event);
            if (result && typeof result.catch === 'function') {
                result.catch((error) => {
                    ErrorReporter.report(error, context, "error");
                });
            }
        } catch (error) {
            ErrorReporter.report(error, context, "error");
        }
    };
}

export function testCollectorCommand(event) {
    const args = event.message.split(" ");
    if (args[0] !== "softfix:test_collector_alert") return;
    const severity = args[1] || "info";

    const sender = event.sourceEntity;
    if (sender && !sender.hasTag("op") && !sender.hasTag("admin")) return;

    system.run(() => {
        const eventId = ErrorReporter.reportMessage(severity, "Test de alerta disparada manualmente", {
            addonId: "softfix_core",
            moduleId: "command_test",
            operation: "test_collector_alert",
            category: "configuration",
            playerName: sender ? sender.name : "System"
        });
        
        if (sender) {
            sender.sendMessage(`[SoftFix] Alerta de prueba enviada al Outbox. Event ID: ${eventId}`);
        } else {
            console.warn(`[SoftFix] Alerta de prueba enviada al Outbox. Event ID: ${eventId}`);
        }
    });
}
