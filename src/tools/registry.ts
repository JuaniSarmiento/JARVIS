import { getCurrentTimeDef, executeGetCurrentTime } from './get_current_time.js';
import { githubToolsDef, executeGithubCommand } from './github_tools.js';
import { gogToolsDef, executeGogCommand } from './gog_tools.js';
import { formattingToolsDef, executeFormattingCommand } from './formatting_tools.js';
import { n8nPrToolsDef, executeN8nPrCommand } from './n8n_pr_tools.js';
import { fileManagerDef, executeFileManager } from './file_manager.js';


export const tools = [
    getCurrentTimeDef,
    githubToolsDef,
    gogToolsDef,
    formattingToolsDef,
    n8nPrToolsDef,
    fileManagerDef
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
        case 'file_manager':
            return await executeFileManager(args);

        default:
            throw new Error(`Tool ${name} not found`);
    }
}
