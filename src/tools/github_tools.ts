import { exec } from 'child_process';
import { promisify } from 'util';

import { config } from '../config/env.js';

const execPromise = promisify(exec);

export const githubToolsDef = {
    type: 'function',
    function: {
        name: 'github_cli',
        description: 'Interact with GitHub using the gh CLI. Example: "pr list", "issue view <number>".',
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The gh command to run (e.g., "pr list --repo owner/repo").'
                }
            },
            required: ['command']
        }
    }
};

export async function executeGithubCommand(args: { command: string }): Promise<string> {
    const envVars = config.ghToken ? `GH_TOKEN=${config.ghToken} ` : '';
    try {
        const { stdout, stderr } = await execPromise(`${envVars}gh ${args.command}`);
        return stdout || stderr || 'Command executed with no output.';
    } catch (error: any) {
        return `Error: ${error.message}`;
    }
}
