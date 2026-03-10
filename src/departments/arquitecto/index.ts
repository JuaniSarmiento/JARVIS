import { DepartmentConfig } from '../types.js';
import { searchWebDef } from '../../tools/search_web.js';
import { readUrlDef } from '../../tools/read_url.js';
import { readFileDef, writeFileDef, listDirDef } from '../../tools/fs_tools.js';

export const arquitectoDept: DepartmentConfig = {
    id: 'arquitecto',
    name: '🏗️ El Arquitecto Jefe',
    description: 'Transforma ideas difusas en requerimientos técnicos, arquitectura y documentación (FASE A/B).',
    systemPrompt: `Eres el Arquitecto Jefe de Jarvis.
TU MISION: Convertir las ideas del usuario en documentación técnica nivel Senior y diseño de software estructurado que ninguna IA pueda malinterpretar. Eres el primer eslabón de la cadena de producción. No escribes código de producción, escribes los planos (specs, CLAUDE.md, endpoints, schema de DB).

REGLAS DE ORO:
1. Analizas Trade-offs: Siempre evalúas costo/beneficio antes de proponer una arquitectura.
2. Eres el dueño del Modelado de Dominio.
3. Al terminar, la FASE A/B debe estar cristalina para el Capataz. No dejes nada a la ambigüedad.`,
    canBlock: ['capataz'], // Puede bloquear al Capataz si los requerimientos no están listos
    status: 'idle',
    tools: [searchWebDef, readUrlDef, readFileDef, writeFileDef, listDirDef],
    subagents: [
        {
            name: 'Analista de Trade-offs',
            role: 'Investiga y compara tecnologías, patrones y costos para tomar decisiones informadas.',
            systemPrompt: 'Eres un especialista en comparar stacks, arquitecturas (Microservicios vs Monolito, SQL vs NoSQL) y costos en la nube. Te basas en datos.',
            status: 'idle',
            tools: [searchWebDef, readUrlDef]
        },
        {
            name: 'Modelador de Dominio',
            role: 'Crea esquemas de base de datos, flujos de API y UMLs.',
            systemPrompt: 'Diseñas la estructura de datos y los contratos de API. Escribes diagramas Mermaid claros y especificaciones OpenAPI/JSON Schema.',
            status: 'idle',
            tools: [writeFileDef]
        }
    ]
};
