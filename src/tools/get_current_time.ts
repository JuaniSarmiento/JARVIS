export const getCurrentTimeDef = {
    type: 'function',
    function: {
        name: 'get_current_time',
        description: 'Returns the current local time of the system where the agent is running.',
        parameters: {
            type: 'object',
            properties: {},
            required: []
        }
    }
};

export async function executeGetCurrentTime(args: any): Promise<string> {
    const now = new Date();
    return JSON.stringify({
        currentTime: now.toISOString(),
        localTime: now.toLocaleString()
    });
}
