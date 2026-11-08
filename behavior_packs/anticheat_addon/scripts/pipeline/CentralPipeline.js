export class CentralPipeline {
    static init() {
        // [MIGRATION]: La lógica local de Gemma, Fusion y Policy se ha trasladado
        // al colector offline de Python. Ya no interceptamos console.warn ni
        // procesamos ventanas localmente. 
        // Las advertencias AC_EVIDENCE_V1 fluirán directamente al STDOUT.
    }

    static dispatch(packet) {
        // Ya no es necesario
    }
    
    static async processWindows() {
        // Ya no es necesario
    }
}
