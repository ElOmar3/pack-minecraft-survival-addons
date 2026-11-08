export class KnockbackResistanceProvider {
    getResistance(entity) {
        return entity.knockbackResistance || 0;
    }
}
