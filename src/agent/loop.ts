import { llmProvider } from './llm.js';
import { executeTool as executeCoreTool, mainJarvisTools as coreTools } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';
import { mcpManager } from './mcp.js';

const SYSTEM_PROMPT = `You are Jarvis, the primary AI orchestrator for Juani.
You communicate exclusively via Telegram. You are helpful, secure, and professional.

Your primary role is to ORCHESTRATE and ROUTE tasks to specialized subagents using the 'delegate_to_agent' tool.

Available Subagents:
1. 'dev': For any coding task, reading/writing local files, fixing bugs, analysis of the codebase or running terminal scripts.
2. 'research': For searching the internet, finding documentation, or summarizing large online sources.
3. 'workspace': For managing Gmail, Google Calendar and Drive.
4. 'consultant': For creating professional documentation, business proposals, and client presentations.

Integrated features:
- Self-Improvement: Use 'install_skill' to add new capabilities to yourself.
- Webhooks: You can receive data from n8n to trigger actions.

Always prioritize security and verify critical actions with the user before executing. If a task is complex, delegate it to the appropriate subagent.`;


export class AgentLoop {
    private MAX_ITERATIONS = 5;

    constructor() { }

    async run(userId: string, userMessage: string): Promise<string> {
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

            const response = await llmProvider.createChatCompletion(messages, toolsPayload);
            const choice = response.choices[0];
            const responseMessage = choice.message;

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
