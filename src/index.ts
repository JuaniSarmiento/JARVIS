import { bot, startBot } from './bot/telegram.js';
import { mcpManager } from './agent/mcp.js';
import { startWorker } from './queue/agent_queue.js';
import { startServer } from './server.js';
import { spawn, ChildProcess } from 'child_process';

console.log('Iniciando sistema Jarvis...');

async function main() {
    let copilotProxy: ChildProcess | null = null;

    try {
        if (process.env.GH_TOKEN && process.env.GH_TOKEN !== '') {
            console.log('🚀 Localizado GH_TOKEN. Lanzando Copilot Proxy integrado (npx copilot-api)...');
            copilotProxy = spawn('npx', ['copilot-api', 'start', '--port', '4141', '--github-token', process.env.GH_TOKEN], {
                shell: true,
                stdio: 'pipe' // Para no ensuciar excesivamente los logs, aunque podemos hacerlo inherit
            });

            copilotProxy.stdout?.on('data', data => console.log(`[Copilot Proxy] ${data.toString().trim()}`));
            copilotProxy.stderr?.on('data', data => console.error(`[Copilot Proxy Error] ${data.toString().trim()}`));
        }

        console.log('📦 Inicializando MCP...');
        await mcpManager.init();
        console.log('✅ MCP listo.');

        console.log('⚙️ Iniciando Worker...');
        const worker = startWorker();
        console.log('✅ Worker iniciado.');

        console.log('🌐 Iniciando Servidor...');
        const server = startServer();
        console.log('✅ Servidor iniciado.');

        console.log('🤖 Iniciando Bot...');
        startBot();

        // Graceful shutdown
        const shutdown = async (signal: string) => {
            console.log(`\n🛑 Recibida señal ${signal}. Shutting down Jarvis gracefully...`);
            try {
                console.log('Cerrando Bot de Telegram...');
                await bot.stop();

                console.log('Deteniendo Worker de BullMQ...');
                await worker.close();

                console.log('Cerrando Servidor Express...');
                server.close();

                const { redisConnection } = await import('./db/redis.js');
                console.log('Desconectando Redis...');
                await redisConnection.quit();

                if (copilotProxy) {
                    console.log('Deteniendo Copilot Proxy...');
                    copilotProxy.kill('SIGTERM');
                }

                console.log('✅ Graceful shutdown completado.');
                process.exit(0);
            } catch (err) {
                console.error('❌ Error durante shutdown:', err);
                process.exit(1);
            }
        };

        process.once('SIGINT', () => shutdown('SIGINT'));
        process.once('SIGTERM', () => shutdown('SIGTERM'));
    } catch (e) {
        console.error("Falló el arranque de Jarvis", e);
    }
}

main();
