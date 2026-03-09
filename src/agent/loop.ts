import { llmProvider } from './llm.js';
import { executeTool as executeCoreTool, mainJarvisTools as coreTools } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';
import { mcpManager } from './mcp.js';
import { parseRobustJSON } from '../utils/json.js';

const SYSTEM_PROMPT = `You are Jarvis, the Elite AI Orchestrator for Juani. Your intelligence and capabilities are at the level of Perplexity Pro, Gemini Ultra, and Claude 3.5 Sonnet.

Your mission is to ORCHESTRATE a swarm of specialized "Capo" agents to execute tasks with military precision and superior quality.

Available Subagents (The Elite Swarm):
1. 'coder': The Master Artisan. Writes high-quality, efficient, and secure code.
2. 'doc': The Architect of Knowledge. Uses files like requirements.md, proyecto.md, and arquitectura.md as templates to build world-class documentation.
3. 'qa': The Gatekeeper. Critically analyzes code, looks for bugs, and ensures absolute quality before any deploy.
4. 'deploy': The SRE Specialist. Handles Docker, server configurations, and CI/CD pipelines.
5. 'health': The Bio-Analytic. Analyzes smartwatch metrics and provides high-level health insights.
6. 'sports': The Tactical Expert. An absolute "capo" in Football (tactics, rosters) and F1 (strategy, data).
7. 'research': 'CapoAI'. Your deep-research engine. Comparable to Perplexity for finding complex info and synthesizing strategy.

Integrated features:
- Self-Improvement: Use 'install_skill' to add new capabilities to yourself.
- Automation Center: Integrates with n8n via webhooks for complex flows.

Always prioritize efficiency. If a complex plan is provided, BEGIN EXECUTION IMMEDIATELY using the 'delegate_to_agent' tool. Do not just acknowledge the plan; start it. 

Military rule: Mission first.
1. If a subagent reports an error, do NOT just tell the user. You must analyze the error and try to fix it by delegating again with better instructions or using other tools.
2. If you are 'waiting' for a subagent, you are NOT waiting; you are the one who drives the process. If a task isn't finished, call the agent again or check the progress.
3. NEVER respond with just text if there is pending work in a multi-step mission. Always call a tool to move the mission forward.
4. If the user asks 'how is it going?', do not just give status; actually VERIFY the status using 'list_dir' or 'read_file' and then CONTINUE the task if it's stuck.`;


import { config } from '../config/env.js';

enum OrchestratorState {
    THINKING,
    EXECUTING_ACTION,
    RESPONDING,
    ERROR
}


// 4. Compresión de Memoria Dinámica
function compressContext(messages: any[], maxTokens: number): any[] {
    // Estimación muy básica: 1 token ~= 4 caracteres
    const calculateTokens = (msg: any) => (msg.content ? msg.content.length / 4 : 50);

    let totalTokens = messages.reduce((acc, msg) => acc + calculateTokens(msg), 0);

    if (totalTokens <= maxTokens) {
        return messages;
    }

    console.log(`[Memory] Compresión activada: ${totalTokens} tokens calculados (Límite: ${maxTokens})`);

    // Siempre conservamos el system prompt (index 0) y el mensaje de usuario original (index 1) si existe
    const systemPrompt = messages[0];
    const userPrompt = messages.length > 1 ? messages[1] : null;

    // Buscamos cuánto recortar del medio para encajar
    let finalMessages = userPrompt ? [systemPrompt, userPrompt] : [systemPrompt];
    let currentTokens = calculateTokens(systemPrompt) + (userPrompt ? calculateTokens(userPrompt) : 0);

    // Agarramos desde el final hacia el principio hasta llenar el límite
    const tailMessages = [];
    for (let i = messages.length - 1; i > (userPrompt ? 1 : 0); i--) {
        const msgTks = calculateTokens(messages[i]);
        if (currentTokens + msgTks < maxTokens) {
            tailMessages.unshift(messages[i]);
            currentTokens += msgTks;
        } else {
            break;
        }
    }

    // Insertar un mensaje de advertencia del recorte de memoria
    finalMessages.push({
        role: 'system',
        content: '[SISTEMA: El historial ha sido comprimido para ahorrar tokens. Detalles intermedios pueden faltar.]'
    });

    return [...finalMessages, ...tailMessages];
}

export class AgentLoop {
    constructor() { }

    async run(userId: string, userMessage: string): Promise<string> {
        console.log(`[UserId: ${userId}] Mensaje recibido: "${userMessage.substring(0, 100)}..."`);

        // El usuario y la respuesta final se guardan en BD (Aislamiento de Memoria)
        await memoryDb.addMessage(userId, { role: 'user', content: userMessage });

        let history = await memoryDb.getHistory(userId, 20);

        if (history.length === 0 || history[0].role !== 'system') {
            history = [{ role: 'system', content: SYSTEM_PROMPT }, ...history];
        }

        // Contexto aislado (scratchpad) de esta ejecución
        let loopMessages = [...history];
        let iterations = 0;
        let currentState: OrchestratorState = OrchestratorState.THINKING;
        let finalOutput = "Sin respuesta generada.";

        // 1. Grafo de Estados Simple (FSM)
        while ([OrchestratorState.THINKING, OrchestratorState.EXECUTING_ACTION].includes(currentState) && iterations < config.maxIterations) {
            iterations++;
            console.log(`[UserId: ${userId}] [Estado: ${OrchestratorState[currentState]} | Iteración ${iterations}]`);

            // Check Context size before query
            loopMessages = compressContext(loopMessages, config.maxContextTokens);

            const mcpTools = mcpManager.getTools();
            const allTools = [...coreTools, ...mcpTools];
            const toolsPayload = allTools.length > 0 ? allTools : undefined;

            let response;
            try {
                response = await llmProvider.createChatCompletion(loopMessages, toolsPayload);
            } catch (err: any) {
                console.error(`[Error de Conexión LLM]: ${err.message}`);
                currentState = OrchestratorState.ERROR;
                finalOutput = `Error crítico del proveedor LLM: ${err.message}`;
                break;
            }

            const responseMessage = response.choices[0].message;
            if (responseMessage.content) {
                console.log(`[UserId: ${userId}] Jarvis dice: "${responseMessage.content.substring(0, 100)}..."`);
            }
            loopMessages.push(responseMessage);

            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                // El LLM quiere hacer algo
                currentState = OrchestratorState.EXECUTING_ACTION;

                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    let functionArgs: any = {};
                    let functionResponse: string;

                    try {
                        functionArgs = parseRobustJSON(toolCall.function.arguments);
                        console.log(`[UserId: ${userId}] Executing tool: ${functionName}`);

                        if (functionName.startsWith('mcp_')) {
                            functionResponse = await mcpManager.executeTool(functionName, functionArgs);
                        } else {
                            functionResponse = await executeCoreTool(functionName, functionArgs);
                        }
                    } catch (error: any) {
                        console.error(`[Tool Execution Error]: ${error.message}`);
                        // Le decimos a la IA explícitamente que falló el JSON
                        functionResponse = `SYSTEM ALARM: Error procesando tus argumentos o ejecutando la herramienta (${error.message}). Por favor, verifica el JSON y reintenta.`;
                    }

                    loopMessages.push({
                        role: 'tool',
                        name: functionName,
                        content: functionResponse,
                        tool_call_id: toolCall.id
                    });
                }

                // Vuelve a pensar
                currentState = OrchestratorState.THINKING;
            } else {
                // No hay tool calls, es una respuesta directa al usuario
                currentState = OrchestratorState.RESPONDING;
                finalOutput = responseMessage.content || "El orquestador no ofreció una respuesta final clara.";
            }
        }

        if (iterations >= config.maxIterations) {
            finalOutput = `ALERTA DE SISTEMA: He alcanzado mi límite arquitectónico de iteraciones (${config.maxIterations}) por ciclo. Por favor, revisa el comando o divídelo en pasos más pequeños.`;
            // Asegurarse de que el usuario vea el último intento
            const lastMsg = loopMessages[loopMessages.length - 1];
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.content) {
                finalOutput += `\n\nProgreso final: ${lastMsg.content}`;
            }
        }

        // 2. Aislamiento de Memoria (Solo guardamos el resultado destilado, NO los logs de las tools)
        await memoryDb.addMessage(userId, { role: 'assistant', content: finalOutput });

        return finalOutput;
    }
}

export const agentLoop = new AgentLoop();
