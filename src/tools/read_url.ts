import * as cheerio from 'cheerio';

export const readUrlDef = {
    type: "function",
    function: {
        name: "read_url",
        description: "Lee el contenido de texto principal de una página web (URL). Útil para leer artículos, noticias o documentación de una URL específica. Usa esto inmediatamente después de search_web si necesitas detalles, o cuando el usuario provea un link.",
        parameters: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "La URL completa a leer (ej: https://en.wikipedia.org/wiki/AI)."
                }
            },
            required: ["url"],
            additionalProperties: false
        }
    }
};

export async function executeReadUrl(args: any): Promise<string> {
    const { url } = args;
    try {
        console.log(`[Read URL] Recuperando: ${url}`);
        const response = await fetch(url, {
            headers: {
                // Agregar un user-agent genérico para evitar ser bloqueado
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
            }
        });

        if (!response.ok) {
            return `No se pudo acceder a la página. Status HTTP: ${response.status} ${response.statusText}`;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remover elementos que no contribuyen al contenido de texto
        $('script, style, noscript, iframe, header, footer, nav, aside').remove();

        // Extraer texto ordenadamente
        const title = $('title').text().trim() || 'Sin Título';
        let mainText = '';

        // Buscar en article primero, o main, o en su defecto body
        const contentContainer = $('article').length ? $('article') : ($('main').length ? $('main') : $('body'));

        // Extraer encabezados y párrafos
        contentContainer.find('h1, h2, h3, p, li').each((_index, el: any) => {
            const tagName = el.tagName.toLowerCase();
            const text = $(el).text().trim().replace(/\\s+/g, ' '); // Limpiar múltiples espacios

            if (text) {
                if (tagName.startsWith('h')) {
                    mainText += `\n\n# ${text}\n`;
                } else if (tagName === 'li') {
                    mainText += `- ${text}\n`;
                } else {
                    mainText += `${text}\n\n`;
                }
            }
        });

        // Limite de seguridad aprox para tokens (unos 15,000 caracteres como máximo devueltos)
        const MAX_CHARS = 15000;
        let finalOutput = `Título de la Página: ${title}\n\n`;
        finalOutput += mainText.trim() === '' ?
            $("body").text().replace(/\\s+/g, ' ').trim() : mainText.trim();

        if (finalOutput.length > MAX_CHARS) {
            finalOutput = finalOutput.substring(0, MAX_CHARS) + "\n\n...[Contenido truncado debido a longitud]...";
        }

        return finalOutput;

    } catch (error: any) {
        console.error(`Error en read_url: ${error.message}`);
        return `Hubo un error al procesar la URL: ${error.message}`;
    }
}
