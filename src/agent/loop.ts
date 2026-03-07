import { llmProvider } from './llm.js';
import { executeTool } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';

const SYSTEM_PROMPT = `You are Jarvis, a personal AI assistant built from scratch to run locally.
You communicate exclusively via Telegram. You are helpful, secure, and concise.
Provide markdown format for readability.

Your integrated skills:
1. Google Workspace (gog): You can manage Gmail/Calendar/Drive using the 'google_workspace_cli' tool.
2. GitHub (gh): You can manage issues and PRs using 'github_cli'.
3. PR Conventions (n8n): When creating PRs, you MUST use the convention: <type>(<scope>): <summary>. Types: feat, fix, perf, test, docs, refactor, build, ci, chore. Summary must use imperative present tense and be capitalized.
4. Code Quality: You can run formatting/linting via 'formatting_tools'.
5. Agent Development: You expert at creating autonomous subprocesses (agents). Use clear identifiers (lowercase-hyphens), triggering descriptions with examples, and a structured system prompt (responsibilities, process, output format).

Always prioritize security and verify critical actions with the user before executing.`;

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

            const response = await llmProvider.createChatCompletion(messages);
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
                        functionResponse = await executeTool(functionName, functionArgs);
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
