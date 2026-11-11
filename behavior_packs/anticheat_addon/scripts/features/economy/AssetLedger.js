// Techo FIFO del libro mayor: las transacciones huérfanas o históricas no deben
// crecer sin límite en RAM; se conservan las 1.000 más recientes.
const MAX_LEDGER_ENTRIES = 1000;

export class AssetLedger {
    constructor() {
        this.ledger = [];
    }
    
    append(transaction) {
        this.ledger.push({
            ...transaction,
            timestamp: Date.now()
        });
        if (this.ledger.length > MAX_LEDGER_ENTRIES) {
            this.ledger.splice(0, this.ledger.length - MAX_LEDGER_ENTRIES);
        }
    }

    getTransactions(playerId) {
        return this.ledger.filter(tx => tx.sourceId === playerId || tx.targetId === playerId);
    }
    
    getAll() {
        return this.ledger;
    }
}
