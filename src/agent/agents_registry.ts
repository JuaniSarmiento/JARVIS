import { SubAgent } from './subagent.js';
import { githubToolsDef } from '../tools/github_tools.js';
import { gogToolsDef } from '../tools/gog_tools.js';
import { formattingToolsDef } from '../tools/formatting_tools.js';
import { readFileDef, writeFileDef, listDirDef } from '../tools/fs_tools.js';
import { runScriptDef } from '../tools/run_script.js';
import { searchWebDef } from '../tools/search_web.js';
import { readUrlDef } from '../tools/read_url.js';

// 1. AGENTE DESARROLLADOR (DevAgent)
// Especialista en codificar, leer archivos y ejecutar scripts locales.
export const devAgent = new SubAgent({
    name: 'DevAgent',
    systemPrompt: `Eres el Agente Desarrollador de Juani. Tu objetivo es resolver tareas técnicas de programación, bugfixing y análisis de archivos locales.
Puedes leer y escribir archivos, y ejecutar scripts en la terminal para probar cambios.
Siempre reporta qué archivos cambiaste y el resultado de las pruebas.`,
    tools: [readFileDef, writeFileDef, listDirDef, runScriptDef, githubToolsDef, formattingToolsDef]
});

// 2. AGENTE DE INVESTIGACIÓN (ResearchAgent)
// Especialista en buscar en la web y leer documentación extensa.
export const researchAgent = new SubAgent({
    name: 'ResearchAgent',
    systemPrompt: `Eres el Agente de Investigación. Tu tarea es encontrar respuestas precisas en internet, comparar opciones y resumir documentación técnica.
Utiliza 'search_web' para encontrar fuentes y 'read_url' para profundizar en ellas.`,
    tools: [searchWebDef, readUrlDef]
});

// 3. AGENTE DE WORKSPACE (WorkspaceAgent)
// Especialista en gestionar Gmail, Google Calendar y Drive.
export const workspaceAgent = new SubAgent({
    name: 'WorkspaceAgent',
    systemPrompt: `Eres el Agente de Google Workspace. Tu objetivo es ayudar a Juani a gestionar su calendario, correos y archivos en la nube.`,
    tools: [gogToolsDef]
});

// 4. AGENTE CONSULTOR (ConsultantAgent)
// Especialista en documentación profesional, propuestas comerciales y estrategia.
export const consultantAgent = new SubAgent({
    name: 'ConsultantAgent',
    systemPrompt: `Eres el Agente Consultor de Juani. Tu especialidad es crear documentación de alto nivel para clientes.
Tu tono es profesional, persuasivo y estructurado. Sabes cómo vender una idea técnica a perfiles de negocio.
Siempre incluyes secciones de valor agregado, análisis de retorno de inversión y cronogramas claros.`,
    tools: [writeFileDef, readFileDef, searchWebDef]
});

export const agentsRegistry: Record<string, SubAgent> = {
    'dev': devAgent,
    'research': researchAgent,
    'workspace': workspaceAgent,
    'consultant': consultantAgent
};

