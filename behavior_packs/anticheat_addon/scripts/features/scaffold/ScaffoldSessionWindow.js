import { SupportChainGraph } from './SupportChainGraph.js';

export class ScaffoldSessionWindow {
    constructor(playerId) {
        this.playerId = playerId;
        this.placements = [];
        this.supportChain = new SupportChainGraph();
        this.shadowMode = true;
        this.actionTaken = "NONE";
    }

    addPlacement(placement) {
        this.placements.push(placement);
        this.supportChain.addPlacement(placement);
    }
    
    isWindowClosed(currentTime) {
        if (this.placements.length === 0) return false;
        const lastT = this.placements[this.placements.length - 1].timestamp;
        return (currentTime - lastT > 1000);
    }
}
