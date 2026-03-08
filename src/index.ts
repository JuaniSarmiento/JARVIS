import { startBot } from './bot/telegram.js';
import { mcpManager } from './agent/mcp.js';

console.log('Iniciando sistema Jarvis...');

async function main() {
    try {
        // Initialize MCP tools before the bot starts
        await mcpManager.init();
        startBot();
    } catch (e) {
        console.error("Falló el arranque de Jarvis", e);
    }
}

main();
