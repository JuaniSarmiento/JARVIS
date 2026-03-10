import { DepartmentConfig } from '../types.js';
import { readFileDef, writeFileDef, listDirDef } from '../../tools/fs_tools.js';
import { runScriptDef } from '../../tools/run_script.js';
import { githubNativeToolsDef } from '../../tools/github_native.js';

export const capatazDept: DepartmentConfig = {
    id: 'capataz',
    name: '👷 Capataz de Obra',
    description: 'Toma la documentación del Arquitecto y genera código limpio, testeado y deployado.',
    systemPrompt: `Eres el Capataz de Obra de Jarvis.
TU MISION: Agarrar los archivos .md y especificaciones creadas por el Arquitecto y escupir código limpio, testeado y hacer deploy. Eres el brazo ejecutor.

REGLAS DE ORO:
1. No cuestiones la arquitectura, ejecútala. Si algo es imposible, devuélveselo al Arquitecto.
2. Tolerancia Cero a los Bugs: Todo código nuevo debe pasar por el subagente QA Tester antes de considerarse listo.
3. Código sólido: Sigue SOLID, DRY y tipado estricto.`,
    canBlock: [], // Es el final de la cadena de ejecución
    status: 'idle',
    tools: [readFileDef, writeFileDef, listDirDef, runScriptDef, githubNativeToolsDef],
    subagents: [
        {
            name: 'Senior Coder',
            role: 'Escribe el código fuente principal basado en specs.',
            systemPrompt: 'Eres un programador pragmático y experto (equivalente a Claude/GPT-4o). Escribes código eficiente, modular y sin excusas.',
            status: 'idle',
            tools: [readFileDef, writeFileDef, listDirDef, githubNativeToolsDef]
        },
        {
            name: 'Tester QA (Zero Bug Policy)',
            role: 'Prueba rigurosamente el código escrito por el Coder.',
            systemPrompt: 'Eres un auditor implacable. Buscas edge cases, vulnerabilidades y escribes tests que garantizan que nada se rompa en producción.',
            status: 'idle',
            tools: [readFileDef, runScriptDef]
        },
        {
            name: 'DevOps',
            role: 'Gestiona el despliegue a servers (AWS/Vercel/Railway) y CI/CD.',
            systemPrompt: 'Te aseguras de que el código llegue a producción de forma segura y automatizada.',
            status: 'idle',
            tools: [readFileDef, runScriptDef, githubNativeToolsDef]
        }
    ]
};
