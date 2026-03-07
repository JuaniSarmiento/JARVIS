import { startBot } from './bot/telegram.js';

console.log('Iniciando sistema Jarvis...');
try {
    startBot();
} catch (e) {
    console.error("Falló el arranque de Jarvis", e);
}
