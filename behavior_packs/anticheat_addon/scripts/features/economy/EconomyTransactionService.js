export class EconomyTransactionService {
    constructor(ledger, detector) {
        this.ledger = ledger;
        this.detector = detector;
        this.processedKeys = new Set();
        this.balances = new Map(); // Simple mock for balances (in practice backed by Dynamic Properties or external DB)
    }

    setBalance(playerId, amount) {
        this.balances.set(playerId, amount);
    }
    
    getBalance(playerId) {
        return this.balances.get(playerId) || 0;
    }

    executeTransaction(txRequest) {
        const { idempotencyKey, type, sourceId, targetId, amount, assetId } = txRequest;
        
        if (this.processedKeys.has(idempotencyKey)) {
            // Idempotent execution: do not process same transaction again
            return false;
        }
        
        // Pre-state validation
        if (type === 'transfer' || type === 'purchase' || type === 'burn') {
            const currentBal = this.getBalance(sourceId);
            if (currentBal < amount) {
                this.detector.reportDiscrepancy('Double Spend', {
                    playerId: sourceId,
                    attemptedAmount: amount,
                    actualBalance: currentBal,
                    idempotencyKey
                });
                return false;
            }
        }

        // State changes
        if (type === 'mint') {
            this.balances.set(targetId, this.getBalance(targetId) + amount);
        } else if (type === 'burn') {
            this.balances.set(sourceId, this.getBalance(sourceId) - amount);
        } else if (type === 'transfer' || type === 'purchase') {
            this.balances.set(sourceId, this.getBalance(sourceId) - amount);
            this.balances.set(targetId, this.getBalance(targetId) + amount);
        }

        // Post-state validation (could be added here)

        this.processedKeys.add(idempotencyKey);
        this.ledger.append(txRequest);
        
        return true;
    }
}
