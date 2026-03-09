import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import { agentLoop } from './agent/loop.js';

export function startServer() {
    const app = express();
    const port = process.env.PORT || 3000;

    app.use(bodyParser.json());

    // Endpoint genérico para recibir webhooks o peticiones de n8n
    app.post('/webhook', async (req: Request, res: Response) => {
        const { userId, message, context } = req.body;

        if (!userId || !message) {
            return res.status(400).json({ error: 'userId and message are required' });
        }

        console.log(`[Webhook] Recibida petición de ${userId}: ${message}`);

        try {
            // Pasamos el mensaje al loop principal de Jarvis
            // El contexto opcional podría inyectarse en el historial si fuera necesario
            const response = await agentLoop.run(userId, message);
            res.json({ response });
        } catch (error: any) {
            console.error('[Webhook] Error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    app.listen(port, () => {
        console.log(`📡 Servidor de Jarvis escuchando en el puerto ${port}`);
        console.log(`🔗 Endpoint disponible en: http://localhost:${port}/webhook`);
    });
}
