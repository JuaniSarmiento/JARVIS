import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { config } from '../config/env.js';

const execAsync = promisify(exec);

const GitHubSchema = z.object({
    command: z.string().min(1, "El comando 'gh' no puede estar vacío.")
});

export const githubToolsDef = {
    type: 'function',
    function: {
        name: 'github_cli',
        description: 'Interactúa con GitHub usando la CLI oficial (gh). El comando se ejecuta con límites de seguridad.',
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'Comando de la CLI gh a ejecutar (ej: "pr list --repo owner/repo"). Solo puedes usar "gh".'
                }
            },
            required: ['command'],
            additionalProperties: false
        }
    }
};

/**
 * Sanitización de los argumentos del comando gh.
 * Previene inyección mediante ; && ||, etc.
 */
function sanitizeGhArgs(args: string): string {
    const forbiddenChars = /[;&|><$]/;
    if (forbiddenChars.test(args)) {
        throw new Error("Caracteres no permitidos detectados (; & | > < $). Solo se permiten argumentos simples para 'gh'.");
    }
    return args;
}

export async function executeGithubCommand(args: any): Promise<string> {
    try {
        // 1. Validación de tipos
        const validated = GitHubSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: Argumentos inválidos. Detalles: ${validated.error.message}`;
        }

        const { command } = validated.data;

        // 2. Sanitización: Eliminar el prefijo 'gh' si el LLM lo envió (redundante)
        const rawArgs = command.trim().toLowerCase().startsWith('gh ')
            ? command.trim().substring(3)
            : command.trim();

        let sanitizedArgs;
        try {
            sanitizedArgs = sanitizeGhArgs(rawArgs);
        } catch (err: any) {
            return `ERROR DE SEGURIDAD: ${err.message}`;
        }

        console.log(`[GitHub CLI Blindado] Ejecutando: gh ${sanitizedArgs}`);

        // 3. Ejecución segura: Pasamos el token por variables de entorno nativas, NO por el comando
        const { stdout, stderr } = await execAsync(`gh ${sanitizedArgs}`, {
            env: {
                ...process.env,
                GH_TOKEN: config.ghToken
            },
            timeout: 30000,          // 30 segundos
            maxBuffer: 1024 * 1024 * 5 // 5 MB
        });

        return stdout || stderr || 'GitHub CLI: Comando ejecutado correctamente (sin salida).';
    } catch (error: any) {
        if (error.killed) {
            return `🚨 ERROR: GitHub CLI excedió el tiempo límite (30s).`;
        }
        return `GitHub CLI Error: ${error.message}`;
    }
}
