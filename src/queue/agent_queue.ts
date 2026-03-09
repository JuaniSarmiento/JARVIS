import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();
import { agentLoop } from '../agent/loop.js';
import { bot } from '../bot/telegram.js';

import { redisConnection } from '../db/redis.js';

export const agentQueue = new Queue('jarvis-tasks', { connection: redisConnection as any });

export const startWorker = () => {
    const worker = new Worker('jarvis-tasks', async (job: Job) => {
        const { userId, message } = job.data;
        console.log(`[Worker] Procesando tarea en segundo plano para ${userId}: "${message.substring(0, 50)}..."`);

        try {
            // Un notifier especial que envía mensajes por Telegram a medida que avanza
            const notifier = async (msg: string) => {
                await bot.api.sendMessage(userId, msg, { parse_mode: 'Markdown' });
            };

            const result = await agentLoop.run(userId, message, notifier, job.id);

            await bot.api.sendMessage(userId, `🏁 **Tarea Completada**:\n\n${result}`, { parse_mode: 'Markdown' });
        } catch (error: any) {
            console.error(`[Worker Error] Tarea fallida: ${error.message}`);
            await bot.api.sendMessage(userId, `❌ **Error en la tarea en segundo plano**:\n\n${error.message}\n\nRevisá los logs para más detalles.`);
        }
    }, { connection: redisConnection as any });

    worker.on('completed', job => {
        console.log(`[Worker] Tarea ${job.id} completada con éxito.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Tarea ${job?.id} falló: ${err.message}`);
    });

    console.log('✅ BullMQ Worker iniciado y listo para procesar tareas.');
    return worker;
};
