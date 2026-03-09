import cron from 'node-cron';
import { safeSendMessage } from '../bot/telegram.js';
import { config } from '../config/env.js';
import { llmProvider } from '../agent/llm.js';

let lastInteractionTimestamp = Date.now();
let isSchedulerActive = false;

/**
 * Actualiza el timestamp de la última interacción para medir inactividad.
 */
export function recordUserInteraction() {
    lastInteractionTimestamp = Date.now();
}

/**
 * Genera un saludo dinámico usando IA para variar la personalidad cada día.
 */
async function generateDynamicGreeting(context: string): Promise<string> {
    try {
        const messages = [
            { role: "system", content: "Eres Jarvis, el orquestador de IA personal de Juani. Eres sarcástico pero extremadamente útil, amigable y profesional. Genera un saludo breve y dinámico." },
            { role: "user", content: `Genera un mensaje de ${context}. Incluye algún comentario sobre la productividad o el código.` }
        ];
        // Usamos el LLM configurado (idealmente Copilot Pro / gpt-4o) para que sea rápido y gratis.
        const response = await llmProvider.createChatCompletion(messages);
        return response.choices[0]?.message?.content || "Hola Juani, estoy online y listo.";
    } catch (e) {
        console.error("Error generating proactive greeting:", e);
        return "Hola Juani, sistemas online. ¿En qué trabajamos hoy?";
    }
}

/**
 * Inicia los cron jobs de personalidad (Fase 1).
 */
export function startPersonalityScheduler() {
    if (isSchedulerActive) return;
    isSchedulerActive = true;
    console.log('🗣️ Personalidad Proactiva de Jarvis inicializada.');

    // Buenos días: Lunes a Viernes a las 09:00 AM (Hora Local de Servidor / Argentina)
    cron.schedule('0 9 * * 1-5', async () => {
        if (!config.telegramAllowedUserIds[0]) return;
        const mainUser = config.telegramAllowedUserIds[0];
        const greeting = await generateDynamicGreeting("Buenos Días (inicio de jornada laboral)");
        await safeSendMessage(mainUser, `☀️ *¡Buenos días Jefe!*\n\n${greeting}`);
    }, { timezone: "America/Argentina/Buenos_Aires" });

    // Buenas noches / Cierre de jornada: Lunes a Viernes a las 19:00 PM
    cron.schedule('0 19 * * 1-5', async () => {
        if (!config.telegramAllowedUserIds[0]) return;
        const mainUser = config.telegramAllowedUserIds[0];
        const greeting = await generateDynamicGreeting("Cierre de jornada (19:00 PM), felicitalo por el trabajo hecho");
        await safeSendMessage(mainUser, `🌙 *¡Jornada finalizada!*\n\n${greeting}`);
    }, { timezone: "America/Argentina/Buenos_Aires" });

    // Chequeo de inactividad (Cada 1 hora se fija si pasaron > 4 horas)
    cron.schedule('0 * * * *', async () => {
        if (!config.telegramAllowedUserIds[0]) return;

        const now = Date.now();
        const inactiveTimeHours = (now - lastInteractionTimestamp) / (1000 * 60 * 60);

        // Si pasaron más de 8 horas y es horario laboral diurno, mandar un ping sutil
        if (inactiveTimeHours > 8 && new Date().getHours() >= 10 && new Date().getHours() <= 18) {
            const mainUser = config.telegramAllowedUserIds[0];
            await safeSendMessage(mainUser, `🤖 *Ping Interno:*\n\nChe Juani, hace bastante que no me tirás ninguna tarea. ¿Todo en orden? Si estás trabado con algo de código o necesitas despliegues, chiflame.`);
            recordUserInteraction(); // Reseteamos para evitar que siga mandando
        }
    }, { timezone: "America/Argentina/Buenos_Aires" });
}
