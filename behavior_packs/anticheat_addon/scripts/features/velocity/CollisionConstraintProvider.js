export class CollisionConstraintProvider {
    checkConstraints(entity) {
        return {
            onGround: entity.onGround || false,
            touchingWall: entity.touchingWall || false,
            touchingCeiling: entity.touchingCeiling || false
        };
    }
}
