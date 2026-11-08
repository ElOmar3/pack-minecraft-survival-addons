export class KnockbackSessionWindow {
    constructor() {
        this.episodes = [];
    }
    addEpisode(episode) {
        this.episodes.push(episode);
        if (this.episodes.length > 10) {
            this.episodes.shift();
        }
    }
    getRecentEpisodes() {
        return this.episodes;
    }
}
