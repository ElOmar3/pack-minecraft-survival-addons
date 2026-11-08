export class FallDamageEventProvider {
  constructor() {
    this.events = [];
  }
  registerDamageEvent(playerId, damage, isFall) {
    if (isFall) {
      this.events.push({ playerId, damage, timestamp: Date.now() });
    }
  }
  getAndClearFallDamage(playerId) {
    const playerEvents = this.events.filter(e => e.playerId === playerId);
    this.events = this.events.filter(e => e.playerId !== playerId);
    return playerEvents.reduce((acc, curr) => acc + curr.damage, 0);
  }
}
