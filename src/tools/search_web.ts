import { search } from 'duck-duck-scrape';

export const searchWebDef = {
    type: "function",
    function: {
        name: "search_web",
        description: "Busca en la web usando DuckDuckGo. Útil para obtener información actualizada, noticias o buscar documentación.",
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
        console.log(`[Web Search] Buscando: "${query}"`);
        const searchResults = await search(query);

        if (!searchResults.results || searchResults.results.length === 0) {
            return "No se encontraron resultados para la búsqueda.";
        }

        // Tomar los primeros 5 resultados
        const topResults = searchResults.results.slice(0, 5);
        let resultString = `Resultados de búsqueda para "${query}":\n\n`;

        topResults.forEach((res, index) => {
            resultString += `${index + 1}. **${res.title}**\n`;
            resultString += `   URL: ${res.url}\n`;
            resultString += `   Descripción: ${res.description}\n\n`;
        });

        return resultString;
    } catch (error: any) {
        console.error(`Error en search_web: ${error.message}`);
        return `Hubo un error al realizar la búsqueda: ${error.message}`;
    }
}
