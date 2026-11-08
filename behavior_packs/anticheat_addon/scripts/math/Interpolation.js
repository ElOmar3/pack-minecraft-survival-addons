import { FiniteNumbers } from "./FiniteNumbers.js";

export class Interpolation {
  static lerp(start, end, t) {
    t = FiniteNumbers.clamp(t, 0, 1);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
    return start + (end - start) * t;
  }

  static lerpVector3(v1, v2, t) {
    if (!v1 || !v2) return { x: 0, y: 0, z: 0 };
    return {
      x: this.lerp(v1.x, v2.x, t),
      y: this.lerp(v1.y, v2.y, t),
      z: this.lerp(v1.z, v2.z, t)
    };
  }
}
