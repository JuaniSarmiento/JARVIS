/**
 * Extrae y parsea JSON de forma robusta, incluso si el LLM lo envuelve en Markdown
 * o comete errores de escape comunes.
 */
export function parseRobustJSON(text: string): any {
    if (!text) return {};

    try {
        // Intento 1: Parseo directo (el ideal)
        return JSON.parse(text);
    } catch (e) {
        // Intento 2: Buscar bloques de código o JSON entre llaves
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                // Limpieza agresiva de caracteres de control y saltos de línea mal escapados
                const cleanStr = jsonMatch[0]
                    .replace(/\\n/g, '\\n') // Preservar saltos de línea intencionales
                    .replace(/[\u0000-\u001F]+/g, " "); // Quitar otros caracteres de control
                return JSON.parse(cleanStr);
            } catch (err2: any) {
                // Si falla, intentamos una limpieza aún más profunda (muy común en Markdown)
                try {
                    const deeperClean = jsonMatch[0]
                        .replace(/\n/g, ' ')
                        .replace(/\r/g, ' ')
                        .replace(/\\/g, '\\\\')
                        .replace(/\\\\"/g, '\\"');
                    return JSON.parse(deeperClean);
                } catch (err3: any) {
                    console.error("Error definitivo en parseo robusto:", err3.message);
                    throw new Error(`Fallback de parseo falló: ${err3.message}`);
                }
            }
        }
        throw new Error(`No se encontró un objeto JSON válido en la respuesta: ${text.substring(0, 100)}...`);
    }
}
