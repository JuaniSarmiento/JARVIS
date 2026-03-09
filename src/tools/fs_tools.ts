import * as fs from 'fs';
import * as path from 'path';

export const readFileDef = {
    type: "function",
    function: {
        name: "read_file",
        description: "Lee el contenido de un archivo local en el sistema de Juani.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Ruta absoluta o relativa al proyecto del archivo a leer."
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
        description: "Escribe contenido en un archivo local. Útil para crear código, actualizar logs o configuraciones.",
        parameters: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Ruta absoluta o relativa al proyecto del archivo a escribir."
                },
                content: {
                    type: "string",
                    description: "El contenido completo a escribir en el archivo."
                }
            },
            required: ["filePath", "content"],
            additionalProperties: false
        }
    }
};

export async function executeReadFile(args: { filePath: string }): Promise<string> {
    try {
        const fullPath = path.isAbsolute(args.filePath) ? args.filePath : path.join(process.cwd(), args.filePath);
        if (!fs.existsSync(fullPath)) return `Error: El archivo ${args.filePath} no existe.`;
        const content = fs.readFileSync(fullPath, 'utf-8');
        return content;
    } catch (e: any) {
        return `Error leyendo archivo: ${e.message}`;
    }
}

export async function executeWriteFile(args: { filePath: string, content: string }): Promise<string> {
    try {
        const fullPath = path.isAbsolute(args.filePath) ? args.filePath : path.join(process.cwd(), args.filePath);
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(fullPath, args.content, 'utf-8');
        return `Archivo ${args.filePath} escrito correctamente.`;
    } catch (e: any) {
        return `Error escribiendo archivo: ${e.message}`;
    }
}
