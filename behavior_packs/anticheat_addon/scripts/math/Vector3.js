import { FiniteNumbers } from "./FiniteNumbers.js";

export class Vector3 {
  static subtract(a, b) {
    if (!a || !b) return { x: 0, y: 0, z: 0 };
    return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
  }

  static distance(a, b) {
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    const dist = Math.hypot(dx, dy, dz);
    return Number.isFinite(dist) ? dist : 0;
  }

  static normalize(v) {
    if (!v) return { x: 0, y: 0, z: 0 };
    const mag = Math.hypot(v.x, v.y, v.z);
    if (mag === 0 || !Number.isFinite(mag)) return { x: 0, y: 0, z: 0 };
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }
}
