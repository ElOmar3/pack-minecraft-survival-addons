export class InputContextEpoch {
    constructor() {
        this.currentMode = "UNKNOWN";
        this.baselineStart = 0;
    }
    
    update(tick, inputMode) {
        if (inputMode && inputMode !== this.currentMode) {
            this.currentMode = inputMode;
            this.baselineStart = tick;
        }
        return tick - this.baselineStart; 
    }
}
