import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config/env.js';
import { allTools } from '../tools/registry.js';

class LLMProvider {
    private groqClient: OpenAI | null = null;
    private fallbackClient: OpenAI | null = null;
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
    }

    async createChatCompletion(messages: any[], overrideTools?: any[], useFallback = false): Promise<any> {
        if (!useFallback && this.geminiClient) {
            try {
                // Determine tools to use and convert to Gemini format
                const toolsList = overrideTools || allTools;
                const functionDeclarations = toolsList.map((t: any) => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters,
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
                    // History is everything between the first user message and the very last message.
                    // The very last message is what we send with sendMessage.
                    const historySource = nonSystemMessages.slice(firstUserIdx, -1);
                    history = historySource.map(m => ({
                        role: m.role === 'assistant' ? 'model' : 'user',
                        parts: [{ text: m.content || '' }]
                    }));
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
                console.warn('Gemini Native failed, falling back to Groq...', error.message);
                return this.createChatCompletion(messages, overrideTools, true);
            }
        }

        const activeClient = useFallback ? this.fallbackClient : (this.groqClient || this.fallbackClient);
        const model = useFallback ? config.openRouterModel : 'llama-3.3-70b-versatile';

        if (!activeClient) {
            throw new Error('No valid API keys configured.');
        }

        try {
            const response = await activeClient.chat.completions.create({
                model: model,
                messages: messages,
                // @ts-ignore
                tools: overrideTools || allTools,
                temperature: 0.7,
            });
            return response;
        } catch (error: any) {
            if (!useFallback && this.fallbackClient) {
                console.warn('Primary model failed, falling back to OpenRouter...', error.message);
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

export const llmProvider = new LLMProvider();
