import { llmProvider } from './llm.js';
import { executeTool } from '../tools/registry.js';

export interface SubAgentConfig {
    name: string;
    systemPrompt: string;
    tools: any[];
}

export class SubAgent {
    private MAX_ITERATIONS = 10;

    constructor(private config: SubAgentConfig) { }

    async runTask(taskDescription: string, context?: string): Promise<string> {
        console.log(`[SubAgent: ${this.config.name}] Iniciando tarea: ${taskDescription.substring(0, 50)}...`);

        let messages: any[] = [
            { role: 'system', content: this.config.systemPrompt },
            { role: 'user', content: `Tarea: ${taskDescription}\nContexto adicional: ${context || 'Ninguno'}` }
        ];

        let iterations = 0;
        while (iterations < this.MAX_ITERATIONS) {
            // Trim messages if they grow too large to save tokens (keep system + initial user + last 10)
            if (messages.length > 15) {
                messages = [messages[0], messages[1], ...messages.slice(-10)];
            }
            iterations++;

            // Usamos llmProvider para la inferencia, pasando las herramientas específicas del subagente
            const response = await llmProvider.createChatCompletion(messages, this.config.tools, false);
            const responseMessage = response.choices[0].message;
            messages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    const functionArgs = JSON.parse(toolCall.function.arguments);

                    console.log(`[SubAgent: ${this.config.name}] Herramienta: ${functionName}`);
                    const functionResponse = await executeTool(functionName, functionArgs);

                    messages.push({
                        role: 'tool',
                        name: functionName,
                        content: functionResponse,
                        tool_call_id: toolCall.id,
                    });
                }
                continue;
            }

            return responseMessage.content || "Tarea completada sin reporte.";
        }

        return `El subagente ${this.config.name} no pudo resolver la tarea tras ${this.MAX_ITERATIONS} pasos.`;
    }
}
