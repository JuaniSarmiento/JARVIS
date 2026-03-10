/**
 * 🔌 Jarvis v3.0 — Event Bus (Redis Pub/Sub)
 * Comunicación inter-departamento: "El Pasillo de la Oficina"
 */

import { Redis } from 'ioredis';
import { AgentEvent, EventType } from './types.js';

type EventHandler = (event: AgentEvent) => void | Promise<void>;

export class EventBus {
    private publisher: Redis;
    private subscriber: Redis;
    private handlers: Map<string, EventHandler[]> = new Map();
    private eventLog: AgentEvent[] = [];
    private connected: boolean = false;

    // Canales de Redis
    private static readonly CHANNEL_EVENTS = 'jarvis:events';
    private static readonly CHANNEL_BLOCKS = 'jarvis:blocks';
    private static readonly CHANNEL_ESCALATIONS = 'jarvis:escalations';
    private static readonly CHANNEL_STATUS = 'jarvis:status';

    constructor() {
        const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
        this.publisher = new Redis(redisUrl);
        this.subscriber = new Redis(redisUrl);
    }

    async connect(): Promise<void> {
        if (this.connected) return;

        // Suscribirse a todos los canales
        await this.subscriber.subscribe(
            EventBus.CHANNEL_EVENTS,
            EventBus.CHANNEL_BLOCKS,
            EventBus.CHANNEL_ESCALATIONS,
            EventBus.CHANNEL_STATUS
        );

        this.subscriber.on('message', (channel: string, message: string) => {
            this.handleIncoming(message);
        });

        this.connected = true;
        console.log('[EventBus] 🔌 Conectado a Redis Pub/Sub');
    }

    async disconnect(): Promise<void> {
        if (!this.connected) return;
        await this.subscriber.unsubscribe();
        await this.subscriber.disconnect();
        await this.publisher.disconnect();
        this.connected = false;
        console.log('[EventBus] 🔌 Desconectado de Redis');
    }

    /**
     * Emitir un evento al bus
     */
    async emit(event: AgentEvent): Promise<void> {
        const channel = this.getChannelForEvent(event.type);
        const message = JSON.stringify(event);

        // Log local
        this.eventLog.push(event);
        if (this.eventLog.length > 100) this.eventLog.shift();

        console.log(`[EventBus] 📡 ${event.from} → ${event.to}: ${event.type}`);

        if (this.connected) {
            await this.publisher.publish(channel, message);
        } else {
            // Fallback local si Redis no está disponible
            this.handleIncoming(message);
        }
    }

    /**
     * Registrar un handler para un tipo de evento o departamento
     */
    on(key: string, handler: EventHandler): void {
        const existing = this.handlers.get(key) || [];
        existing.push(handler);
        this.handlers.set(key, existing);
    }

    /**
     * Desregistrar handlers
     */
    off(key: string): void {
        this.handlers.delete(key);
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

            // Dispatch a handlers por tipo de evento
            const typeHandlers = this.handlers.get(event.type) || [];
            typeHandlers.forEach(h => h(event));

            // Dispatch a handlers por destino (departamento)
            const deptHandlers = this.handlers.get(event.to) || [];
            deptHandlers.forEach(h => h(event));

            // Dispatch a handlers broadcast
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
            case 'ESCALATE':
                return EventBus.CHANNEL_ESCALATIONS;
            case 'STATUS_UPDATE':
                return EventBus.CHANNEL_STATUS;
            default:
                return EventBus.CHANNEL_EVENTS;
        }
    }
}

// Singleton
export const eventBus = new EventBus();
