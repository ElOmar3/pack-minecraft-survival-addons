export class PlacementGeometryExtractor {
    // Evalúa alcance y alineación angular contra la cara de soporte, no solo el centro
    static extract(playerHeadPos, playerViewVector, blockPos, supportFaceNormal) {
        const reach = Math.sqrt(
            Math.pow(blockPos.x - playerHeadPos.x, 2) +
            Math.pow(blockPos.y - playerHeadPos.y, 2) +
            Math.pow(blockPos.z - playerHeadPos.z, 2)
        );
        
        // Dot product between view vector and face normal to see if looking at the face
        const dot = playerViewVector.x * supportFaceNormal.x +
                    playerViewVector.y * supportFaceNormal.y +
                    playerViewVector.z * supportFaceNormal.z;
        
        return {
            reach,
            alignmentDot: dot
        };
    }
}
