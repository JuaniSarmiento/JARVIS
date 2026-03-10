/**
 * 🏛️ Jarvis v3.0 — Department System Types
 * Interfaces centrales para la arquitectura de 5 departamentos.
 */

// ─── Tool Definition (compatible con OpenAI function calling) ──────────────
export type ToolDefinition = any;

// ─── Eventos inter-departamento ────────────────────────────────────────────
export type EventType =
    | 'TASK_START'
    | 'TASK_COMPLETE'
    | 'TASK_FAILED'
    | 'BLOCK_REQUEST'
    | 'UNBLOCK'
    | 'ESCALATE'
    | 'STATUS_UPDATE'
    | 'CROSS_DEPT_REQUEST';

export type EventPriority = 'critical' | 'high' | 'normal' | 'low';

export interface AgentEvent {
    id: string;
    type: EventType;
    from: string;       // Departamento o subagente origen
    to: string;         // Departamento destino o 'broadcast' o 'director'
    payload: any;
    timestamp: number;
    priority: EventPriority;
}

// ─── Subagente (especialista dentro de un departamento) ─────────────────────
export type SubAgentStatus = 'idle' | 'working' | 'blocked' | 'waiting_feedback' | 'error';

export interface SubAgentConfig {
    name: string;
    role: string;
    systemPrompt: string;
    tools: ToolDefinition[];
    status: SubAgentStatus;
}

// ─── Departamento (oficina con director y equipo) ──────────────────────────
export type DepartmentStatus = 'active' | 'idle' | 'blocked' | 'waiting_feedback';

export interface DepartmentConfig {
    id: string;             // ej: 'arquitecto', 'capataz', etc.
    name: string;           // ej: '🏗️ El Arquitecto Jefe'
    description: string;
    systemPrompt: string;   // Prompt del director del departamento
    subagents: SubAgentConfig[];
    tools: ToolDefinition[];
    canBlock: string[];     // IDs de departamentos que puede bloquear
    status: DepartmentStatus;
}

// ─── Resultado de ejecucion de un departamento ─────────────────────────────
export interface DepartmentResult {
    departmentId: string;
    subagentUsed: string;
    success: boolean;
    output: string;
    events: AgentEvent[];   // Eventos generados durante la ejecución
    durationMs: number;
}

// ─── Estado global compartido (Shared Memory) ──────────────────────────────
export interface SharedState {
    activeDepartments: string[];
    blockedDepartments: Map<string, string>;  // deptId → reason
    currentMission: string | null;
    biometrics: {
        heartRate?: number;
        steps?: number;
        sedentaryMinutes?: number;
        lastSync?: number;
    };
    userMood: 'focused' | 'relaxed' | 'stressed' | 'unknown';
    sprintProgress: Record<string, number>;   // deptId → % completado
}

// ─── Director routing decision ─────────────────────────────────────────────
export interface RoutingDecision {
    targetDepartment: string;
    subagentHint?: string;      // Sugerencia de qué subagente usar
    reason: string;
    priority: EventPriority;
    requiresMultipleDepts: boolean;
    deptSequence?: string[];    // Si necesita varios departamentos en orden
}
