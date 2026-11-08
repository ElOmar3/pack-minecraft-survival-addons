export class EconomyIntegrityDetector {
    constructor(pipeline, shadowMode = true) {
        this.pipeline = pipeline;
        this.shadowMode = shadowMode; // shadowMode=true means NO automatic bans, only log to pipeline
    }

    reportDiscrepancy(type, data) {
        const packet = {
            type: 'economy_violation',
            subtype: type,
            data: data,
            timestamp: Date.now(),
            shadowMode: this.shadowMode
        };
        
        if (this.pipeline && this.pipeline.dispatch) {
            this.pipeline.dispatch(packet);
        } else {
            console.warn("[EconomyIntegrityDetector] Pipeline not available. Discrepancy: " + JSON.stringify(packet));
        }
    }
}
