import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const gogToolsDef = {
    type: 'function',
    function: {
        name: 'google_workspace_cli',
        description: 'Use gog CLI for Gmail, Calendar, Drive, Contacts, Sheets, and Docs. Setup first with "auth add".',
        parameters: {
            type: 'object',
            properties: {
                command: {
                    type: 'string',
                    description: 'The gog command to run (e.g., "gmail search newer_than:7d").'
                }
            },
            required: ['command']
        }
    }
};

export async function executeGogCommand(args: { command: string }): Promise<string> {
    try {
        const { stdout, stderr } = await execPromise(`.\\gog.exe ${args.command}`);
        return stdout || stderr || 'Command executed with no output.';
    } catch (error: any) {
        if (error.message.includes("is not recognized")) {
            return 'Error: gog is not installed on this system. Please check SKILL.md for installation instructions.';
        }
        return `Error: ${error.message}`;
    }
}
