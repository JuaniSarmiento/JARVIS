import OpenAI, { toFile } from 'openai';
import { config } from '../config/env.js';
import { allTools } from '../tools/registry.js';

class LLMProvider {
    private groqClient: OpenAI | null = null;
    private fallbackClient: OpenAI | null = null;
    private geminiClient: OpenAI | null = null;

    constructor() {
        if (config.groqApiKey && config.groqApiKey !== 'SUTITUYE POR EL TUYO') {
            this.groqClient = new OpenAI({
                apiKey: config.groqApiKey,
                baseURL: 'https://api.groq.com/openai/v1',
            });
        }

        if (config.googleAiApiKey && config.googleAiApiKey !== '') {
            this.geminiClient = new OpenAI({
                apiKey: config.googleAiApiKey,
                baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
            });
        }

        if (config.openRouterApiKey && config.openRouterApiKey !== 'SUTITUYE POR EL TUYO') {
            this.fallbackClient = new OpenAI({
                apiKey: config.openRouterApiKey,
                baseURL: 'https://openrouter.ai/api/v1',
            });
        }
    }

    async createChatCompletion(messages: any[], overrideTools?: any[], useFallback = false): Promise<any> {
        let activeClient: OpenAI | null = null;
        let model = '';

        if (useFallback) {
            activeClient = this.fallbackClient;
            model = config.openRouterModel;
        } else {
            // Prioridad: 1. Gemini Pro (Elite), 2. Groq (Fast), 3. OpenRouter (Fallback)
            activeClient = this.geminiClient || this.groqClient || this.fallbackClient;
            if (activeClient === this.geminiClient) model = 'gemini-1.5-pro';
            else if (activeClient === this.groqClient) model = 'llama-3.3-70b-versatile';
            else model = config.openRouterModel;
        }

        if (!activeClient) {
            throw new Error('No valid API keys configured for Gemini, Groq or OpenRouter. Check your .env file.');
        }

        const isUsingFallback = activeClient === this.fallbackClient;

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
            if (!isUsingFallback && this.fallbackClient) {
                console.warn('Groq requested failed, falling back to OpenRouter...', error.message);
                return this.createChatCompletion(messages, overrideTools, true);
            }
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
