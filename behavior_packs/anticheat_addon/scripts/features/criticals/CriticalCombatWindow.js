export class CriticalCombatWindow {
    constructor(baseDamage = 7) {
        this.events = [];
        this.baseDamage = baseDamage;
    }
    
    addEvent(event) {
        this.events.push(event);
    }
    
    getEvents() {
        return this.events;
    }
}
