export class FiniteNumbers {
  static isFiniteVector(vec) {
    if (!vec) return false;
    return Number.isFinite(vec.x) && Number.isFinite(vec.y) && Number.isFinite(vec.z);
  }

  static isFiniteRotation(rot) {
    if (!rot) return false;
    return Number.isFinite(rot.yaw) && Number.isFinite(rot.pitch);
  }

  static clamp(value, min, max) {
    if (!Number.isFinite(value)) return 0; // Fallback seguro
    return Math.max(min, Math.min(max, value));
  }

  static safeDiv(a, b, fallback = 0) {
    if (b === 0 || !Number.isFinite(a) || !Number.isFinite(b)) return fallback;
    const res = a / b;
    return Number.isFinite(res) ? res : fallback;
  }
}
