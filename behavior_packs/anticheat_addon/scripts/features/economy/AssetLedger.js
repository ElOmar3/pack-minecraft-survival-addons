export class AssetLedger {
    constructor() {
        this.ledger = [];
    }
    
    append(transaction) {
        this.ledger.push({
            ...transaction,
            timestamp: Date.now()
        });
    }

    getTransactions(playerId) {
        return this.ledger.filter(tx => tx.sourceId === playerId || tx.targetId === playerId);
    }
    
    getAll() {
        return this.ledger;
    }
}
