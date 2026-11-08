export class KnockbackEpisode {
    constructor(impactEvent) {
        this.impactEvent = impactEvent;
        this.preState = null;
        this.postStates = [];
        this.constraints = null;
        this.resolved = false;
    }
    addPostState(state) {
        this.postStates.push(state);
    }
}
