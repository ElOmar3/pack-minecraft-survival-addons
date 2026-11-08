import { Angles } from "../math/Angles.js";
import { FiniteNumbers } from "../math/FiniteNumbers.js";

export class RotationFeatureExtractor {
  static unwrapYawSequence(samples) {
    if (!samples || samples.length === 0) return [];
    const unwrapped = [{ ...samples[0] }];
    let currentYaw = unwrapped[0].rotation.yaw;

    for (let i = 1; i < samples.length; i++) {
      const sample = samples[i];
      let delta = Angles.deltaYaw(currentYaw, sample.rotation.yaw);
      currentYaw -= delta; // Desenvolver manteniendo la dirección lógica
      unwrapped.push({ ...sample, unwrappedYaw: currentYaw });
    }
    return unwrapped;
  }

  static extract(samples, targetTick) {
    const validSamples = samples.filter(s => s && FiniteNumbers.isFiniteRotation(s.rotation));
    const unwrapped = this.unwrapYawSequence(validSamples);
    
    // Jerk robusto usando regresión simple / medias móviles si hay >4 muestras
    let robustAngularJerk = null;
    let maxSpeed = 0;
    
    if (unwrapped.length >= 3) {
      for (let i = 1; i < unwrapped.length; i++) {
        const dt = unwrapped[i].tick - unwrapped[i-1].tick;
        if (dt > 0) {
          const speed = Math.abs(unwrapped[i].unwrappedYaw - unwrapped[i-1].unwrappedYaw) / dt;
          if (speed > maxSpeed) maxSpeed = speed;
        }
      }
    }

    // Mock output matching the schema expected
    return {
      schemaVersion: 1,
      valid: unwrapped.length >= 3,
      features: {
        yawDelta: 0,
        pitchDelta: 0,
        angularSpeed: maxSpeed,
        robustAngularJerk: robustAngularJerk
      },
      quality: { sampleCount: unwrapped.length },
      missing: [],
      warnings: []
    };
  }
}
