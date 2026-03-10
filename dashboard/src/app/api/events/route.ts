export async function GET() {
    const stream = new ReadableStream({
        async start(controller) {
            // Import ioredis dynamically inside the API route to avoid edge runtime issues
            const { Redis } = await import('ioredis');
            const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
            const subscriber = new Redis(redisUrl);

            controller.enqueue(`data: ${JSON.stringify({ type: 'connected', msg: 'Conectado a Jarvis Kernel...' })}\n\n`);

            subscriber.subscribe('jarvis:events', 'jarvis:blocks', 'jarvis:status', (err) => {
                if (err) console.error("Redis SSE Sub Error:", err);
            });

            subscriber.on('message', (channel, message) => {
                // Send standard SSE format
                if (controller) {
                    controller.enqueue(`event: ${channel}\n`);
                    controller.enqueue(`data: ${message}\n\n`);
                }
            });

            // Keep alive mechanism
            const keepAlive = setInterval(() => {
                controller.enqueue(': keepalive\n\n');
            }, 30000);

            // Cleanup when connection closes
            return () => {
                clearInterval(keepAlive);
                subscriber.quit();
            };
        }
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            // Fix CORS warning if needed later
            'Access-Control-Allow-Origin': '*'
        }
    });
}
