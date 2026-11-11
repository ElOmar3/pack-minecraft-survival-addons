// ErrorReporter.js — reportero local ligero, sin colector externo.
// La telemetría [SOFTFIX_COLLECTOR_V1] (outbox HTTP, UUID, HMAC) fue retirada:
// el colector no existe en este despliegue y sólo acumulaba memoria y trabajo.
// Los errores se registran en consola con deduplicación por fingerprint.

const DEDUP_WINDOW_MS = 60000;
const MAX_FINGERPRINTS = 200;
const recentFingerprints = new Map();

export class ErrorReporter {
    static report(error, context, severity = "error") {
        const message = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        return this.reportMessage(severity, message, context, stack);
    }

    static reportMessage(severity, message, context, stack = undefined) {
        try {
            const safeContext = context && typeof context === "object" ? context : {};
            const text = String(message ?? "");
            const fingerprint = (safeContext.addonId || "?") + ":" + (safeContext.moduleId || "?") + ":" + (safeContext.operation || "?") + ":" + severity + ":" + text.slice(0, 100);
            const now = Date.now();
            const previous = recentFingerprints.get(fingerprint);
            if (previous !== undefined && now - previous < DEDUP_WINDOW_MS) return "suppressed";
            recentFingerprints.set(fingerprint, now);
            while (recentFingerprints.size > MAX_FINGERPRINTS) {
                recentFingerprints.delete(recentFingerprints.keys().next().value);
            }
            console.warn("[ERROR_REPORT_V1] " + JSON.stringify({
                severity,
                addonId: safeContext.addonId,
                moduleId: safeContext.moduleId,
                operation: safeContext.operation,
                category: safeContext.category,
                message: text.slice(0, 300),
                stack: stack ? String(stack).slice(0, 500) : undefined,
                timestamp: new Date(now).toISOString()
            }));
            return fingerprint;
        } catch (e) {
            return "report_failed";
        }
    }
}

export function safeEventHandler(context, handler) {
    return (event) => {
        try {
            const result = handler(event);
            if (result && typeof result.catch === "function") {
                result.catch((error) => {
                    ErrorReporter.report(error, context, "error");
                });
            }
        } catch (error) {
            ErrorReporter.report(error, context, "error");
        }
    };
}
