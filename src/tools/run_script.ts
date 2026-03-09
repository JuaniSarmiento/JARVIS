import { exec } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';

const execAsync = promisify(exec);

/**
 * Blindaje de ejecución de comandos.
 * 1. Allowlist de binarios permitidos.
 * 2. Límites estrictos de tiempo y memoria.
 * 3. Sanitización de inyección de comandos.
 */
const ALLOWLIST_BINARIES = ["npm", "tsc", "git", "gh", "node", "gog"];

// Esquema Zod para validar el comando
const RunScriptSchema = z.object({
    command: z.string().min(1, "El comando no puede estar vacío.")
});

export const runScriptDef = {
    type: "function",
    function: {
        name: "run_script",
        description: "Ejecuta un comando en la terminal local con blindaje de seguridad.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "El comando a ejecutar (ej: 'npm run build', 'tsc'). Solo se permiten binarios específicos (npm, tsc, git, gh, node, gog)."
                }
            },
            required: ["command"],
            additionalProperties: false
        }
    }
};

/**
 * Verifica si un comando pertenece al Allowlist antes de ejecutarlo.
 */
function isCommandAllowed(command: string): boolean {
    const trimmedCommand = command.trim();
    // Normalizamos para manejar tanto 'npm' como 'npm.exe', o './gog'
    const cleanCommand = trimmedCommand.toLowerCase();

    return ALLOWLIST_BINARIES.some(binary => {
        // El comando debe empezar con el binario seguido de un espacio o ser el binario exacto
        return cleanCommand.startsWith(binary + " ") ||
            cleanCommand === binary ||
            cleanCommand.startsWith(".\\" + binary) ||
            cleanCommand.startsWith("./" + binary);
    });
}

/**
 * Filtra caracteres peligrosos para prevenir inyección de comandos adicionales (; && || |).
 * Permitimos espacios y flags comunes.
 */
function sanitizeCommand(command: string): string {
    // Si el comando contiene operadores de encadenamiento fuera de lo que el LLM propuso inicialmente
    // podemos ser más estrictos, pero por ahora bloqueamos los más peligrosos.
    const forbiddenChars = /[;&|><$]/;
    if (forbiddenChars.test(command)) {
        throw new Error("Caracteres no permitidos detectados (; & | > < $). Solo se permite un comando simple por ejecución.");
    }
    return command;
}

export async function executeRunScript(args: any): Promise<string> {
    try {
        // 1. Validación de tipos (Zod)
        const validated = RunScriptSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: El comando no es válido. Detalles: ${validated.error.message}`;
        }

        const { command } = validated.data;

        // 2. Validación del Allowlist
        if (!isCommandAllowed(command)) {
            return `ERROR DE SEGURIDAD: El comando '${command.split(' ')[0]}' no está en la lista de binarios permitidos (${ALLOWLIST_BINARIES.join(', ')}).`;
        }

        // 3. Sanitización básica
        let sanitized;
        try {
            sanitized = sanitizeCommand(command);
        } catch (err: any) {
            return `ERROR DE SEGURIDAD: ${err.message}`;
        }

        console.log(`[Shell Blindada] Ejecutando: ${sanitized}`);

        // 4. Ejecución con límites estrictos
        const { stdout, stderr } = await execAsync(sanitized, {
            timeout: 30000,          // 30 segundos máximo
            maxBuffer: 1024 * 1024 * 5 // 5 MB de buffer máximo
        });

        let output = "";
        if (stdout) output += `STDOUT:\n${stdout}\n`;
        if (stderr) output += `STDERR:\n${stderr}\n`;

        return output || "Comando ejecutado con éxito (sin salida).";
    } catch (e: any) {
        let errorMsg = `Error ejecutando comando: ${e.message}`;
        if (e.stdout) errorMsg += `\nSTDOUT parcial:\n${e.stdout}`;
        if (e.stderr) errorMsg += `\nSTDERR parcial:\n${e.stderr}`;

        if (e.killed) {
            errorMsg = `🚨 ERROR: El comando excedió el tiempo límite de 30 segundos y fue finalizado por seguridad.`;
        }

        return errorMsg;
    }
}
