export function ok(value = undefined) {
  return Object.freeze({ ok: true, value });
}

export function fail(code, message = "Solicitud rechazada.", details = undefined) {
  return Object.freeze({ ok: false, code, message, details });
}
