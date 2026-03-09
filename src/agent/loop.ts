import { llmProvider } from './llm.js';
import { executeTool as executeCoreTool, mainJarvisTools as coreTools } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';
import { mcpManager } from './mcp.js';

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

Military rule: Mission first. If the user gives a clear multi-step command, execute all steps until the final result is ready or you need user input for a critical decision. Verifying 'critical actions' means things like deleting large data or high-cost transactions, NOT standard project creation.`;


export class AgentLoop {
    private MAX_ITERATIONS = 15;

    constructor() { }

    async run(userId: string, userMessage: string): Promise<string> {
        console.log(`[UserId: ${userId}] Mensaje recibido: "${userMessage.substring(0, 100)}${userMessage.length > 100 ? '...' : ''}"`);
        // Save user message to Firebase
        await memoryDb.addMessage(userId, { role: 'user', content: userMessage });

        // Retrieve conversation history from Firebase
        let messages = await memoryDb.getHistory(userId, 15);

        // Ensure system prompt is at the top
        if (messages.length === 0 || messages[0].role !== 'system') {
            messages = [{ role: 'system', content: SYSTEM_PROMPT }, ...messages];
        }

        let iterations = 0;
        while (iterations < this.MAX_ITERATIONS) {
            iterations++;

            const mcpTools = mcpManager.getTools();
            const allTools = [...coreTools, ...mcpTools];
            const toolsPayload = allTools.length > 0 ? allTools : undefined;

            console.log(`[UserId: ${userId}] [Iteración ${iterations}] Consultando a Jarvis Orchestrator...`);
            const response = await llmProvider.createChatCompletion(messages, toolsPayload);
            const choice = response.choices[0];
            const responseMessage = choice.message;

            if (responseMessage.content) {
                console.log(`[UserId: ${userId}] Jarvis dice: "${responseMessage.content.substring(0, 100)}${responseMessage.content.length > 100 ? '...' : ''}"`);
            }

            // Sanitize assistant response for future LLM calls (remove reasoning_details and other non-standard fields)
            const cleanAssistantMessage: any = {
                role: 'assistant',
                content: responseMessage.content || '',
            };
            if (responseMessage.tool_calls) {
                cleanAssistantMessage.tool_calls = responseMessage.tool_calls;
            }

            // Add assistant response to both memory and current loop context
            await memoryDb.addMessage(userId, {
                ...cleanAssistantMessage,
            });
            messages.push(cleanAssistantMessage);

            // Check if LLM wanted to call a tool
            if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
                for (const toolCall of responseMessage.tool_calls) {
                    const functionName = toolCall.function.name;
                    let functionArgs: any;

                    try {
                        const rawArgs = toolCall.function.arguments;
                        // Basic cleaning to handle common LLM screw-ups with JSON
                        const cleanArgs = rawArgs.replace(/\\n/g, '').trim();
                        functionArgs = JSON.parse(cleanArgs);
                    } catch (parseError) {
                        console.error(`[Error] Failed to parse tool arguments for ${functionName}:`, toolCall.function.arguments);
                        functionArgs = {}; // Fallback to empty object
                    }

                    let functionResponse: string;
                    try {
                        console.log(`[UserId: ${userId}] Executing tool: ${functionName}`);
                        if (functionName.startsWith('mcp_')) {
                            functionResponse = await mcpManager.executeTool(functionName, functionArgs);
                        } else {
                            functionResponse = await executeCoreTool(functionName, functionArgs);
                        }
                    } catch (error: any) {
                        functionResponse = `Error executing tool: ${error.message}`;
                    }

                    const toolMessage = {
                        role: 'tool',
                        name: functionName,
                        content: functionResponse,
                        tool_call_id: toolCall.id,
                    };

                    await memoryDb.addMessage(userId, {
                        role: 'tool',
                        name: functionName,
                        content: functionResponse,
                        tool_call_id: toolCall.id
                    });
                    messages.push(toolMessage);
                }
                // Continue loop to send tool responses back to LLM
                continue;
            }

            // No tools called, return the response content
            return responseMessage.content || 'Sin respuesta';
        }

        return "He alcanzado mi límite de iteraciones (5) tratando de resolver esto. Por favor replantea tu solicitud o pregúntame de otra forma.";
    }
}

export const agentLoop = new AgentLoop();
