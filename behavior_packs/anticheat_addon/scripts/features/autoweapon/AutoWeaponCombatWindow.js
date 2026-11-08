export class AutoWeaponCombatWindow {
    constructor() {
        this.events = [];
    }
    
    addEvent(tick, type, data) {
        this.events.push({ tick, type, ...data });
    }
    
    getWindow(hitTick) {
        return this.events.filter(e => e.tick >= hitTick - 10 && e.tick <= hitTick + 10);
    }
}
