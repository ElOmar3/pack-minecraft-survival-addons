import { FiniteNumbers } from "./FiniteNumbers.js";

export class Angles {
  // Normalizar entre -180 y 180
  static normalizeYaw(yaw) {
    if (!Number.isFinite(yaw)) return 0;
    let normalized = yaw % 360;
    if (normalized > 180) normalized -= 360;
    if (normalized < -180) normalized += 360;
    return normalized;
  }

  // Diferencia más corta entre dos yaws
  static deltaYaw(y1, y2) {
    if (!Number.isFinite(y1) || !Number.isFinite(y2)) return 0;
    return this.normalizeYaw(y1 - y2);
  }

  // Dot product seguro
  static dotProduct(v1, v2) {
    if (!v1 || !v2) return 0;
    const dot = (v1.x * v2.x) + (v1.y * v2.y) + (v1.z * v2.z);
    return FiniteNumbers.clamp(dot, -1.0, 1.0);
  }
}
