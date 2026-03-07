import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const n8nPrToolsDef = {
    type: 'function',
    function: {
        name: 'create_n8n_pr',
        description: 'Create a PR on GitHub with proper n8n title format. Format: <type>(<scope>): <summary>.',
        parameters: {
            type: 'object',
            properties: {
                type: {
                    type: 'string',
                    enum: ['feat', 'fix', 'perf', 'test', 'docs', 'refactor', 'build', 'ci', 'chore'],
                    description: 'PR type.'
                },
                scope: {
                    type: 'string',
                    description: 'PR scope (e.g., API, Slack Node).'
                },
                summary: {
                    type: 'string',
                    description: 'What the PR does (imperative, camel case).'
                },
                body: {
                    type: 'string',
                    description: 'PR description following the template.'
                },
                repo: {
                    type: 'string',
                    description: 'Target repository, e.g. "owner/repo".'
                }
            },
            required: ['type', 'summary', 'body', 'repo']
        }
    }
};

export async function executeN8nPrCommand(args: any): Promise<string> {
    const scopePart = args.scope ? `(${args.scope})` : '';
    const title = `${args.type}${scopePart}: ${args.summary}`;
    const command = `gh pr create --title "${title}" --body "${args.body.replace(/"/g, '\\"')}" --repo ${args.repo}`;
    try {
        const { stdout, stderr } = await execPromise(command);
        return stdout || stderr || 'PR creation command was successful.';
    } catch (error: any) {
        return `Error creating PR: ${error.message}`;
    }
}
