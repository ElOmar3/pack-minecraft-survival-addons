export class FallEpisodeStateMachine {
  constructor() {
    this.state = 'GROUND';
    this.peakHeight = 0;
    this.fallDistance = 0;
  }
  
  update(safeState) {
    if (!safeState.valid) return this.state;
    
    if (this.state === 'GROUND') {
      if (!safeState.onGround && safeState.motionY < 0) {
        this.state = 'FALLING';
        this.fallDistance = safeState.fallDistance;
      }
    } else if (this.state === 'FALLING') {
      if (safeState.onGround) {
        this.state = 'IMPACT';
      } else if (safeState.fallDistance === 0 && safeState.motionY < 0) {
        // Fall distance reset mid-air
        this.state = 'MIDAIR_RESET';
      } else {
        this.fallDistance = safeState.fallDistance;
      }
    } else if (this.state === 'IMPACT' || this.state === 'MIDAIR_RESET') {
      if (safeState.onGround) {
        this.state = 'GROUND';
      } else if (safeState.motionY < 0) {
        this.state = 'FALLING';
      }
    }
    return this.state;
  }
}
