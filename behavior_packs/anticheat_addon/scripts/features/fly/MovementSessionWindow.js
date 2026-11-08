export class MovementSessionWindow {
    constructor(maxSize = 40) {
        this.window = [];
        this.maxSize = maxSize;
        this.inputContextEpoch = 0;
    }

    push(data) {
        this.window.push(data);
        if (this.window.length > this.maxSize) {
            this.window.shift();
        }
    }

    getData() {
        return this.window;
    }
    
    updateDeviceEpoch(newEpoch) {
        this.inputContextEpoch = newEpoch;
    }
    
    clear() {
        this.window = [];
    }
}
