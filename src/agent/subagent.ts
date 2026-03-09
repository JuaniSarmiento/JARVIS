import { llmProvider } from './llm.js';
import { executeTool } from '../tools/registry.js';
import { parseRobustJSON } from '../utils/json.js';

export interface SubAgentConfig {
    name: string;
    systemPrompt: string;
    tools: any[];
}

export class SubAgent {
    private MAX_ITERATIONS = 15; // Aumentado para tareas complejas como Coding

    constructor(private config: SubAgentConfig) { }

    async runTask(taskDescription: string, context?: string): Promise<string> {
        console.log(`[SubAgent: ${this.config.name}] Iniciando tarea: ${taskDescription.substring(0, 50)}...`);

        let messages: any[] = [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: `Tarea: ${taskDescription}\nContexto adicional: ${context || 'Ninguno'}` }
        ];

        let iterations = 0;
        while (iterations < this.MAX_ITERATIONS) {
            // Trim messages if they grow too large to save tokens (keep system + initial user + last 12)
            if (messages.length > 20) {
                messages = [messages[0], messages[1], ...messages.slice(-12)];
            }
            iterations++;

            const response = await llmProvider.createChatCompletion(messages, this.config.tools);
            const responseMessage = response.choices[0].message;
            messages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    let functionArgs: any = {};
                    let functionResponse: string;

                    try {
                        functionArgs = parseRobustJSON(toolCall.function.arguments);
                        console.log(`[SubAgent: ${this.config.name}] Herramienta: ${functionName}`);
                        functionResponse = await executeTool(functionName, functionArgs);
                    } catch (error: any) {
                        console.error(`[SubAgent Error] ${this.config.name} falló en ${functionName}:`, error.message);
                        // Reportamos el error al subagente para que intente corregirlo
                        functionResponse = `ERROR: No se pudo ejecutar la herramienta (${error.message}). Por favor, verifica los argumentos y vuelve a intentarlo con el formato correcto.`;
                    }

                    messages.push({
                        role: 'tool',
                        name: functionName,
                        content: functionResponse,
                        tool_call_id: toolCall.id,
                    });
                }
                continue;
            }

            const finalResponse = responseMessage.content || "Tarea completada sin reporte.";
            console.log(`[SubAgent: ${this.config.name}] Tarea finalizada.`);
            return finalResponse;
        }

        return `El subagente ${this.config.name} no pudo resolver la tarea tras ${this.MAX_ITERATIONS} pasos.`;
    }
}
