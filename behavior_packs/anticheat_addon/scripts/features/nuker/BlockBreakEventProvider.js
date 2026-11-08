export class BlockBreakEventProvider {
    constructor() {
        this.listeners = [];
    }
    
    onBlockBreak(event) {
        if (!event || !event.player) return;
        const data = {
            player: event.player,
            block: event.block,
            brokenBlockPermutation: event.brokenBlockPermutation,
            timestamp: Date.now()
        };
        this.listeners.forEach(l => l(data));
    }
    
    subscribe(callback) {
        this.listeners.push(callback);
    }
}
