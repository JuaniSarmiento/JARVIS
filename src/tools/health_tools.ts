// Health Metrics API Wrapper (Stub for MVP)
export const getHealthMetricsDef = {
    type: "function",
    function: {
        name: "get_health_metrics",
        description: "Obtiene las métricas biométricas recientes del usuario desde su smartwatch (simulado para MVP).",
        parameters: {
            type: "object",
            properties: {
                metricType: {
                    type: "string",
                    enum: ["heart_rate", "sleep_score", "hrv", "steps"],
                    description: "El tipo de métrica a recuperar."
                },
                period: {
                    type: "string",
                    enum: ["today", "last_week", "last_month"],
                    description: "El período de tiempo a analizar."
                }
            },
            required: ["metricType"]
        }
    }
};

export async function executeGetHealthMetrics(args: { metricType: string; period?: string }): Promise<string> {
    const { metricType, period = "today" } = args;
    console.log(`[HealthAPI] Recuperando métricas de tipo: ${metricType} para el período: ${period}`);

    // Simulating actual API calls to Garmin/Apple Health
    switch (metricType) {
        case "heart_rate":
            return `Promedio de Heart Rate (${period}): 62 BPM. Picos de 145 BPM durante ejercicio a las 18:00 hs.`;
        case "sleep_score":
            return `Sleep Score (${period}): 85/100. 7h 20m de sueño total. 1h 45m de sueño REM. Recuperación excelente.`;
        case "hrv":
            return `HRV (Heart Rate Variability) - (${period}): 48 ms. Tendencia estable, el cuerpo está en buen estado de recuperación.`;
        case "steps":
            return `Pasos (${period}): 11,240 pasos totales. Se alcanzó la meta diaria.`;
        default:
            return `Métrica no soportada: ${metricType}`;
    }
}
