import { llmProvider } from './llm.js';
import { executeTool as executeCoreTool, mainJarvisTools as coreTools } from '../tools/registry.js';
import { memoryDb } from '../db/firebase.js';
import { mcpManager } from './mcp.js';
import { parseRobustJSON } from '../utils/json.js';
import { config } from '../config/env.js';
import { redisConnection } from '../db/redis.js';

/**
 * 1. DEFINICIÓN DE ESTADOS (FSM Evolucionada)
 */
export enum OrchestratorState {
    INIT = "INIT",
    REASONING = "REASONING",
    PLANNING = "PLANNING",
    EXECUTING = "EXECUTING",
    EVALUATING = "EVALUATING",
    RESPONDING = "RESPONDING",
    FATAL_ERROR = "FATAL_ERROR",
    DONE = "DONE"
}

interface PlanStep {
    id: string;
    description: string;
    dependsOn: string[]; // Tarea 1: DAG de dependencias
    status: "pending" | "running" | "completed" | "failed";
    agent?: string;
    task?: string;
    results?: string;
}

const SYSTEM_PROMPT = `You are Jarvis, the Elite AI Orchestrator. 
Your mission is to ORCHESTRATE a swarm of specialized agents (the Elite Swarm).
Be concise, surgical, and strategic. Your memory is limited; distill information.
`;

const PLANNING_PROMPT = `Genera un Grafo Acíclico Dirigido (DAG) de la misión o una respuesta directa si la consulta es simple (saludos, charlas sencillas).
Si es charla directa y NO requiere leer URLs, buscar en la web, ni usar herramientas, responde ÚNICAMENTE con:
{
  "direct_response": "Tu respuesta directa para el usuario..."
}

Si la tarea es compleja, o si el usuario te envía un link web (URL) para analizar, responde ÚNICAMENTE con:
{
  "mission_goal": "...",
  "plan": [
    { "id": "step1", "description": "...", "dependsOn": [], "agent": "research", "task": "..." },
    { "id": "step2", "description": "...", "dependsOn": ["step1"], "agent": "coder", "task": "..." }
  ]
}
⚠️ MUY IMPORTANTE: Los únicos valores válidos para "agent" son: "coder", "doc", "qa", "deploy", "health", "sports", "research". NUNCA inventes un agente que no esté en esta lista.
`;

export class JarvisOrchestrator {
    private state: OrchestratorState = OrchestratorState.INIT;
    private userId: string = "";
    private jobId: string = "";
    private history: any[] = [];
    private dag: PlanStep[] = [];
    private currentIteration: number = 0;
    private onProgress?: (msg: string) => Promise<void>;

    constructor() { }

    async run(userId: string, userMessage: string, onProgress?: (msg: string) => Promise<void>, jobId?: string): Promise<string> {
        this.userId = userId;
        this.jobId = jobId || `standalone-${Date.now()}`;
        this.onProgress = onProgress;
        this.currentIteration = 0;
        this.state = OrchestratorState.INIT;
        this.dag = [];

        await memoryDb.addMessage(userId, { role: 'user', content: userMessage });
        const dbHistory = await memoryDb.getHistory(userId, 15); // Límite de historia para ahorrar tokens

        this.history = dbHistory.length > 0 && dbHistory[0].role === 'system'
            ? dbHistory
            : [{ role: 'system', content: SYSTEM_PROMPT }, ...dbHistory];

        if (this.onProgress) await this.onProgress("🤖 **Jarvis** activado. Iniciando análisis estratégico...");
        await this.syncStatus();

        // Bucle FSM principal
        let shouldStop = false;
        while (!shouldStop) {
            const currentState = this.state as OrchestratorState;
            if (currentState === OrchestratorState.DONE || currentState === OrchestratorState.FATAL_ERROR) {
                shouldStop = true;
                break;
            }

            this.currentIteration++;
            if (this.currentIteration > config.maxIterations) {
                if (this.onProgress) await this.onProgress("🚨 **FATAL ERROR**: Límite de iteraciones alcanzado.");
                this.state = OrchestratorState.FATAL_ERROR;
                await this.syncStatus();
                break;
            }
            await this.step();
            await this.syncStatus();
        }

        const finalOutput = this.history[this.history.length - 1]?.content || "Misión finalizada.";
        await memoryDb.addMessage(userId, { role: 'assistant', content: finalOutput });
        await this.syncStatus("COMPLETED");

        return finalOutput;
    }

    private async syncStatus(terminalStatus?: string) {
        if (!this.jobId) return;

        const completed = this.dag.filter(s => s.status === 'completed').length;
        const total = this.dag.length || 1;
        const progress = Math.round((completed / total) * 100);

        const statusPayload = {
            jobId: this.jobId,
            userId: this.userId,
            state: terminalStatus || this.state,
            progress,
            currentIteration: this.currentIteration,
            tasksTotal: total,
            tasksCompleted: completed,
            plan: this.dag,
            updatedAt: new Date().toISOString()
        };

        await redisConnection.set(`jarvis:status:${this.jobId}`, JSON.stringify(statusPayload), 'EX', 3600);
        console.log(`🤖 [${this.state}] Progreso: ${progress}% - Pending: ${this.dag.filter(s => s.status === 'pending').length}`);
    }

    public async step(): Promise<void> {
        switch (this.state) {
            case OrchestratorState.INIT:
                this.state = OrchestratorState.REASONING;
                break;
            case OrchestratorState.REASONING:
                await this.executeReasoning();
                break;
            case OrchestratorState.PLANNING:
                await this.executePlanning();
                break;
            case OrchestratorState.EXECUTING:
                await this.executeParallelDAG();
                break;
            case OrchestratorState.EVALUATING:
                await this.evaluateAndReplanning();
                break;
            case OrchestratorState.RESPONDING:
                await this.executeResponding();
                break;
            default:
                this.state = OrchestratorState.DONE;
        }
    }

    /**
     * Fase 3: REASONING (Pensamiento Profundo Avanzado O1/O3-like)
     */
    private async executeReasoning(): Promise<void> {
        if (this.onProgress) await this.onProgress("🧠 **REASONING**: Pensando profundamente antes de actuar...");

        const lastMessage = this.history[this.history.length - 1]?.content || "";

        // Obtenemos lista de herramientas
        const toolsDesc = JSON.stringify(coreTools.map(t => ({ name: t.function.name, desc: t.function.description })));

        const REASONING_PROMPT = `Eres el módulo de cognición profunda de Jarvis.
Analiza la siguiente solicitud del usuario paso a paso (Chain of Thought).
Tienes acceso a estas herramientas base: ${toolsDesc} y subagentes (coder, doc, deploy, qa).
¿Qué es exactamente lo que pide? ¿Cuáles son los riesgos ocultos? ¿Qué estrategia debemos seguir?
Genera una reflexión interna concisa y concluyente.`;

        const reflection = await llmProvider.generateText(
            [{ role: 'system', content: REASONING_PROMPT }, ...this.history, { role: 'user', content: `Analiza: ${lastMessage}` }]
        );

        console.log(`\n💭 [Internal Thoughts]:\n${reflection}\n`);

        // Agregamos la reflexión de la IA al historial como mensaje de sistema (oculto mental)
        this.history.push({ role: 'system', content: `[Internal Context/Strategy]: ${reflection}` });

        this.state = OrchestratorState.PLANNING;
    }

    /**
     * Tarea 1 & 2: Creación del Plan Táctico (DAG)
     */
    private async executePlanning(): Promise<void> {
        if (this.onProgress) await this.onProgress("🧠 **STRATEGY**: Construyendo Grafo de Dependencias (DAG)...");

        const messages = [...this.history, { role: 'system', content: PLANNING_PROMPT }];
        try {
            const response = await llmProvider.createChatCompletion(messages, []);
            const parsed = parseRobustJSON(response.choices[0].message.content);

            if (parsed.direct_response) {
                this.history.push({ role: 'assistant', content: parsed.direct_response });
                this.state = OrchestratorState.DONE;
                if (this.onProgress) await this.onProgress("✨ **Respuesta Inmediata**: Conversación de bajo nivel detectada sin subagentes.");
            } else if (parsed.plan && Array.isArray(parsed.plan) && parsed.plan.length > 0) {
                this.dag = parsed.plan.map((p: any) => ({ ...p, status: "pending" }));
                if (this.onProgress) await this.onProgress(`📋 **Orden de Batalla**: ${this.dag.length} pasos estratégicos validados.`);
                this.state = OrchestratorState.EXECUTING;
            } else {
                this.history.push({ role: 'assistant', content: "El análisis no generó pasos ejecutables." });
                this.state = OrchestratorState.DONE;
            }
        } catch (e) {
            this.state = OrchestratorState.FATAL_ERROR;
        }
    }

    /**
     * Tarea 1 & 3: Ejecución de DAG con Respeto a Dependencias y Timeouts
     */
    private async executeParallelDAG(): Promise<void> {
        const now = Date.now();
        const STEP_TIMEOUT_MS = 1000 * 60 * 5; // 5 minutos de timeout por tarea

        // 1. Detector de Deadlocks / Timeouts
        const runningSteps = this.dag.filter(s => s.status === "running");
        for (const step of runningSteps) {
            const startTime = (step as any).startedAt || now;
            if (now - startTime > STEP_TIMEOUT_MS) {
                console.log(`🚨 **TIMEOUT**: El paso ${step.id} excedió los 5 min. Forzando detención.`);
                step.status = "failed";
                step.results = "ERROR: Timeout de ejecución crítica superado.";
            }
        }

        const readySteps = this.dag.filter(s =>
            s.status === "pending" &&
            s.dependsOn.every(depId => this.dag.find(d => d.id === depId)?.status === "completed")
        );

        if (readySteps.length === 0) {
            const hasFailed = this.dag.some(s => s.status === "failed");
            const allDone = this.dag.every(s => s.status === "completed");
            this.state = (hasFailed || !allDone) ? OrchestratorState.EVALUATING : OrchestratorState.RESPONDING;
            return;
        }

        // Silenciado en Telegram para no spamear
        console.log(`⚡ **PARALLEL**: Disparando ${readySteps.length} tareas independientes...`);

        // Ejecución en paralelo real controlada por el DAG
        await Promise.allSettled(readySteps.map(async (step) => {
            step.status = "running";
            (step as any).startedAt = Date.now();
            try {
                const result = await this.dispatchAgent(step);
                step.status = "completed";
                // Tarea 3: Compresión de contexto inteligente (Determinista vs LLM)
                step.results = await this.compressResult(result, this.isTechnicalStep(step));
            } catch (e) {
                step.status = "failed";
            }
        }));

        this.state = OrchestratorState.EVALUATING;
    }

    /**
     * Heurística simple para decidir si un paso es técnico/logs o lenguaje natural.
     */
    private isTechnicalStep(step: PlanStep): boolean {
        const technicalAgents = ['coder', 'deploy', 'qa'];
        return step.agent ? technicalAgents.includes(step.agent.toLowerCase()) : true;
    }

    /**
     * Dispatcher de Agente/Tool con manejo de fallos
     */
    private async dispatchAgent(step: PlanStep): Promise<string> {
        if (step.agent) {
            return await executeCoreTool("delegate_to_agent", {
                agentName: step.agent,
                taskDescription: step.task || step.description
            }); // Omitimos this.onProgress para no spamear Telegram con subagentes
        }
        return "Paso sin agente asignado.";
    }

    /**
     * Tarea 2: EVALUATING & REPLANNING (Dinámico)
     */
    private async evaluateAndReplanning(): Promise<void> {
        const failedSteps = this.dag.filter(s => s.status === "failed");

        if (failedSteps.length > 0) {
            if (this.onProgress) await this.onProgress(`🥊 **HIT RECEIVED**: El plan falló en ${failedSteps.length} pasos. Recalculando ruta...`);

            // Inyectamos los fallos en la historia para que el Replanning tenga contexto
            const failureReport = failedSteps.map(s => `ID: ${s.id} falló su misión. Motivo: ${s.results || "Desconocido"}`).join("\n");
            this.history.push({ role: 'system', content: `REPORTE DE DAÑOS:\n${failureReport}\nProcedé al REPLANNING ahora.` });

            this.state = OrchestratorState.PLANNING; // Forzamos REPLANNING (Vuelta atrás en FSM)
            return;
        }

        // Si todo va bien, inyectamos los resultados comprimidos en la historia central
        const lastResults = this.dag.filter(s => s.status === "completed" && s.results && !this.history.some(h => h.content?.includes(s.id)));
        lastResults.forEach(s => {
            this.history.push({ role: 'system', content: `RESULTADO [${s.id}]: ${s.results}` });
        });

        // Si faltan pasos por ejecutar, volvemos a EXECUTING
        const pendingSteps = this.dag.filter(s => s.status === "pending");
        this.state = pendingSteps.length > 0 ? OrchestratorState.EXECUTING : OrchestratorState.RESPONDING;

        // Limpieza final de historia si se excede el límite crítico de tokens
        if (this.history.length > 25) {
            if (this.onProgress) await this.onProgress("🧹 **CONSOLIDATING**: Comprimiendo memoria operativa...");
            this.history = [this.history[0], ...this.history.slice(-10)];
        }
    }

    /**
     * Tarea 4: Generación final de la respuesta tras completar el plan.
     */
    private async executeResponding(): Promise<void> {
        if (this.onProgress) await this.onProgress("🗣️ **RESPONDING**: Consolidando reporte final...");
        const reportPrompt = `La misión ha concluido. Todos los pasos del plan se ejecutaron.\nRedacta una respuesta final clara, amistosa y concisa resumiendo los resultados para el usuario basado en tu historial.`;

        try {
            const finalHistory = [...this.history, { role: 'system', content: reportPrompt }];
            const response = await llmProvider.createChatCompletion(finalHistory, []);
            this.history.push({ role: 'assistant', content: response.choices[0].message.content });
            this.state = OrchestratorState.DONE;
        } catch {
            this.history.push({ role: 'assistant', content: "Misión finalizada. (El reporte narrativo falló, pero las acciones se ejecutaron)." });
            this.state = OrchestratorState.FATAL_ERROR;
        }
    }

    /**
     * Tarea 3: Trimming Determinista vs Summarizer de LLM
     */
    private async compressResult(raw: string, isTechnical: boolean): Promise<string> {
        if (raw.length < 2000) return raw;

        if (isTechnical) {
            // "Fat Trimmer": Cabeza (Contexto inicial) + Cola (Error/Stacktrace)
            // No gasta latencia ni dinero del API.
            const header = raw.substring(0, 1000);
            const footer = raw.substring(raw.length - 1000);
            return `${header}\n\n[... CONTENIDO TÉCNICO TRUNCADO POR SEGURIDAD DE CONTEXTO ...]\n\n${footer}`;
        }

        try {
            // Solo usamos LLM para reportes narrativos de agentes de Research o Doc
            const prompt = `RESUMEN EJECUTIVO (Máximo 200 palabras): Extrae solo los hallazgos críticos de este reporte, ignorando la bitácora de pasos.\n\nContenido:\n${raw.substring(0, 5000)}`;
            const summary = await llmProvider.createChatCompletion([{ role: 'user', content: prompt }], []);
            return summary.choices[0].message.content;
        } catch (e) {
            return raw.substring(0, 1500) + "... [Truncado por fallo en sumador]";
        }
    }
}

export const agentLoop = new JarvisOrchestrator();
