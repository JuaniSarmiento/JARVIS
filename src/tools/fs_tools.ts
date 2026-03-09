import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

/**
 * Entorno de Sandbox para el sistema de archivos.
 * Permite acceso de lectura/escritura a la raíz del proyecto para uso de CI/CD.
 */
const BASE_WORKSPACE_PATH = path.resolve(process.cwd());

/**
 * Verifica si una ruta es segura (está dentro del proyecto).
 * Previene ataques de Path Traversal apuntando a /etc u otras locaciones de OS.
 */
export function isSafePath(requestedPath: string): { safe: boolean; fullPath: string } {
    const normalizedPath = path.normalize(requestedPath);
    const fullPath = path.isAbsolute(normalizedPath)
        ? normalizedPath
        : path.resolve(BASE_WORKSPACE_PATH, normalizedPath);

    // Verificación estricta: la ruta resultante DEBE ser el base path o estar contenido dentro (con separador)
    const isSafe = fullPath === BASE_WORKSPACE_PATH || fullPath.startsWith(BASE_WORKSPACE_PATH + path.sep);
    return { safe: isSafe, fullPath };
}

// --- ESQUEMAS DE VALIDACIÓN CON ZOD ---

const ReadFileSchema = z.object({
    filePath: z.string().min(1, "El path del archivo no puede estar vacío.")
});

const WriteFileSchema = z.object({
    filePath: z.string().min(1, "El path del archivo no puede estar vacío."),
    content: z.string()
});

const ListDirSchema = z.object({
    dirPath: z.string().min(1, "El path del directorio no puede estar vacío.")
});

// --- DEFINICIÓN DE HERRAMIENTAS (MODELO LLM) ---

export const readFileDef = {
    type: "function",
    function: {
        name: "read_file",
        description: "Lee el contenido de un archivo dentro del workspace seguro.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Ruta relativa al workspace del archivo a leer."
                }
            },
            required: ["filePath"],
            additionalProperties: false
        }
    }
};

export const writeFileDef = {
    type: "function",
    function: {
        name: "write_file",
        description: "Escribe contenido en un archivo dentro del workspace seguro.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Ruta relativa al workspace del archivo a escribir."
                },
                content: {
                    type: "string",
                    description: "El contenido completo a escribir."
                }
            },
            required: ["filePath", "content"],
            additionalProperties: false
        }
    }
};

export const listDirDef = {
    type: "function",
    function: {
        name: "list_dir",
        description: "Lista archivos y carpetas dentro de un directorio del workspace seguro.",
        parameters: {
            type: "object",
            properties: {
                dirPath: {
                    type: "string",
                    description: "Ruta relativa al workspace del directorio a listar."
                }
            },
            required: ["dirPath"],
            additionalProperties: false
        }
    }
};

// --- IMPLEMENTACIÓN DE EJECUCIÓN (LÓGICA BLINDADA) ---

export async function executeReadFile(args: any): Promise<string> {
    try {
        // Validación de tipos
        const validated = ReadFileSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: Los argumentos enviados no son válidos. Detalles: ${validated.error.message}`;
        }

        const { filePath } = validated.data;
        const { safe, fullPath } = isSafePath(filePath);

        if (!safe) {
            return `ERROR DE SEGURIDAD: Acceso denegado. Solo puedes leer archivos dentro de ${BASE_WORKSPACE_PATH}.`;
        }

        if (!fs.existsSync(fullPath)) {
            return `Error: El archivo ${filePath} no existe en el workspace.`;
        }

        const content = fs.readFileSync(fullPath, 'utf-8');
        return content;
    } catch (e: any) {
        return `Error leyendo archivo: ${e.message}`;
    }
}

export async function executeWriteFile(args: any): Promise<string> {
    try {
        // Validación de tipos
        const validated = WriteFileSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: Los argumentos enviados no son válidos. Detalles: ${validated.error.message}`;
        }

        const { filePath, content } = validated.data;
        const { safe, fullPath } = isSafePath(filePath);

        if (!safe) {
            return `ERROR DE SEGURIDAD: Acceso denegado. Solo puedes escribir archivos dentro de ${BASE_WORKSPACE_PATH}.`;
        }

        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf-8');
        return `Archivo ${filePath} escrito correctamente en el workspace seguro.`;
    } catch (e: any) {
        return `Error escribiendo archivo: ${e.message}`;
    }
}

export async function executeListDir(args: any): Promise<string> {
    try {
        // Validación de tipos
        const validated = ListDirSchema.safeParse(args);
        if (!validated.success) {
            return `ERROR DE FORMATO: Los argumentos enviados no son válidos. Detalles: ${validated.error.message}`;
        }

        const { dirPath } = validated.data;
        const { safe, fullPath } = isSafePath(dirPath);

        if (!safe) {
            return `ERROR DE SEGURIDAD: Acceso denegado. Solo puedes listar directorios dentro de ${BASE_WORKSPACE_PATH}.`;
        }

        if (!fs.existsSync(fullPath)) {
            return `Error: El directorio ${dirPath} no existe en el workspace.`;
        }

        if (!fs.statSync(fullPath).isDirectory()) {
            return `Error: ${dirPath} no es un directorio.`;
        }

        const files = fs.readdirSync(fullPath);
        return files.length > 0 ? files.join('\n') : "El directorio está vacío.";
    } catch (e: any) {
        return `Error listando directorio: ${e.message}`;
    }
}
