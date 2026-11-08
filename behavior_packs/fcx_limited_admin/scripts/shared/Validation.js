const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;

export function sanitizeText(value, maxLength = 240) {
  return String(value ?? "")
    .replace(CONTROL_CHARS, " ")
    .replace(/[§`]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function sanitizeReason(value, maxLength = 240) {
  const reason = sanitizeText(value, maxLength);
  // Los códigos breves de reglamento (R1, R2, …) son motivos auditables válidos.
  return reason.length >= 3 || /^r\d{1,3}$/i.test(reason) ? reason : "";
}

export function parseDuration(value, maximumMs) {
  const raw = String(value ?? "").trim().toLowerCase();
  const match = /^(\d{1,7})(m|h|d)$/.exec(raw);
  if (!match) return { ok: false, code: "INVALID_DURATION" };
  const amount = Number(match[1]);
  const multiplier = match[2] === "m" ? 60_000 : match[2] === "h" ? 3_600_000 : 86_400_000;
  if (!Number.isSafeInteger(amount) || amount <= 0) return { ok: false, code: "INVALID_DURATION" };
  const durationMs = amount * multiplier;
  if (!Number.isSafeInteger(durationMs) || durationMs <= 0) return { ok: false, code: "INVALID_DURATION" };
  if (Number.isFinite(maximumMs) && durationMs > maximumMs) return { ok: false, code: "DURATION_LIMIT_EXCEEDED" };
  return { ok: true, durationMs, normalized: `${amount}${match[2]}` };
}

export function safeLocation(player) {
  try {
    const location = player?.location;
    if (!location) return undefined;
    const x = Number(location.x);
    const y = Number(location.y);
    const z = Number(location.z);
    if (![x, y, z].every(Number.isFinite)) return undefined;
    return { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, z: Math.round(z * 100) / 100 };
  } catch {
    return undefined;
  }
}

export function maskIdentifier(value) {
  const text = String(value ?? "");
  if (text.length <= 8) return text ? `${text.slice(0, 2)}…` : "none";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
}
