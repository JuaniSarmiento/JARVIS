/**
 * Jarvis v3.0 - El Director de Orquesta
 */

import { DepartmentConfig, SharedState, AgentEvent, EventPriority } from './types.js';
import { eventBus } from './event_bus.js';
import { memoryDb } from '../db/firebase.js';
import { llmProvider } from '../agent/llm.js';
import { config } from '../config/env.js';
import { randomUUID } from 'crypto';
import { SubAgent, SubAgentConfig } from '../agent/subagent.js';
import { mainJarvisTools } from '../tools/registry.js';

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
        this.setupEventHandlers();
    }

    private registerDepartment(dept: DepartmentConfig) {
        this.departments.set(dept.id, dept);
    }

    private setupEventHandlers() {
        eventBus.on('BLOCK_REQUEST', async (event: AgentEvent) => {
            console.log('[Director] BLOCK_REQUEST de ' + event.from + ' para ' + event.payload.target);
            const sourceDept = this.departments.get(event.from);
            if (sourceDept?.canBlock.includes(event.payload.target)) {
                this.state.blockedDepartments.set(event.payload.target, event.payload.reason);
            }
        });

        eventBus.on('UNBLOCK', async (event: AgentEvent) => {
            if (this.state.blockedDepartments.has(event.payload.target)) {
                this.state.blockedDepartments.delete(event.payload.target);
            }
        });
    }

    async executeMission(userId: string, userMessage: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {
        this.onProgress = onProgress;
        this.state.currentMission = userMessage;

        await memoryDb.addMessage(userId, { role: 'user', content: userMessage });
        const history = await memoryDb.getHistory(userId, 5);

        if (this.onProgress) await this.onProgress('🎼 **El Director** activado. Analizando...');

        const targetDeptId = await this.decideRouting(userMessage, history);

        if (targetDeptId === 'director') {
            return await this.handleDirectly(userId, userMessage, history);
        }

        if (this.state.blockedDepartments.has(targetDeptId)) {
            const reason = this.state.blockedDepartments.get(targetDeptId);
            const msg = 'Departamento ' + targetDeptId + ' bloqueado: ' + reason;
            await memoryDb.addMessage(userId, { role: 'assistant', content: msg });
            return msg;
        }

        const dept = this.departments.get(targetDeptId);
        if (!dept) {
            console.warn('[Director] Departamento ' + targetDeptId + ' no encontrado. Fallback.');
            return await this.handleDirectly(userId, userMessage, history);
        }

        if (this.onProgress) await this.onProgress('🏢 Derivando misión a: **' + dept.name + '**...');

        const finalResponse = await this.executeDepartment(dept, userMessage, this.onProgress);
        await memoryDb.addMessage(userId, { role: 'assistant', content: finalResponse });
        return finalResponse;
    }

    private async decideRouting(message: string, history: any[]): Promise<string> {
        const prompt = 'Eres el Director de Jarvis. Decide QUIEN maneja el pedido.\n' +
            'REGLA: La mayoría los manejas TÚ (director). Solo delega si es ESPECÍFICAMENTE del dominio.\n' +
            'Opciones:\n' +
            '- "director": preguntas generales, búsquedas, hora, charla casual, traducciones, conocimiento general.\n' +
            '- "arquitecto": SOLO diseño de software, arquitectura, modelado de datos.\n' +
            '- "capataz": SOLO escribir/modificar código, tests, deploys.\n' +
            '- "lobo": SOLO análisis financiero, mercado, precios.\n' +
            '- "sargento": SOLO monitoreo de salud/fitness, biométricos.\n' +
            '- "espejo": SOLO evaluación de productividad, procrastinación.\n\n' +
            'El usuario dice: "' + message + '"\n\n' +
            'Responde ÚNICAMENTE con JSON: { "target": "director" } o { "target": "id_departamento" }';

        try {
            const resultMsg = await llmProvider.generateText([{ role: 'system', content: prompt }]);
            const jsonMatch = resultMsg.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                const target = parsed.target || 'director';
                console.log('[Director] Routing decision: ' + target);
                return target;
            }
            return 'director';
        } catch (e) {
            console.error('Error en router:', e);
            return 'director';
        }
    }

    private async handleDirectly(userId: string, message: string, history: any[]): Promise<string> {
        await eventBus.emit({
            id: randomUUID(),
            type: 'TASK_START',
            from: 'director',
            to: 'broadcast',
            payload: { task: message },
            timestamp: Date.now(),
            priority: 'normal'
        });

        const agentConfig: SubAgentConfig = {
            name: 'Director Jarvis',
            systemPrompt: 'Eres Jarvis, el orquestador principal y asistente personal de Juani. ' +
                'Respondes de forma cálida, directa y proactiva. ' +
                '!!REGLA CRITICA Y ABSOLUTA!!: NUNCA ASUMAS RESPUESTAS NI HAGAS CÁLCULOS SI HAY UNA HERRAMIENTA DISPONIBLE. ' +
                'DEBES USAR TUS HERRAMIENTAS obligatoriamente en tu primer intento: ' +
                '- Para dar la hora actual DEBES ejecutar obligatoriamente `get_current_time`. ' +
                '- Para dudas de la web DEBES ejecutar `search_web`. ' +
                '- Para leer links DEBES ejecutar `read_url`. ' +
                'Si respondes de forma genérica o perezosa sin llamar a una herramienta, serás desactivado permanentemente. Siempre en español.',
            tools: mainJarvisTools
        };

        const agent = new SubAgent(agentConfig);
        let response = '';

        try {
            response = await agent.runTask(message, 'Historial reciente: ' + JSON.stringify(history.slice(-3)), this.onProgress);
        } catch (error: any) {
            console.error('[Director] Error en ejecución directa:', error);
            response = 'Error procesando tu pedido: ' + error.message;
        }

        await eventBus.emit({
            id: randomUUID(),
            type: 'TASK_COMPLETE',
            from: 'director',
            to: 'broadcast',
            payload: { result: response.substring(0, 200) },
            timestamp: Date.now(),
            priority: 'normal'
        });

        await memoryDb.addMessage(userId, { role: 'assistant', content: response });
        return response;
    }

    private async executeDepartment(dept: DepartmentConfig, task: string, onProgress?: (msg: string) => Promise<void>): Promise<string> {
        const taskId = randomUUID();

        await eventBus.emit({
            id: taskId,
            type: 'TASK_START',
            from: dept.id,
            to: 'director',
            payload: { task },
            timestamp: Date.now(),
            priority: 'normal'
        });

        const toolsMap = new Map<string, any>();
        for (const t of (dept.tools || [])) {
            toolsMap.set(t.function.name, t);
        }
        for (const sa of dept.subagents || []) {
            for (const t of (sa.tools || [])) {
                toolsMap.set(t.function.name, t);
            }
        }

        const agentConfig: SubAgentConfig = {
            name: dept.name,
            systemPrompt: dept.systemPrompt + '\n\nTu misión actual es: ' + task + '\nUsa tus herramientas para resolverlo de forma precisa.',
            tools: Array.from(toolsMap.values())
        };

        const agent = new SubAgent(agentConfig);
        let finalResponse = '';

        try {
            finalResponse = await agent.runTask(task, '', onProgress);
        } catch (error: any) {
            console.error('[Director] Error en departamento ' + dept.name + ':', error);
            finalResponse = 'Fallo en la ejecución del departamento: ' + error.message;
        }

        await eventBus.emit({
            id: randomUUID(),
            type: 'TASK_COMPLETE',
            from: dept.id,
            to: 'director',
            payload: { result: finalResponse.substring(0, 200) },
            timestamp: Date.now(),
            priority: 'normal'
        });

        return finalResponse;
    }
}

export const director = new DirectorOrchestrator();
