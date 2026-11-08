class PlayerCollisionVolumeProvider {
    static getVolume(stance) {
        // Returns the AABB relative to the player's position based on stance
        if (stance === "sneaking") {
            return { min: { x: -0.3, y: 0, z: -0.3 }, max: { x: 0.3, y: 1.5, z: 0.3 } };
        } else if (stance === "swimming" || stance === "gliding") {
            return { min: { x: -0.3, y: 0, z: -0.3 }, max: { x: 0.3, y: 0.6, z: 0.3 } };
        } else {
            // Default standing
            return { min: { x: -0.3, y: 0, z: -0.3 }, max: { x: 0.3, y: 1.8, z: 0.3 } };
        }
    }
}
export { PlayerCollisionVolumeProvider  };
