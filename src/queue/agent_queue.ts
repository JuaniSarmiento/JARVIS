import { Queue, Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();
import { agentLoop } from '../agent/loop.js';
import { bot } from '../bot/telegram.js';

// BullMQ connection settings
let connection: any;

if (process.env.REDIS_URL) {
    console.log('📡 [Queue] Usando REDIS_URL para la conexión.');
    connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
} else {
    console.log(`📡 [Queue] Conectando a Redis en ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`);
    connection = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: null,
    });
}

connection.on('error', (err: any) => {
    if (err.code === 'ECONNREFUSED') {
        console.error('\n❌ [ERROR CRÍTICO] No se pudo conectar a Redis.');
        console.error('========================================================');
        console.error(' Jarvis ahora requiere Redis para ejecutarse de forma asíncrona.');
        console.error(' 👉 En Local: Ejecuta "docker run -d -p 6379:6379 redis"');
        console.error(' 👉 En Railway: Agrega el plugin de Redis y setea la variable REDIS_URL');
        console.error('========================================================\n');
        process.exit(1);
    }
});

export const agentQueue = new Queue('jarvis-tasks', { connection });

export const startWorker = () => {
    const worker = new Worker('jarvis-tasks', async (job: Job) => {
        const { userId, message } = job.data;
        console.log(`[Worker] Procesando tarea en segundo plano para ${userId}: "${message.substring(0, 50)}..."`);

        try {
            // Un notifier especial que envía mensajes por Telegram a medida que avanza
            const notifier = async (msg: string) => {
                await bot.api.sendMessage(userId, msg, { parse_mode: 'Markdown' });
            };

            const result = await agentLoop.run(userId, message, notifier);

            await bot.api.sendMessage(userId, `🏁 **Tarea Completada**:\n\n${result}`, { parse_mode: 'Markdown' });
        } catch (error: any) {
            console.error(`[Worker Error] Tarea fallida: ${error.message}`);
            await bot.api.sendMessage(userId, `❌ **Error en la tarea en segundo plano**:\n\n${error.message}\n\nRevisá los logs para más detalles.`);
        }
    }, { connection });

    worker.on('completed', job => {
        console.log(`[Worker] Tarea ${job.id} completada con éxito.`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[Worker] Tarea ${job?.id} falló: ${err.message}`);
    });

    console.log('✅ BullMQ Worker iniciado y listo para procesar tareas.');
};
