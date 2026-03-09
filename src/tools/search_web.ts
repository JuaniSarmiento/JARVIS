import { config } from '../config/env.js';

export const searchWebDef = {
    type: "function",
    function: {
        name: "search_web",
        description: "Busca profundidad en la web usando Tavily IA. Útil para obtener información actualizada, noticias o buscar documentación.",
        parameters: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "La consulta a buscar."
                }
            },
            required: ["query"],
            additionalProperties: false
        }
    }
};

export async function executeSearchWeb(args: any): Promise<string> {
    const { query } = args;
    try {
        console.log(`[Web Search] Realizando Búsqueda Profunda (Tavily): "${query}"`);

        if (!config.tavilyApiKey) {
            return "Error: No hay clave de API de Tavily configurada. Agrega TAVILY_API_KEY a tus variables de entorno.";
        }

        const response = await fetch("https://api.tavily.com/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                api_key: config.tavilyApiKey,
                query: query,
                search_depth: "advanced",
                include_answer: true,
                max_results: 5
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`Tavily API responded with status: ${response.status} - ${errBody}`);
        }

        const searchResults = await response.json();

        if (!searchResults.results || searchResults.results.length === 0) {
            return "No se encontraron resultados relevantes.";
        }

        let resultString = `Resultados de Búsqueda Avanzada para "${query}":\n\n`;

        if (searchResults.answer) {
            resultString += `💡 **Respuesta Sintetizada:**\n${searchResults.answer}\n\n---\n`;
        }

        searchResults.results.forEach((res: any, index: number) => {
            resultString += `${index + 1}. **${res.title}**\n`;
            resultString += `   URL: ${res.url}\n`;
            resultString += `   Descripción: ${res.content}\n\n`;
        });

        return resultString;
    } catch (error: any) {
        console.error(`Error en search_web (Tavily): ${error.message}`);
        return `Hubo un error al realizar la búsqueda: ${error.message}`;
    }
}
