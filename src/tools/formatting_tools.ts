import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

export const formattingToolsDef = {
    type: 'function',
    function: {
        name: 'formatting_tools',
        description: 'Use for linting or formatting your code. Defaults to prettier or linting tools on current directory.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['prettier', 'lint', 'build'],
                    description: 'The formatting/linting action to run.'
                }
            },
            required: ['action']
        }
    }
};

export async function executeFormattingCommand(args: { action: string }): Promise<string> {
    const binary = args.action === 'build' ? 'npm run build' : `npx ${args.action}`;
    try {
        const { stdout, stderr } = await execPromise(binary);
        return stdout || stderr || 'Command executed successfully.';
    } catch (error: any) {
        return `Error: ${error.message}`;
    }
}
