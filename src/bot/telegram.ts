import { Bot } from 'grammy';
import { config } from '../config/env.js';
import { agentLoop } from '../agent/loop.js';
import { llmProvider } from '../agent/llm.js';
import { memoryDb } from '../db/firebase.js';

// Helper to send long messages in chunks
async function sendLongMessage(ctx: any, text: string) {
  const MAX_LENGTH = 4000;
  if (text.length <= MAX_LENGTH) {
    return ctx.reply(text, { parse_mode: 'Markdown' }).catch(() => {
      ctx.reply(text);
    });
  }

  const chunks = [];
  for (let i = 0; i < text.length; i += MAX_LENGTH) {
    chunks.push(text.substring(i, i + MAX_LENGTH));
  }

  for (const chunk of chunks) {
    await ctx.reply(chunk, { parse_mode: 'Markdown' }).catch(() => {
      ctx.reply(chunk);
    });
  }
}

export const bot = new Bot(config.telegramBotToken);

export function startBot() {
  if (!config.telegramBotToken || config.telegramBotToken === 'SUTITUYE POR EL TUYO') {
    console.error('❌ El TELEGRAM_BOT_TOKEN no está configurado. El bot no puede arrancar.');
    return;
  }

  // Security Middleware: Whitelist
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id.toString();
    if (!userId) return; // Ignore updates without user ID

    if (!config.telegramAllowedUserIds.includes(userId)) {
      console.log(`[Security] Bloqueado mensaje de usuario no autorizado: ${userId}`);
      // Opcional: ctx.reply('No estás autorizado para usar este bot.');
      return;
    }
    await next();
  });

  bot.command('start', (ctx) => {
    ctx.reply('Hola, soy Jarvis. Tu asistente de inteligencia artificial personal funcionando en local con memoria en Firebase. ¿En qué te puedo ayudar hoy?');
  });

  bot.command('clear', async (ctx) => {
    const userId = ctx.from?.id.toString();
    if (userId) {
      await memoryDb.clearHistory(userId);
      ctx.reply('Cerebro reseteado para esta conversación. He olvidado el contexto anterior en Firebase.');
    }
  });

  bot.command('async', async (ctx) => {
    const userId = ctx.from?.id.toString();
    const text = ctx.match;
    if (!userId || !text) return ctx.reply('Uso: /async <tu tarea>');

    // Inyectar a BullMQ
    const { agentQueue } = await import('../queue/agent_queue.js');
    await agentQueue.add('jarvis-task', { userId, message: text });
    ctx.reply('🚀 **Tarea encolada en modo asíncrono para ejecución táctica.** Podés irte a dormir, te aviso por acá cuando termine.', { parse_mode: 'Markdown' });
  });

  bot.on('message:text', async (ctx) => {
    const userId = ctx.from.id.toString();
    const text = ctx.message.text;

    try {
      // 100% Async Queuing
      const { agentQueue } = await import('../queue/agent_queue.js');
      await agentQueue.add('jarvis-task', { userId, message: text });
      return ctx.reply('📥 **Tarea encolada en segundo plano.** Podés irte a hacer otra cosa, te notifico por acá cuando tu enjambre termine.', { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error(`Error procesando mensaje de ${userId}:`, error);
      ctx.reply('Ocurrió un error inesperado al procesar tu solicitud. ' + error.message);
    }
  });

  bot.on('message:voice', async (ctx) => {
    const userId = ctx.from.id.toString();

    try {
      await ctx.replyWithChatAction('typing');

      const file = await ctx.getFile();
      const fileUrl = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;

      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error('No se pudo descargar el audio de Telegram');

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const transcription = await llmProvider.transcribeAudio(buffer, 'voice.ogg');
      console.log(`[Audio] Transcripción para ${userId}: ${transcription}`);

      const { agentQueue } = await import('../queue/agent_queue.js');
      await agentQueue.add('jarvis-task', { userId, message: transcription });

      return ctx.reply(`🎙 _"${transcription}"_\n\n📥 **Tarea de voz encolada en segundo plano.**`, { parse_mode: 'Markdown' });
    } catch (error: any) {
      console.error(`Error procesando audio de ${userId}:`, error);
      ctx.reply('Lo siento, tuve un problema procesando tu mensaje de voz. ' + error.message);
    }
  });

  bot.catch((err) => {
    const ctx = err.ctx;
    console.error(`[Error] Error al procesar actualizacion ${ctx.update.update_id}:`, err.error);
  });

  bot.start({
    drop_pending_updates: true,
    onStart: (botInfo) => {
      console.log(`🤖 Jarvis Telegram Bot conectado y escuchando comandos como @${botInfo.username}`);
    }
  });
}
