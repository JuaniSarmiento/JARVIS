import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { agentQueue } from './queue/agent_queue.js';
import { redisConnection } from './db/redis.js';

export function startServer() {
    console.log('🚀 Iniciando Servidor Express y Dashboard de Bull Board...');
    const app = express();
    const port = process.env.PORT || 3000;

    // Configuración de Bull Board
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
        queues: [new BullMQAdapter(agentQueue)],
        serverAdapter: serverAdapter,
    });

    app.use(bodyParser.json());

    // Middleware de Auth Básica Simple para el Dashboard
    const basicAuth = (req: Request, res: Response, next: any) => {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            res.setHeader('WWW-Authenticate', 'Basic realm="Jarvis Admin"');
            return res.status(401).send('Authentication required');
        }

        const auth = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        const user = auth[0];
        const pass = auth[1];

        const adminUser = process.env.ADMIN_USER || 'admin';
        const adminPass = process.env.ADMIN_PASS || 'jarvis2026';

        if (user === adminUser && pass === adminPass) {
            next();
        } else {
            res.setHeader('WWW-Authenticate', 'Basic realm="Jarvis Admin"');
            return res.status(401).send('Authentication failed');
        }
    };

    app.use('/admin/queues', basicAuth, serverAdapter.getRouter());

    // Tarea 3: Endpoint de Salud y Estado
    app.get('/api/status/:jobId', async (req: Request, res: Response) => {
        const { jobId } = req.params;
        const status = await redisConnection.get(`jarvis:status:${jobId}`);

        if (!status) {
            return res.status(404).json({ error: 'Job not found or expired' });
        }

        res.json(JSON.parse(status));
    });

    // Endpoint genérico para recibir webhooks o peticiones de n8n
    app.post('/webhook', async (req: Request, res: Response) => {
        const { userId, message } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        console.log(`[Webhook] Recibida petición de ${userId}: ${message}`);

        try {
            // En modo webhook asíncrono, devolvemos el JobId inmediatamente
            const job = await agentQueue.add(`webhook-${userId}`, { userId, message });
            res.json({
                status: 'QUEUED',
                jobId: job.id,
                trackingUrl: `http://localhost:${port}/api/status/${job.id}`
            });
        } catch (error: any) {
            console.error('[Webhook] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    const server = app.listen(port as number, '0.0.0.0', () => {
        console.log(`📡 Servidor de Jarvis escuchando en el puerto ${port}`);
        console.log(`📊 Dashboard de colas en: http://0.0.0.0:${port}/admin/queues`);
        console.log(`🔗 Webhook disponible en: http://0.0.0.0:${port}/webhook`);
    });

    return server;
}
