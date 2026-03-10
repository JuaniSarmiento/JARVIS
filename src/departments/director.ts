/**
 * 🎼 Jarvis v3.0 — El Director de Orquesta
 * Este es el Kernel principal. Reemplaza parcialmente el antiguo loop.ts.
 * Escucha eventos del bus, mantiene el estado global y decide qué departamento actúa.
 */

import { DepartmentConfig, SharedState, AgentEvent, EventPriority } from './types.js';
import { eventBus } from './event_bus.js';
import { memoryDb } from '../db/firebase.js';
import { llmProvider } from '../agent/llm.js';
import { config } from '../config/env.js';
import { randomUUID } from 'crypto';
import { SubAgent, SubAgentConfig } from '../agent/subagent.js';

// Importar Departamentos
import { arquitectoDept } from './arquitecto/index.js';
import { capatazDept } from './capataz/index.js';
import { loboDept } from './lobo/index.js';
import { sargentoDept } from './sargento/index.js';
import { espejoDept } from './espejo/index.js';

export class DirectorOrchestrator {
    private departments: Map<string, DepartmentConfig> = new Map();
    private state: SharedState = {
        activeDepartments: [],
        blockedDepartments: new Map(),
        currentMission: null,
        biometrics: {},
        userMood: 'unknown',
        sprintProgress: {}
    };

    private onProgress?: (msg: string) => Promise<void>;

    constructor() {
        this.registerDepartment(arquitectoDept);
        this.registerDepartment(capatazDept);
        this.registerDepartment(loboDept);
        this.registerDepartment(sargentoDept);
        this.registerDepartment(espejoDept);

        // Suscribirse al Bus de Eventos
        this.setupEventHandlers();
    }

    private registerDepartment(dept: DepartmentConfig) {
        this.departments.set(dept.id, dept);
    }

    private setupEventHandlers() {
        eventBus.on('BLOCK_REQUEST', async (event: AgentEvent) => {
            console.log(`[Director] Recibido BLACK_REQUEST de ${event.from} para bloquear ${event.payload.target}`);
            const sourceDept = this.departments.get(event.from);

            if (sourceDept?.canBlock.includes(event.payload.target)) {
                this.state.blockedDepartments.set(event.payload.target, event.payload.reason);
                if (this.onProgress) await this.onProgress(`🛑 **¡ALERTA!** El ${sourceDept.name} ha bloqueado al departamento ${event.payload.target}. Motivo: *${event.payload.reason}*`);
            } else {
                console.warn(`[Director] Permiso denegado: ${event.from} intentó bloquear a ${event.payload.target}`);
            }
        });

        eventBus.on('UNBLOCK', async (event: AgentEvent) => {
            if (this.state.blockedDepartments.has(event.payload.target)) {
                this.state.blockedDepartments.delete(event.payload.target);
                if (this.onProgress) await this.onProgress(`✅ El bloqueo sobre ${event.payload.target} ha sido levantado.`);
            }
        });

        eventBus.on('ESCALATE', async (event: AgentEvent) => {
            if (this.onProgress) await this.onProgress(`⚠️ **ESCALADA DE ${event.from.toUpperCase()}**: ${event.payload.message}`);
        });
    }

    /**
     * Entrypoint principal (reemplaza a run() de loop.ts)
     */
    async executeMission(userId: string, userMessage: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {
        this.onProgress = onProgress;
        this.state.currentMission = userMessage;

        // 1. Guardar mensaje
        await memoryDb.addMessage(userId, { role: 'user', content: userMessage });
        const history = await memoryDb.getHistory(userId, 5);

        if (this.onProgress) await this.onProgress("🎼 **El Director** activado. Analizando la jugada maestra...");

        // 2. Event-Driven Reasoning: El Director decide qué departamento empezar usando LLM
        const targetDeptId = await this.decideRouting(userMessage, history);

        if (targetDeptId === 'direct_response') {
            // Si el Director decide que es una charla trivial, contesta él mismo.
            const response = await this.generateDirectResponse(userMessage, history);
            await memoryDb.addMessage(userId, { role: 'assistant', content: response });
            return response;
        }

        // Verificar si el departamento destino está bloqueado
        if (this.state.blockedDepartments.has(targetDeptId)) {
            const reason = this.state.blockedDepartments.get(targetDeptId);
            const msg = `❌ Jefe, intenté despertar al departamento "${targetDeptId}", pero está BLOQUEADO. Motivo: ${reason}`;
            await memoryDb.addMessage(userId, { role: 'assistant', content: msg });
            return msg;
        }

        // 3. Delegar al departamento seleccionado (Aquí se despacha el trabajo)
        const dept = this.departments.get(targetDeptId);
        if (!dept) throw new Error(`Departamento ${targetDeptId} no encontrado.`);

        if (this.onProgress) await this.onProgress(`🏢 Derivando misión a: **${dept.name}**...`);

        // En una implementación real, aquí llamaríamos a eventBus.emit(TASK_START) 
        // y esperaríamos el TASK_COMPLETE asíncronamente. Por simplicidad del MVP:
        const finalResponse = await this.executeDepartment(dept, userMessage, this.onProgress);

        await memoryDb.addMessage(userId, { role: 'assistant', content: finalResponse });
        return finalResponse;
    }

    private async decideRouting(message: string, history: any[]): Promise<string> {
        // Prompt simplificado para el routing
        const prompt = `Eres el Director de la empresa. El usuario dice: "${message}".
Departamentos disponibles:
- arquitecto: Para planear, diagramar, arquitectura.
- capataz: Para escribir código, testear y hacer deploy.
- lobo: Para analizar mercado, precios, competencia.
- sargento: Para salud, rutinas, agenda.
- espejo: Para regañar sobre procrastinación, mindset.

Responde ÚNICAMENTE con un JSON:
{ "target": "id_del_departamento" } o { "target": "direct_response" } si es charla casual.`;

        try {
            const resultMsg = await llmProvider.generateText([{ role: 'system', content: prompt }]);
            const parsed = JSON.parse(resultMsg);
            return parsed.target || 'direct_response';
        } catch (e) {
            console.error("Error en router:", e);
            return 'direct_response'; // fallback
        }
    }

    private async generateDirectResponse(message: string, history: any[]): Promise<string> {
        return await llmProvider.generateText([
            { role: 'system', content: 'Eres Jarvis, el Orquestador Principal. Responde de forma cálida, concisa y profesional.' },
            ...history,
            { role: 'user', content: message }
        ]);
    }

    // Ejecución Real del Departamento
    private async executeDepartment(dept: DepartmentConfig, task: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {
        const taskId = randomUUID();

        // 1. Emitir evento TASK_START para que el Dashboard (Netlify) sepa que empezó a trabajar
        await eventBus.emit({
            id: taskId,
            type: 'TASK_START',
            from: dept.id,
            to: 'director',
            payload: { task },
            timestamp: Date.now(),
            priority: 'normal'
        });

        // 2. Consolidar herramientas del departamento (Director + Subagentes)
        const allTools = [...(dept.tools || [])];
        for (const sa of dept.subagents || []) {
            allTools.push(...(sa.tools || []));
        }

        // 3. Crear y ejecutar el SubAgente real
        const agentConfig: SubAgentConfig = {
            name: dept.name,
            systemPrompt: dept.systemPrompt + `\n\nTu misión actual es: ${task}\nUsa tus herramientas para resolverlo.`,
            tools: allTools
        };

        const agent = new SubAgent(agentConfig);
        let finalResponse = "";

        try {
            finalResponse = await agent.runTask(task, "", onProgress);
        } catch (error: any) {
            console.error(`[Director] Error en departamento ${dept.name}:`, error);
            finalResponse = `Fallo en la ejecución del departamento: ${error.message}`;
        }

        // 4. Emitir evento TASK_COMPLETE para que el Dashboard lo pase a estado IDLE
        await eventBus.emit({
            id: randomUUID(),
            type: 'TASK_COMPLETE',
            from: dept.id,
            to: 'director',
            payload: { result: finalResponse },
            timestamp: Date.now(),
            priority: 'normal'
        });

        return finalResponse;
    }
}

export const director = new DirectorOrchestrator();
