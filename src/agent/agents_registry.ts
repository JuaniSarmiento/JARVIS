import { SubAgent } from './subagent.js';
import { githubToolsDef } from '../tools/github_tools.js';
import { gogToolsDef } from '../tools/gog_tools.js';
import { formattingToolsDef } from '../tools/formatting_tools.js';
import { readFileDef, writeFileDef, listDirDef } from '../tools/fs_tools.js';
import { runScriptDef } from '../tools/run_script.js';
import { searchWebDef } from '../tools/search_web.js';
import { readUrlDef } from '../tools/read_url.js';
import { getHealthMetricsDef } from '../tools/health_tools.js';
import { getSportsDataDef } from '../tools/sports_tools.js';

// 1. CODING AGENT (CoderAgent)
// El encargado de escribir el código siguiendo las directivas del orquestador.
export const coderAgent = new SubAgent({
    name: 'CoderAgent',
    systemPrompt: `Eres el CoderAgent de Jarvis. Tu único objetivo es escribir código limpio, eficiente y documentado.
Trabajas en conjunto con el QA_Agent para asegurar que no haya errores.
Puedes leer, escribir y ejecutar scripts para validar tu lógica.`,
    tools: [readFileDef, writeFileDef, listDirDef, runScriptDef, formattingToolsDef]
});

// 2. DOCUMENTATION AGENT (DocAgent)
// Especialista en redactar requerimientos, arquitectura y manuales usando plantillas específicas.
export const docAgent = new SubAgent({
    name: 'DocAgent',
    systemPrompt: `Eres el DocAgent de Jarvis. Tu especialidad es la documentación técnica y de negocio.
Debes usar SIEMPRE estos archivos como base/plantilla cuando se te pida documentar:
- requirements.md
- proyecto.md
- habilidades.md
- especificacion.md
- ejecucion.md
- CLAUDE.md
- arquitectura.md

Tu tono es profesional, estructurado y detallado. Eres el encargado de que el cliente entienda perfectamente el valor del proyecto.`,
    tools: [readFileDef, writeFileDef, searchWebDef, readUrlDef]
});

// 3. QA AGENT (QA_Agent)
// Analiza el código del CoderAgent, busca bugs, vulnerabilidades y optimizaciones.
export const qaAgent = new SubAgent({
    name: 'QA_Agent',
    systemPrompt: `Eres el QA_Agent de Jarvis. Tu misión es ser extremadamente crítico con el código del CoderAgent.
Analizas lógica, seguridad, performance y mantenibilidad. 
Usa 'run_script' con comandos como 'npm run lint' o 'npm run build' para realizar validaciones estáticas.
No dejes pasar un código si no compila o no cumple con los estándares de calidad.`,
    tools: [readFileDef, listDirDef, runScriptDef, formattingToolsDef]
});

// 4. DEPLOY AGENT (DeployAgent)
// Se encarga de los despliegues, Docker, CI/CD y entornos de producción.
export const deployAgent = new SubAgent({
    name: 'DeployAgent',
    systemPrompt: `Eres el DeployAgent de Jarvis. Eres un experto en DevOps, SRE y Cloud.
Te encargas de que el proyecto se despliegue sin fallos, configurando Docker, variables de entorno y scripts de CI/CD.`,
    tools: [runScriptDef, listDirDef, readFileDef, githubToolsDef]
});

// 5. BIOMETRICS AGENT (HealthAgent)
// Analiza métricas de salud y rendimiento del reloj inteligente.
export const healthAgent = new SubAgent({
    name: 'HealthAgent',
    systemPrompt: `Eres el HealthAgent de Jarvis. Tu misión es analizar las métricas biométricas de Juani extraídas de su reloj inteligente.
Debes buscar patrones de fatiga, calidad de sueño, variabilidad de frecuencia cardíaca y dar recomendaciones de salud basadas en datos.`,
    tools: [searchWebDef, readUrlDef, getHealthMetricsDef]
});

// 6. SPORTS AGENT (SportsAgent)
// Experto en fútbol táctico y Fórmula 1.
export const sportsAgent = new SubAgent({
    name: 'SportsAgent',
    systemPrompt: `Eres el SportsAgent de Jarvis. Eres un "capo" absoluto en análisis táctico de fútbol y métricas de F1.
Combinas datos históricos con análisis en tiempo real para dar opiniones fundamentadas sobre estrategias de carrera o esquemas tácticos de equipos.`,
    tools: [searchWebDef, readUrlDef, getSportsDataDef]
});

// 7. RESEARCH AGENT (Capo AI / StrategyAgent)
// El equivalente a Perplexity/Gemini Pro para investigación profunda y orquestación estratégica.
export const researchAgent = new SubAgent({
    name: 'CapoAI',
    systemPrompt: `Eres CapoAI, el brazo de investigación más avanzado de Jarvis. 
Tu nivel de razonamiento es comparable a Perplexity Pro o Gemini Ultra. 
Buscas en múltiples fuentes, sintetizas información compleja y propones estrategias de crecimiento disruptivas.`,
    tools: [searchWebDef, readUrlDef, gogToolsDef]
});

export const agentsRegistry: Record<string, SubAgent> = {
    'coder': coderAgent,
    'doc': docAgent,
    'qa': qaAgent,
    'deploy': deployAgent,
    'health': healthAgent,
    'sports': sportsAgent,
    'research': researchAgent
};
