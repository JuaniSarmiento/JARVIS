import { agentsRegistry } from '../agent/agents_registry.js';

export const delegateToAgentDef = {
    type: "function",
    function: {
        name: "delegate_to_agent",
        description: "Delega una tarea a un subagente especializado (como 'dev' para programar, 'research' para buscar en internet). El resultado de la tarea te será reportado al finalizar.",
        parameters: {
            type: "object",
            properties: {
                agentName: {
                    type: "string",
                    enum: ["coder", "doc", "qa", "deploy", "health", "sports", "research"],
                    description: "El nombre del subagente especializado."
                },
                taskDescription: {
                    type: "string",
                    description: "Descripción detallada de la tarea a realizar."
                },
                context: {
                    type: "string",
                    description: "Cualquier información de contexto necesaria para que el subagente tenga éxito."
                }
            },
            required: ["agentName", "taskDescription"],
            additionalProperties: false
        }
    }
};

export async function executeDelegateToAgent(args: { agentName: string, taskDescription: string, context?: string }): Promise<string> {
    const { agentName, taskDescription, context } = args;
    const agent = agentsRegistry[agentName];

    if (!agent) {
        return `Error: El subagente ${agentName} no existe en el registro.`;
    }

    try {
        const report = await agent.runTask(taskDescription, context);
        return `REPORTE DEL SUBAGENTE ${agentName.toUpperCase()}:\n\n${report}`;
    } catch (e: any) {
        return `Error durante la ejecución del subagente ${agentName}: ${e.message}`;
    }
}
