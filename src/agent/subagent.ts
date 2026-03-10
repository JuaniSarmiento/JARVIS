import { llmProvider } from './llm.js';
import { executeTool } from '../tools/registry.js';
import { parseRobustJSON } from '../utils/json.js';

export interface SubAgentConfig {
    name: string;
    systemPrompt: string;
    tools: any[];
}

export class SubAgent {
    private MAX_ITERATIONS = 15;

    constructor(private config: SubAgentConfig) { }

    /**
     * Ejecuta una tarea delegada con soporte para reportar progreso.
     */
    async runTask(taskDescription: string, context?: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {
        if (onProgress) await onProgress(`[SubAgent: ${this.config.name}] Iniciando: ${taskDescription.substring(0, 60)}...`);

        let messages: any[] = [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: `Tarea: ${taskDescription}\nContexto adicional: ${context || 'Ninguno'}` }
        ];

        let iterations = 0;
        while (iterations < this.MAX_ITERATIONS) {
            if (messages.length > 20) {
                messages = [messages[0], messages[1], ...messages.slice(-12)];
            }
            iterations++;

            const response = await llmProvider.createChatCompletion(messages, this.config.tools);

            if (!response || !response.choices || response.choices.length === 0) {
                console.error(`[SubAgent Error] ${this.config.name} recibió una respuesta vacía del LLM.`);
                return `El subagente ${this.config.name} recibió una respuesta vacía del proveedor de IA.`;
            }

            const responseMessage = response.choices[0].message;
            if (!responseMessage) {
                return `El subagente ${this.config.name} recibió un mensaje vacío.`;
            }

            messages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    let functionArgs: any = {};
                    let functionResponse: string;

                    try {
                        functionArgs = parseRobustJSON(toolCall.function.arguments);
                        if (onProgress) await onProgress(`[SubAgent: ${this.config.name}] Ejecutando tool: ${functionName}`);

                        // Propagamos el callback de progreso a las herramientas si lo soportan
                        functionResponse = await executeTool(functionName, functionArgs, onProgress);
                    } catch (error: any) {
                        console.error(`[SubAgent Error] ${this.config.name} falló en ${functionName}:`, error.message);
                        functionResponse = `ERROR: No se pudo ejecutar la herramienta (${error.message}). Reintenta con el formato correcto.`;
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
            if (onProgress) await onProgress(`[SubAgent: ${this.config.name}] Tarea finalizada con éxito.`);
            return finalResponse;
        }

        return `El subagente ${this.config.name} no pudo resolver la tarea tras ${this.MAX_ITERATIONS} pasos.`;
    }
}
