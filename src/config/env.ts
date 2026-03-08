import dotenv from 'dotenv';
dotenv.config();

export const config = {
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
    telegramAllowedUserIds: (process.env.TELEGRAM_ALLOWED_USER_IDS || '').split(',').map(id => id.trim()),
    groqApiKey: process.env.GROQ_API_KEY || '',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterModel: process.env.OPENROUTER_MODEL || 'openrouter/free',
    dbPath: process.env.DB_PATH || './memory.db',
    googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS || './service-account.json',
    tavilyApiKey: process.env.TAVILY_API_KEY || '',
};

// Validate critical env variables
if (!config.telegramBotToken || config.telegramBotToken === 'SUTITUYE POR EL TUYO') {
    console.warn('⚠️ Please set TELEGRAM_BOT_TOKEN in .env');
}
if (!config.groqApiKey || config.groqApiKey === 'SUTITUYE POR EL TUYO') {
    console.warn('⚠️ Please set GROQ_API_KEY in .env');
}
