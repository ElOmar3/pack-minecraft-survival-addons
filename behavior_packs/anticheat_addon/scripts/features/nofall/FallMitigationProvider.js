export class FallMitigationProvider {
  getMitigationFactor(playerState) {
    let factor = 0;
    if (playerState.effects && playerState.effects.includes('slow_falling')) {
      factor += 1.0;
    }
    if (playerState.enchantments && playerState.enchantments.feather_falling) {
      factor += Math.min(playerState.enchantments.feather_falling * 0.12, 0.48);
    }
    return Math.min(factor, 1.0);
  }
}
