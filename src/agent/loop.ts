import { director } from '../departments/director.js';

/**
 * 🏛️ Jarvis v3.0 - Wrapper de Orquestación
 * Redirige la ejecución antigua del FSM hacia el nuevo Director de Orquesta.
 * Mantiene la interfaz antigua para no romper server.ts ni la cola.
 */

export class JarvisOrchestrator {
    constructor() { }

    async run(userId: string, userMessage: string, onProgress?: (msg: string) => Promise<void>, jobId?: string): Promise<string> {
        return await director.executeMission(userId, userMessage, onProgress);
    }
}

export const agentLoop = new JarvisOrchestrator();
