export class FallResetProvider {
  isLegitimateReset(playerState, environmentContext) {
    if (environmentContext.inWater || environmentContext.inCobweb || environmentContext.onClimbable) {
      return true;
    }
    return false;
  }
}
