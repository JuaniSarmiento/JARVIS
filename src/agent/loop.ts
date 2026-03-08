import { llmProvider } from './llm.js';
import { executeTool as executeCoreTool, tools as coreTools } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';
import { mcpManager } from './mcp.js';

const SYSTEM_PROMPT = `You are Jarvis, a personal AI assistant built from scratch to run locally.
You communicate exclusively via Telegram. You are helpful, secure, and concise.
Provide markdown format for readability.

CRITICAL: You have the ability to IMPROVE YOURSELF. You can read, write, and list your own source code using the 'file_manager' tool.
If the user asks for a new feature, a bug fix, or a code improvement, you should:
1. List the files in the 'src' directory to understand the structure.
2. Read the relevant files.
3. Plan the changes.
4. Write the updated code back to the files.
5. (Optional) Run 'formatting_tools' with action 'build' to verify your changes.

Your integrated skills:
1. Google Workspace (gog): You can manage Gmail/Calendar/Drive using the 'google_workspace_cli' tool.
2. GitHub (gh): You can manage issues and PRs using 'github_cli'.
3. Code Quality & Self-Improvement: Use 'file_manager' to edit your own code and 'formatting_tools' to build/lint.
4. Agent Development: You expert at creating autonomous subprocesses (agents). 
5. Web Search: Access real-time information using 'mcp_tavily_search'.

Always prioritize security and verify critical actions with the user before executing.`;


export class AgentLoop {
    private MAX_ITERATIONS = 5;

    constructor() { 
        mcpManager.init();
    }

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

            const response = await llmProvider.createChatCompletion(messages, allTools);
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
                    const functionArgs = JSON.parse(toolCall.function.arguments);

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
