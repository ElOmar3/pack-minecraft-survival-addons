export const MovementState = {
    GROUNDED: "GROUNDED",
    TAKEOFF: "TAKEOFF",
    ASCENDING: "ASCENDING",
    DESCENDING: "DESCENDING",
    HOVERING: "HOVERING",
    GLIDING: "GLIDING"
};

export class MovementStateMachine {
    constructor() {
        this.currentState = MovementState.GROUNDED;
    }

    update(state, hasGroundSupport) {
        if (hasGroundSupport) {
            this.currentState = MovementState.GROUNDED;
        } else if (state.velocity.y > 0) {
            if (this.currentState === MovementState.GROUNDED) {
                this.currentState = MovementState.TAKEOFF;
            } else {
                this.currentState = MovementState.ASCENDING;
            }
        } else if (state.velocity.y < 0) {
            this.currentState = MovementState.DESCENDING;
        } else {
            this.currentState = MovementState.HOVERING;
        }
        return this.currentState;
    }
}
