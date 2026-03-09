import { agentLoop } from './agent/loop.js';

async function testSwarm() {
    console.log("=== INICIANDO PRUEBA DEL ENJAMBRE DE ELITE ===");
    console.log("Usuario: Jarvis, solicito al DocAgent que redacte un resumen sobre qué trata el archivo requirements.md.");

    try {
        const response = await agentLoop.run(
            "juani_test_user",
            "Por favor usa delegate_to_agent para que el agente 'doc' (DocAgent) lea el archivo 'requirements.md' que está en la misma carpeta que src, y me traiga un resumen de 3 lineas sobre su contenido."
        );
        console.log("\n=== RESPUESTA DE JARVIS ===");
        console.log(response);
    } catch (e) {
        console.error("Fallo la prueba:", e);
    }
}

testSwarm();
