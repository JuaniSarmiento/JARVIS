import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { config } from '../config/env.js';

export interface MCPTool {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: any;
    };
}

class MCPManager {
    private clients: Map<string, Client> = new Map();
    private mcpTools: MCPTool[] = [];

    async init() {
        if (config.tavilyApiKey && config.tavilyApiKey !== 'SUTITUYE POR EL TUYO') {
            await this.addTavilyServer();
        }
        // Add more servers here (filesystem, etc.)
    }

    private async addTavilyServer() {
        try {
            const transport = new StdioClientTransport({
                command: 'node',
                args: ['./node_modules/@mcptools/mcp-tavily/dist/index.js'],
                env: { ...process.env, TAVILY_API_KEY: config.tavilyApiKey }
            });

            const client = new Client(
                { name: 'tavily-client', version: '1.0.0' },
                { capabilities: {} }
            );

            await client.connect(transport);
            this.clients.set('tavily', client);

            const { tools } = await client.listTools();
            
            for (const tool of tools) {
                this.mcpTools.push({
                    type: 'function',
                    function: {
                        name: `mcp_tavily_${tool.name}`,
                        description: tool.description || '',
                        parameters: tool.inputSchema
                    }
                });
            }
            console.log('✅ MCP Tavily server connected');
        } catch (error: any) {
            console.error('❌ Error connecting to MCP Tavily server:', error.message);
        }
    }

    getTools(): MCPTool[] {
        return this.mcpTools;
    }

    async executeTool(name: string, args: any): Promise<string> {
        if (name.startsWith('mcp_tavily_')) {
            const toolName = name.replace('mcp_tavily_', '');
            const client = this.clients.get('tavily');
            if (!client) throw new Error('MCP Tavily client not found');

            const result = await client.callTool({
                name: toolName,
                arguments: args
            });

            return JSON.stringify(result.content);
        }

        throw new Error(`MCP Tool ${name} not found`);
    }
}

export const mcpManager = new MCPManager();
