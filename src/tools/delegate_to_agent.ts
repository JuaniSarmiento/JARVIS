import { agentsRegistry } from '../agent/agents_registry.js';

export const delegateToAgentDef = {
    type: "function",
    function: {
        name: "delegate_to_agent",
        description: "Delega una tarea a un subagente especializado. Los subagentes tienen sus propias herramientas y memoria.",
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
                    description: "Cualquier información de contexto necesaria."
                }
            },
            required: ["agentName", "taskDescription"],
            additionalProperties: false
        }
    }
};

/**
 * Ejecutor de la delegación que ahora soporta el callback de progreso (onProgress).
 */
export async function executeDelegateToAgent(
    args: { agentName: string, taskDescription: string, context?: string },
    onProgress?: (msg: string) => Promise<void>
): Promise<string> {
    const { agentName, taskDescription, context } = args;
    const agent = agentsRegistry[agentName];

    if (!agent) {
        return `Error: El subagente ${agentName} no existe en el registro.`;
    }

    try {
        if (onProgress) await onProgress(`📡 Orquestador delegando misiones a **${agentName.toUpperCase()}**...`);

        // Ejecutamos la tarea del subagente pasando el callback de progreso
        const report = await agent.runTask(taskDescription, context, onProgress);

        return `REPORTE DEL SUBAGENTE ${agentName.toUpperCase()}:\n\n${report}`;
    } catch (e: any) {
        return `Error durante la ejecución del subagente ${agentName}: ${e.message}`;
    }
}
