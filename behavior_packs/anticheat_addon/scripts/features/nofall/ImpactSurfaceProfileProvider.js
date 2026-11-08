export class ImpactSurfaceProfileProvider {
  getSurfaceMitigation(blockId) {
    if (!blockId) return 0;
    if (blockId.includes('slime') || blockId.includes('water')) return 1.0;
    if (blockId.includes('hay_block')) return 0.8;
    if (blockId.includes('bed')) return 0.5;
    return 0;
  }
}
