import { createWriteStream } from 'fs';
import { stat, readdir } from 'fs/promises';
import { join, basename } from 'path';
import archiver from 'archiver';
import { InputFile } from 'grammy';
import { config } from '../config/env.js';
import { bot } from '../bot/telegram.js';

export const sendFileDef = {
    type: "function",
    function: {
        name: "send_file",
        description: "Comprime (si es un directorio) y envía un archivo o proyecto al usuario por Telegram.",
        parameters: {
            type: "object",
            properties: {
                path: {
                    type: "string",
                    description: "La ruta absoluta o relativa al archivo o directorio a enviar."
                },
                caption: {
                    type: "string",
                    description: "Mensaje opcional para acompañar el archivo."
                }
            },
            required: ["path"]
        }
    }
};

export async function executeSendFile(args: any, onProgress?: (msg: string) => Promise<void>): Promise<string> {
    const { path: targetPath, caption } = args;

    // Asumimos que el destinatario siempre es el usuario principal configurado
    const chatId = config.telegramAllowedUserIds[0];
    if (!chatId) return "Error: No hay destinatarios configurados en telegramAllowedUserIds.";

    try {
        const fileStat = await stat(targetPath);

        if (fileStat.isFile()) {
            if (onProgress) await onProgress(`Enviando archivo ${basename(targetPath)}...`);
            await bot.api.sendDocument(chatId, new InputFile(targetPath), { caption });
            return `Archivo ${basename(targetPath)} enviado exitosamente.`;
        }

        if (fileStat.isDirectory()) {
            if (onProgress) await onProgress(`Comprimiendo directorio ${basename(targetPath)}...`);

            const zipPath = `${targetPath}.zip`;
            const output = createWriteStream(zipPath);
            const archive = archiver('zip', { zlib: { level: 9 } });

            return new Promise((resolve, reject) => {
                output.on('close', async () => {
                    if (onProgress) await onProgress(`Directorio comprimido. Enviando ${basename(zipPath)}...`);
                    try {
                        const stats = await stat(zipPath);
                        if (stats.size > 50 * 1024 * 1024) { // Límite de 50MB de Telegram Bots
                            resolve(`Error: El archivo comprimido (${(stats.size / 1024 / 1024).toFixed(2)}MB) supera el límite de 50MB de Telegram.`);
                            return;
                        }

                        await bot.api.sendDocument(chatId, new InputFile(zipPath), { caption: caption || `Proyecto: ${basename(targetPath)}` });
                        resolve(`Directorio ${basename(targetPath)} comprimido y enviado como .zip exitosamente.`);
                    } catch (e: any) {
                        reject(`Error enviando el documento: ${e.message}`);
                    }
                });

                archive.on('error', (err) => reject(`Error comprimiendo: ${err.message}`));

                archive.pipe(output);
                archive.directory(targetPath, false);
                archive.finalize();
            });
        }

        return "El path proporcionado no es un archivo ni un directorio válido.";
    } catch (error: any) {
        return `Error al intentar enviar el archivo: ${error.message}`;
    }
}
