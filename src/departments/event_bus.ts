/**
 * 🔌 Jarvis v3.0 — Event Bus (Redis Pub/Sub)
 * Comunicación inter-departamento: "El Pasillo de la Oficina"
 * 
 * FIXED: Now uses the shared Redis connection from db/redis.ts
 * so events published here are received by the SSE endpoint in server.ts.
 */

import { AgentEvent, EventType } from './types.js';
import { redisConnection } from '../db/redis.js';

type EventHandler = (event: AgentEvent) => void | Promise<void>;

export class EventBus {
    private publisher: typeof redisConnection;
    private handlers: Map<string, EventHandler[]> = new Map();
    private eventLog: AgentEvent[] = [];

    // Canales de Redis — must match server.ts SSE subscription
    private static readonly CHANNEL_EVENTS = 'jarvis:events';
    private static readonly CHANNEL_BLOCKS = 'jarvis:blocks';

    constructor() {
        // Use the SAME Redis connection the rest of the app uses
        this.publisher = redisConnection;
    }

    /**
     * Emitir un evento al bus (publicado vía Redis Pub/Sub)
     */
    async emit(event: AgentEvent): Promise<void> {
        const channel = this.getChannelForEvent(event.type);
        const message = JSON.stringify(event);

        // Log local
        this.eventLog.push(event);
        if (this.eventLog.length > 100) this.eventLog.shift();

        console.log(`[EventBus] 📡 ${event.from} → ${event.to}: ${event.type}`);

        try {
            await this.publisher.publish(channel, message);
        } catch (err: any) {
            console.error('[EventBus] Error publicando evento:', err.message);
            // Fallback local
            this.handleIncoming(message);
        }
    }

    /**
     * Registrar un handler para un tipo de evento
     */
    on(key: string, handler: EventHandler): void {
        const existing = this.handlers.get(key) || [];
        existing.push(handler);
        this.handlers.set(key, existing);
    }

    /**
     * Obtener el log de eventos recientes (para el Dashboard)
     */
    getRecentEvents(limit: number = 20): AgentEvent[] {
        return this.eventLog.slice(-limit);
    }

    // ─── Internals ──────────────────────────────────────────────────

    private handleIncoming(message: string): void {
        try {
            const event: AgentEvent = JSON.parse(message);

            const typeHandlers = this.handlers.get(event.type) || [];
            typeHandlers.forEach(h => h(event));

            const deptHandlers = this.handlers.get(event.to) || [];
            deptHandlers.forEach(h => h(event));

            const broadcastHandlers = this.handlers.get('broadcast') || [];
            broadcastHandlers.forEach(h => h(event));

        } catch (err) {
            console.error('[EventBus] Error procesando evento:', err);
        }
    }

    private getChannelForEvent(type: EventType): string {
        switch (type) {
            case 'BLOCK_REQUEST':
            case 'UNBLOCK':
                return EventBus.CHANNEL_BLOCKS;
            default:
                return EventBus.CHANNEL_EVENTS;
        }
    }
}

// Singleton
export const eventBus = new EventBus();
