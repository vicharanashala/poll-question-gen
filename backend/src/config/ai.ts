import { env } from '#root/utils/env.js';

export type AIProvider = 'openrouter' | 'ollama';

const configuredProvider = (env('AI_PROVIDER') || 'openrouter').toLowerCase();
const provider: AIProvider = configuredProvider === 'ollama' ? 'ollama' : 'openrouter';
const configuredPort = Number.parseInt(env('AI_SERVER_PORT') || '11434', 10);

export const aiConfig = {
    provider,
    mvpDummyModelToken: env('AI_MVP_DUMMY_MODEL') || 'mvp-random-dummy-model',
    openRouterBaseUrl: env('OPENROUTER_BASE_URL') || 'https://openrouter.ai/api/v1/chat/completions',
    openRouterApiKey: env('OPENROUTER_API_KEY') || '',
    openRouterModel: env('OPENROUTER_MODEL') || 'nvidia/nemotron-3-super-120b-a12b:free',
    openRouterReferer: env('OPENROUTER_REFERER') || env('APP_URL') || 'http://localhost:8080',
    openRouterAppName: env('OPENROUTER_APP_NAME') || 'poll-question-gen',
    ollamaDefaultModel: env('OLLAMA_MODEL') || 'gemma3',
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: Number.isFinite(configuredPort) ? configuredPort : 11434,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5://localhost:1055',
    useProxy: (env('AI_USE_PROXY') || 'true').toLowerCase() === 'true',
};