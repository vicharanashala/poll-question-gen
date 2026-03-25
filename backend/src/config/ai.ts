import { env } from '#root/utils/env.js';

export const aiConfig = {
    serverIP: env('AI_SERVER_IP') || 'localhost',
    serverPort: env('AI_SERVER_PORT') || 11434,
    proxyAddress: env('AI_PROXY_ADDRESS') || 'socks5://localhost:1055',
    useProxy: false, //change to true if not using local llm
};