import { bot, startBot } from './bot/telegram.js';
import { mcpManager } from './agent/mcp.js';
import { startWorker } from './queue/agent_queue.js';

console.log('Iniciando sistema Jarvis...');

async function main() {
    try {
        // Initialize MCP tools before the bot starts
        await mcpManager.init();

        // Start background worker
        startWorker();

        startBot();

        // Graceful shutdown
        const shutdown = async () => {
            console.log("Shutting down Jarvis gracefully...");
            await bot.stop();
            process.exit(0);
        };
        process.once('SIGINT', shutdown);
        process.once('SIGTERM', shutdown);
    } catch (e) {
        console.error("Falló el arranque de Jarvis", e);
    }
}

main();
