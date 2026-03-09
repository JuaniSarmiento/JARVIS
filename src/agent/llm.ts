import OpenAI, { toFile } from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { randomUUID } from 'crypto';
import { config } from '../config/env.js';
import { allTools } from '../tools/registry.js';

/**
 * Helper para manejar reintentos con Backoff Exponencial.
 * Captura errores 429 (Rate Limit) y 5xx (Server Errors).
 */
export async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
    try {
        return await fn();
    } catch (error: any) {
        // En OpenAI es error.status, en Google puede variar
        const status = error.status || error.response?.status || error.code;
        const isRetryable = status === 429 || status === 500 || status === 503 || status === 504;

        if (retries > 0 && isRetryable) {
            console.warn(`[LLM Resilience] Error detectado (Status: ${status}). Reintentando en ${delay}ms... (Intentos restantes: ${retries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

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

    async createChatCompletion(messages: any[], overrideTools?: any[]): Promise<any> {
        // --- 1. INTENTO PRIMARIO: GEMINI (Refactorizado con Function Calling Nativo) ---
        if (this.geminiClient) {
            try {
                return await withRetry(async () => {
                    const toolsList = overrideTools || allTools;
                    const functionDeclarations = toolsList.map((t: any) => ({
                        name: t.function.name,
                        description: t.function.description,
                        parameters: sanitizeSchema(t.function.parameters),
                    }));

                    // Tarea 3: Instrucciones de sistema nativas (systemInstruction)
                    const systemMessage = messages.find(m => m.role === 'system');
                    const systemPrompt = systemMessage ? systemMessage.content : 'Eres Jarvis, un orquestador de IA.';

                    const model = this.geminiClient!.getGenerativeModel({
                        model: 'models/gemini-2.0-flash',
                        tools: functionDeclarations.length > 0 ? [{ functionDeclarations }] : [],
                        systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] }
                    });

                    // Filtramos los mensajes que no son de sistema para el historial del chat
                    const conversationMessages = messages.filter(m => m.role !== 'system');

                    // Tarea 2: Mapeo de Historial Nativo (incluyendo functionResponses)
                    // Gemini espera 'user', 'model', o 'function'
                    const history = conversationMessages.slice(0, -1).map(m => {
                        if (m.role === 'tool') {
                            // Respuesta de herramienta nativa
                            return {
                                role: 'function',
                                parts: [{
                                    functionResponse: {
                                        name: m.name,
                                        response: { result: m.content }
                                    }
                                }]
                            };
                        }

                        if (m.role === 'assistant') {
                            const parts: any[] = [];
                            if (m.content) parts.push({ text: m.content });

                            // Si el asistente llamó a una herramienta en el pasado, lo incluimos como functionCall
                            if (m.tool_calls) {
                                m.tool_calls.forEach((tc: any) => {
                                    parts.push({
                                        functionCall: {
                                            name: tc.function.name,
                                            args: JSON.parse(tc.function.arguments)
                                        }
                                    });
                                });
                            }
                            return { role: 'model', parts };
                        }

                        // Mensaje estándar del usuario
                        return {
                            role: 'user',
                            parts: [{ text: m.content || '' }]
                        };
                    });

                    const lastMessage = conversationMessages[conversationMessages.length - 1];
                    const chat = model.startChat({
                        history: history,
                        generationConfig: { temperature: 0.7 }
                    });

                    // Si el ultimo mensaje es el resultado de una herramienta, lo enviamos como parte con rol function
                    let response;
                    if (lastMessage.role === 'tool') {
                        response = await chat.sendMessage([{
                            functionResponse: {
                                name: lastMessage.name,
                                response: { result: lastMessage.content }
                            }
                        }]);
                    } else {
                        response = await chat.sendMessage(lastMessage.content || '');
                    }

                    const result = await response.response;
                    const candidate = result.candidates?.[0];
                    const parts = candidate?.content?.parts || [];

                    // Tarea 1: Soporte Real Multi-Tool-Call
                    const textPart = parts.find(p => p.text);
                    const toolCallParts = parts.filter(p => p.functionCall);

                    const responseMsg: any = {
                        role: 'assistant',
                        content: textPart?.text || ''
                    };

                    if (toolCallParts.length > 0) {
                        console.log(`[LLM: Gemini] Detectadas ${toolCallParts.length} llamadas a herramientas.`);
                        responseMsg.tool_calls = toolCallParts.map(p => {
                            const fc = p.functionCall!;
                            return {
                                id: randomUUID(), // ID único para cada llamada
                                type: 'function',
                                function: {
                                    name: fc.name,
                                    arguments: JSON.stringify(fc.args)
                                }
                            };
                        });
                    }

                    return { choices: [{ message: responseMsg }] };
                });
            } catch (error: any) {
                console.warn(`⚠️ Gemini falló tras reintentos (${error.message}). Saltando al enjambre de respaldo...`);
            }
        }

        // --- 2. ENJAMBRE DE RESPALDO (MISTRAL -> GROQ -> OPENROUTER) ---
        const fallbacks = [
            { client: this.mistralClient, model: 'mistral-large-latest', name: 'Mistral' },
            { client: this.groqClient, model: 'llama-3.3-70b-versatile', name: 'Groq (Llama)' },
            { client: this.fallbackClient, model: config.openRouterModel, name: 'OpenRouter' }
        ].filter(f => f.client !== null);

        for (const fallback of fallbacks) {
            try {
                return await withRetry(async () => {
                    console.log(`📡 Intentando con ${fallback.name} (${fallback.model})...`);

                    const toolsList = overrideTools || allTools;
                    const strictTools = toolsList.map((t: any) => ({
                        ...t,
                        strict: true
                    }));

                    const completionConfig: any = {
                        model: fallback.model,
                        messages: messages,
                        tools: strictTools,
                        temperature: 0.7,
                    };

                    if (!strictTools || strictTools.length === 0) {
                        completionConfig.response_format = { type: "json_object" };
                    }

                    const response = await fallback.client!.chat.completions.create(completionConfig);
                    console.log(`✅ Respuesta obtenida de ${fallback.name}`);
                    return response;
                });
            } catch (error: any) {
                console.warn(`❌ ${fallback.name} falló tras reintentos: ${error.message}`);
            }
        }

        throw new Error('Lo siento Jefe, se nos cayeron todos los enjambres de IAs tras múltiples reintentos.');
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
