import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { allTools } from '../tools/registry.js';

class LLMProvider {
    private groqClient: OpenAI | null = null;
    private fallbackClient: OpenAI | null = null;
    private mistralClient: OpenAI | null = null;
    private geminiClient: GoogleGenerativeAI | null = null;

    constructor() {
        if (config.groqApiKey && config.groqApiKey !== 'SUTITUYE POR EL TUYO') {
            this.groqClient = new OpenAI({
                apiKey: config.groqApiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            });
        }

        if (config.googleAiApiKey && config.googleAiApiKey !== '') {
            this.geminiClient = new GoogleGenerativeAI(config.googleAiApiKey);
        }

        if (config.openRouterApiKey && config.openRouterApiKey !== 'SUTITUYE POR EL TUYO') {
            this.fallbackClient = new OpenAI({
                apiKey: config.openRouterApiKey,
                baseURL: 'https://openrouter.ai/api/v1',
            });
        }

        if (config.mistralApiKey && config.mistralApiKey !== '') {
            this.mistralClient = new OpenAI({
                apiKey: config.mistralApiKey,
                baseURL: 'https://api.mistral.ai/v1',
            });
        }
    }

    async createChatCompletion(messages: any[], overrideTools?: any[], useFallback = false): Promise<any> {
        if (!useFallback && this.geminiClient) {
            try {
                // Determine tools to use and convert to Gemini format
                const toolsList = overrideTools || allTools;
                const functionDeclarations = toolsList.map((t: any) => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: sanitizeSchema(t.function.parameters),
                }));

                const model = this.geminiClient.getGenerativeModel({
                    model: 'models/gemini-2.5-flash',
                    tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : [],
                });

                // Gemini strictly requires the first message in history to be from 'user'.
                const nonSystemMessages = messages.filter(m => m.role !== 'system');
                const firstUserIdx = nonSystemMessages.findIndex(m => m.role === 'user');

                let history: any[] = [];
                let lastMessageContent = '';

                if (firstUserIdx !== -1) {
                    const historySource = nonSystemMessages.slice(firstUserIdx, -1);
                    history = historySource.map(m => {
                        let role = m.role === 'assistant' ? 'model' : 'user';
                        let content = m.content || '';

                        if (m.role === 'tool') {
                            role = 'user';
                            content = `[TOOL_RESULT from ${m.name}]: ${content}`;
                        } else if (m.role === 'assistant' && m.tool_calls) {
                            content += ` [ACTION: Called ${m.tool_calls[0].function.name}]`;
                        }

                        return {
                            role: role,
                            parts: [{ text: content }]
                        };
                    });
                    lastMessageContent = nonSystemMessages[nonSystemMessages.length - 1].content || '';
                } else {
                    // Fallback: If no user message at all, just use the last one.
                    lastMessageContent = messages[messages.length - 1].content || '';
                }

                const chat = model.startChat({
                    history: history,
                    generationConfig: { temperature: 0.7 }
                });

                const result = await chat.sendMessage(lastMessageContent);
                const response = await result.response;
                const candidate = response.candidates?.[0];
                const parts = candidate?.content?.parts || [];

                const textPart = parts.find(p => p.text);
                const callPart = parts.find(p => p.functionCall);

                const responseMsg: any = {
                    role: 'assistant',
                    content: textPart?.text || ''
                };

                if (callPart?.functionCall) {
                    console.log(`[UserId: Gemini] Tool Call detected: ${callPart.functionCall.name}`);
                    responseMsg.tool_calls = [{
                        id: `call_${Date.now()}`,
                        type: 'function',
                        function: {
                            name: callPart.functionCall.name,
                            arguments: JSON.stringify(callPart.functionCall.args)
                        }
                    }];
                }

                return {
                    choices: [{
                        message: responseMsg
                    }]
                };
            } catch (error: any) {
                const errorStr = error instanceof Error ? error.message : String(error);
                if (errorStr.includes('429') || errorStr.includes('Quota') || errorStr.includes('Too Many Requests')) {
                    const waitTime = 45000;
                    console.warn(`[429] Límite de cuota en Gemini. Enfriando motores por ${waitTime / 1000}s...`);
                    // Dormir el hilo para respetar el backoff
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    return this.createChatCompletion(messages, overrideTools, false);
                }
                console.warn('Gemini Native failed, falling back to Groq...', errorStr);
                return this.createChatCompletion(messages, overrideTools, true);
            }
        }

        // Fallback Chain: Mistral -> Groq -> OpenRouter (with STRICT JSON MODE)
        const activeClient = this.mistralClient || this.groqClient || this.fallbackClient;
        const model = this.mistralClient ? 'mistral-large-latest' : (this.groqClient ? 'llama-3.3-70b-versatile' : config.openRouterModel);

        if (!activeClient) {
            throw new Error('No valid API keys configured.');
        }

        // Prep tools with strict: true if supported (OpenAI-compatible)
        const toolsList = overrideTools || allTools;
        const strictTools = toolsList.map((t: any) => ({
            ...t,
            strict: true // Enforce structured outputs where supported
        }));

        const completionConfig: any = {
            model: useFallback ? (this.fallbackClient ? config.openRouterModel : model) : model,
            messages: messages,
            tools: strictTools,
            temperature: 0.7,
            response_format: { type: "json_object" } // Force JSON output for fallbacks
        };

        try {
            const response = await activeClient.chat.completions.create(completionConfig);
            return response;
        } catch (error: any) {
            if (!useFallback) {
                console.warn(`Primary fallback model (${model}) failed, attempting OpenRouter...`, error.message);
                return this.createChatCompletion(messages, overrideTools, true);
            }
            throw error;
        }
    }

    async transcribeAudio(fileBuffer: Buffer, fileName: string): Promise<string> {
        if (!this.groqClient) {
            throw new Error('Groq client is not configured for transcription.');
        }

        try {
            const file = await toFile(fileBuffer, fileName);
            const response = await this.groqClient.audio.transcriptions.create({
                file: file,
                model: 'whisper-large-v3',
            });
            return response.text;
        } catch (error: any) {
            console.error('Error transcribing audio with Groq:', error.message);
            throw error;
        }
    }
}

// Helper to sanitize JSON schema for Gemini (removes unsupported fields like additionalProperties)
function sanitizeSchema(schema: any): any {
    if (!schema || typeof schema !== 'object') return schema;

    const newSchema = { ...schema };
    delete newSchema.additionalProperties;
    delete newSchema.$schema;

    if (newSchema.properties) {
        for (const key in newSchema.properties) {
            newSchema.properties[key] = sanitizeSchema(newSchema.properties[key]);
        }
    }

    if (newSchema.items) {
        newSchema.items = sanitizeSchema(newSchema.items);
    }

    return newSchema;
}

export const llmProvider = new LLMProvider();
