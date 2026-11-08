export class ExpectedFallDamageProvider {
  calculateExpectedDamage(fallDistance, mitigationFactor, surfaceMitigation) {
    if (fallDistance <= 3) return 0;
    let baseDamage = fallDistance - 3;
    let mitigated = baseDamage * (1 - mitigationFactor);
    mitigated = mitigated * (1 - surfaceMitigation);
    return Math.max(0, Math.ceil(mitigated));
  }
}
