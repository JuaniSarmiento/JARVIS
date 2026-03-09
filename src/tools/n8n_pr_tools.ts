import { execFile } from 'child_process';
import { promisify } from 'util';
import { z } from 'zod';
import { config } from '../config/env.js';

const execFileAsync = promisify(execFile);

// Esquema Zod para validar la entrada del PR
const N8nPrSchema = z.object({
    type: z.enum(['feat', 'fix', 'perf', 'test', 'docs', 'refactor', 'build', 'ci', 'chore']),
    scope: z.string().optional(),
    summary: z.string().min(1, "El resumen del PR (summary) es obligatorio."),
    body: z.string().min(1, "La descripción del PR (body) es obligatoria."),
    repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Repositorio inválido (formato: owner/repo).")
});

export const n8nPrToolsDef = {
    type: 'function',
    function: {
        name: 'create_n8n_pr',
        description: 'Crea un PR en GitHub siguiendo las convenciones de n8n. Formato: <type>(<scope>): <summary>. Usa execFile para máxima seguridad.',
        parameters: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['feat', 'fix', 'perf', 'test', 'docs', 'refactor', 'build', 'ci', 'chore'],
                    description: 'Tipo de PR.'
                },
                scope: {
                    type: 'string',
                    description: 'Alcance del PR (ej: Slack Node).'
                },
                summary: {
                    type: 'string',
                    description: 'Acción que realiza el PR (imperativo, camel case).'
                },
                body: {
                    type: 'string',
                    description: 'Descripción completa del PR.'
                },
                repo: {
                    type: 'string',
                    description: 'Repositorio destino (ej: "owner/repo").'
                }
            },
            required: ['type', 'summary', 'body', 'repo']
        }
    }
};

export async function executeN8nPrCommand(args: any): Promise<string> {
    try {
        // 1. Validación de tipos (Zod)
        const validated = N8nPrSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: PR inválido. Detalles: ${validated.error.message}`;
        }

        const { type, scope, summary, body, repo } = validated.data;

        // 2. Construcción del título
        const scopePart = scope ? `(${scope})` : '';
        const title = `${type}${scopePart}: ${summary}`;

        console.log(`[PR Creator Blindado] Intentando crear PR: "${title}" en ${repo}...`);

        // 3. Ejecución segura con execFile (No interpola strings en el shell)
        const ghArgs = [
            'pr', 'create',
            '--title', title,
            '--body', body,
            '--repo', repo
        ];

        const { stdout, stderr } = await execFileAsync('gh', ghArgs, {
            env: {
                ...process.env,
                GH_TOKEN: config.ghToken
            },
            timeout: 30000,          // Time limit
            maxBuffer: 1024 * 1024 * 5 // Memory limit
        });

        return stdout || stderr || 'PR creado correctamente.';
    } catch (error: any) {
        if (error.killed) {
            return `🚨 ERROR: El comando excedió el tiempo límite (30s) al crear el PR.`;
        }
        return `ERROR de creación de PR: ${error.message}`;
    }
}
