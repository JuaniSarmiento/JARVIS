import { describe, it, expect, vi, beforeEach } from 'vitest';
import { JarvisOrchestrator, OrchestratorState } from '../../src/agent/loop.js';
import { llmProvider } from '../../src/agent/llm.js';
import { memoryDb } from '../../src/db/firebase.js';

// --- MOCKS DE DEPENDENCIAS CRÍTICAS ---
vi.mock('../../src/agent/llm.js', () => ({
    llmProvider: {
        createChatCompletion: vi.fn(),
    }
}));

vi.mock('../../src/db/firebase.js', () => ({
    memoryDb: {
        addMessage: vi.fn().mockResolvedValue(true),
        getHistory: vi.fn().mockResolvedValue([]),
    }
}));

vi.mock('../../src/db/redis.js', () => ({
    redisConnection: {
        set: vi.fn().mockResolvedValue('OK'),
    }
}));

describe('JarvisOrchestrator: State Machine Logic', () => {
    let orchestrator: JarvisOrchestrator;

    beforeEach(() => {
        orchestrator = new JarvisOrchestrator();
        vi.clearAllMocks();
    });

    it('debe transicionar de INIT -> PLANNING en el primer step', async () => {
        // Accedemos al estado privado para el test (solo lectura)
        expect((orchestrator as any).state).toBe(OrchestratorState.INIT);

        await orchestrator.step();

        expect((orchestrator as any).state).toBe(OrchestratorState.PLANNING);
    });

    it('debe transicionar de PLANNING -> EXECUTING tras recibir un plan válido del LLM', async () => {
        // Preparamos el mock del LLM para devolver el JSON del plan
        const mockPlanResponse = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        mission_goal: "Test Mission",
                        plan: [
                            { id: "step1", description: "Test Step", dependsOn: [], agent: "coder", task: "code it" }
                        ]
                    })
                }
            }]
        };
        (llmProvider.createChatCompletion as any).mockResolvedValue(mockPlanResponse);

        // Forzamos el estado inicial de planning
        (orchestrator as any).state = OrchestratorState.PLANNING;

        await orchestrator.step();

        // Tras ejecutar planning exitosamente, debe pasar a ejecutar
        expect((orchestrator as any).state).toBe(OrchestratorState.EXECUTING);
        expect((orchestrator as any).dag.length).toBe(1);
    });

    it('debe transicionar a FATAL_ERROR si el LLM falla estrepitosamente en PLANNING', async () => {
        (llmProvider.createChatCompletion as any).mockRejectedValue(new Error('API Down'));

        (orchestrator as any).state = OrchestratorState.PLANNING;

        await orchestrator.step();

        expect((orchestrator as any).state).toBe(OrchestratorState.FATAL_ERROR);
    });
});
