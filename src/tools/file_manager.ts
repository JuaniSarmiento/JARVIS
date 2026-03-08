import { readFileSync, writeFileSync, readdirSync, lstatSync } from 'fs';
import { join } from 'path';

export const fileManagerDef = {
    type: 'function',
    function: {
        name: 'file_manager',
        description: 'Read, write, or list files in the project to allow self-improvement.',
        parameters: {
            type: 'object',
            properties: {
                action: {
                    type: 'string',
                    enum: ['read', 'write', 'list'],
                    description: 'The action to perform.'
                },
                path: {
                    type: 'string',
                    description: 'The relative path to the file or directory.'
                },
                content: {
                    type: 'string',
                    description: 'The content to write (only for write action).'
                }
            },
            required: ['action', 'path']
        }
    }
};

export async function executeFileManager(args: { action: string, path: string, content?: string }): Promise<string> {
    const fullPath = join(process.cwd(), args.path);
    
    // Basic security check: don't allow going outside project root
    if (!fullPath.startsWith(process.cwd())) {
        return 'Error: Access denied. Cannot access files outside project directory.';
    }

    try {
        switch (args.action) {
            case 'list':
                const files = readdirSync(fullPath);
                const details = files.map(f => {
                    const isDir = lstatSync(join(fullPath, f)).isDirectory();
                    return `${isDir ? '[DIR]' : '[FILE]'} ${f}`;
                });
                return details.join('\n') || 'Directory is empty.';

            case 'read':
                return readFileSync(fullPath, 'utf8');

            case 'write':
                if (args.content === undefined) return 'Error: Content is required for write action.';
                writeFileSync(fullPath, args.content, 'utf8');
                return `Successfully wrote to ${args.path}`;

            default:
                return 'Error: Invalid action.';
        }
    } catch (error: any) {
        return `Error: ${error.message}`;
    }
}
