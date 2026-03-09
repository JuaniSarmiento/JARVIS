import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const runScriptDef = {
    type: "function",
    function: {
        name: "run_script",
        description: "Ejecuta un comando o script en la terminal local (PowerShell/CMD/Bash). Útil para compilar, probar código o ejecutar automatizaciones.",
        parameters: {
            type: "object",
            properties: {
                command: {
                    type: "string",
                    description: "El comando a ejecutar (ej: 'npm run build', 'python script.py', 'ls -la')."
                }
            },
            required: ["command"],
            additionalProperties: false
        }
    }
};

export async function executeRunScript(args: { command: string }): Promise<string> {
    try {
        console.log(`[Shell] Ejecutando: ${args.command}`);
        const { stdout, stderr } = await execAsync(args.command);

        let output = "";
        if (stdout) output += `STDOUT:\n${stdout}\n`;
        if (stderr) output += `STDERR:\n${stderr}\n`;

        return output || "Comando ejecutado sin salida (éxito).";
    } catch (e: any) {
        let errorMsg = `Error ejecutando comando: ${e.message}`;
        if (e.stdout) errorMsg += `\nSTDOUT parcial:\n${e.stdout}`;
        if (e.stderr) errorMsg += `\nSTDERR parcial:\n${e.stderr}`;
        return errorMsg;
    }
}
