import { getCurrentTimeDef, executeGetCurrentTime } from './get_current_time.js';
import { githubToolsDef, executeGithubCommand } from './github_tools.js';
import { gogToolsDef, executeGogCommand } from './gog_tools.js';
import { formattingToolsDef, executeFormattingCommand } from './formatting_tools.js';
import { n8nPrToolsDef, executeN8nPrCommand } from './n8n_pr_tools.js';
import { searchWebDef, executeSearchWeb } from './search_web.js';
import { readUrlDef, executeReadUrl } from './read_url.js';
import { delegateToAgentDef, executeDelegateToAgent } from './delegate_to_agent.js';
import { readFileDef, executeReadFile, writeFileDef, executeWriteFile, listDirDef, executeListDir } from './fs_tools.js';
import { runScriptDef, executeRunScript } from './run_script.js';
import { installSkillDef, executeInstallSkill } from './install_skill.js';

export const allTools = [
    getCurrentTimeDef,
    githubToolsDef,
    gogToolsDef,
    formattingToolsDef,
    n8nPrToolsDef,
    searchWebDef,
    readUrlDef,
    delegateToAgentDef,
    readFileDef,
    writeFileDef,
    listDirDef,
    runScriptDef,
    installSkillDef
];

export const mainJarvisTools = [
    getCurrentTimeDef,
    delegateToAgentDef,
    searchWebDef,
    readUrlDef,
    n8nPrToolsDef,
    installSkillDef
];

export async function executeTool(name: string, args: any): Promise<string> {
    switch (name) {
        case 'get_current_time':
            return await executeGetCurrentTime(args);
        case 'github_cli':
            return await executeGithubCommand(args);
        case 'google_workspace_cli':
            return await executeGogCommand(args);
        case 'formatting_tools':
            return await executeFormattingCommand(args);
        case 'create_n8n_pr':
            return await executeN8nPrCommand(args);
        case 'search_web':
            return await executeSearchWeb(args);
        case 'read_url':
            return await executeReadUrl(args);
        case 'delegate_to_agent':
            return await executeDelegateToAgent(args);
        case 'read_file':
            return await executeReadFile(args);
        case 'write_file':
            return await executeWriteFile(args);
        case 'list_dir':
            return await executeListDir(args);
        case 'run_script':
            return await executeRunScript(args);
        case 'install_skill':
            return await executeInstallSkill(args);
        default:
            throw new Error(`Tool ${name} not found`);
    }
}
