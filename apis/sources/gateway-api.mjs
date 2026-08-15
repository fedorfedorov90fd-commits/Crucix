#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №22: ИНТЕГРАЦИЯ С ОТКРЫТЫМИ AI-ШЛЮЗАМИ
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'gateway');
const CONFIG_FILE = join(DATA_DIR, 'config.json');
const CACHE_FILE = join(DATA_DIR, 'cache.json');

// ============================================================
// 1. СИСТЕМНЫЙ ПРОМПТ (ДЛЯ РУССКОГО ЯЗЫКА)
// ============================================================

const SYSTEM_PROMPT = `Ты — AI-помощник проекта Crucix. Отвечай ТОЛЬКО на русском языке. Пиши кратко, ясно, по делу. Не используй английские слова без необходимости. Не используй транслит. Если вопрос касается глобальной напряжённости — дай развёрнутый ответ с анализом.`;

// ============================================================
// 2. ПРОВАЙДЕРЫ
// ============================================================

const PROVIDERS = [
    {
        id: 'ollama',
        name: 'Ollama',
        type: 'local',
        url: 'http://localhost:11434/api',
        models: ['deepseek-r1:1.5b', 'deepseek-r1:7b', 'llama3.2', 'mistral'],
        defaultModel: 'deepseek-r1:1.5b',
        status: 'online',
        requiresKey: false,
        description: 'Локальный AI-сервер'
    },
    {
        id: 'openai',
        name: 'OpenAI',
        type: 'cloud',
        url: 'https://api.openai.com/v1',
        models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-3.5-turbo',
        status: 'offline',
        requiresKey: true,
        description: 'OpenAI API (требуется ключ)'
    },
    {
        id: 'huggingface',
        name: 'HuggingFace',
        type: 'cloud',
        url: 'https://api-inference.huggingface.co/models',
        models: ['mistralai/Mistral-7B-Instruct', 'meta-llama/Llama-2-7b-chat'],
        defaultModel: 'mistralai/Mistral-7B-Instruct',
        status: 'offline',
        requiresKey: true,
        description: 'HuggingFace Inference API'
    },
    {
        id: 'groq',
        name: 'Groq',
        type: 'cloud',
        url: 'https://api.groq.com/openai/v1',
        models: ['llama3-70b-8192', 'mixtral-8x7b-32768'],
        defaultModel: 'llama3-70b-8192',
        status: 'offline',
        requiresKey: true,
        description: 'Groq Cloud (быстрый AI)'
    }
];

// ============================================================
// 3. РАБОТА С ДАННЫМИ
// ============================================================

async function ensureDir() {
    try {
        await fs.mkdir(DATA_DIR, { recursive: true });
    } catch (e) {}
}

async function loadConfig() {
    await ensureDir();
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {
            activeProvider: 'ollama',
            apiKeys: {},
            cacheEnabled: true,
            cacheTTL: 3600
        };
    }
}

async function saveConfig(config) {
    await ensureDir();
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

async function loadCache() {
    await ensureDir();
    try {
        const data = await fs.readFile(CACHE_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (e) {
        return {};
    }
}

async function saveCache(cache) {
    await ensureDir();
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
}

function getCacheKey(model, prompt) {
    return `${model}:${prompt.substring(0, 100)}`;
}

// ============================================================
// 4. AI-ЗАПРОСЫ
// ============================================================

async function queryOllama(model, prompt, options = {}) {
    const url = 'http://localhost:11434/api/generate';
    const fullPrompt = `${SYSTEM_PROMPT}\n\nВопрос: ${prompt}\n\nОтвет:`;
    
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: model || 'deepseek-r1:1.5b',
            prompt: fullPrompt,
            stream: false,
            options: {
                temperature: options.temperature || 0.5,
                num_predict: options.maxTokens || 800
            }
        })
    });
    if (!response.ok) {
        throw new Error(`Ollama ошибка: ${response.status}`);
    }
    const data = await response.json();
    return {
        text: data.response || '',
        model: model,
        provider: 'ollama',
        usage: { total_tokens: data.eval_count || 0 }
    };
}

async function queryOpenAI(model, prompt, apiKey, options = {}) {
    if (!apiKey) throw new Error('OpenAI API ключ не настроен');
    const url = 'https://api.openai.com/v1/chat/completions';
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: model || 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: prompt }
            ],
            temperature: options.temperature || 0.5,
            max_tokens: options.maxTokens || 800
        })
    });
    if (!response.ok) {
        throw new Error(`OpenAI ошибка: ${response.status}`);
    }
    const data = await response.json();
    return {
        text: data.choices?.[0]?.message?.content || '',
        model: model,
        provider: 'openai',
        usage: data.usage || { total_tokens: 0 }
    };
}

async function queryProvider(providerId, model, prompt, config, options = {}) {
    const provider = PROVIDERS.find(p => p.id === providerId);
    if (!provider) throw new Error(`Провайдер ${providerId} не найден`);

    switch (providerId) {
        case 'ollama':
            return await queryOllama(model || provider.defaultModel, prompt, options);
        case 'openai':
            return await queryOpenAI(model || provider.defaultModel, prompt, config.apiKeys?.openai, options);
        default:
            throw new Error(`Провайдер ${providerId} не поддерживается`);
    }
}

async function queryWithFallback(prompt, config, options = {}) {
    const primaryProvider = config.activeProvider || 'ollama';
    const fallbackProviders = ['ollama', 'openai'].filter(p => p !== primaryProvider);

    const errors = [];
    for (const providerId of [primaryProvider, ...fallbackProviders]) {
        try {
            const provider = PROVIDERS.find(p => p.id === providerId);
            if (!provider) continue;
            if (provider.requiresKey && !config.apiKeys?.[providerId]) continue;

            const result = await queryProvider(providerId, options.model || provider.defaultModel, prompt, config, options);
            return {
                ...result,
                providerUsed: providerId,
                fallbackUsed: providerId !== primaryProvider
            };
        } catch (e) {
            errors.push(`${providerId}: ${e.message}`);
        }
    }

    throw new Error(`Все провайдеры недоступны: ${errors.join('; ')}`);
}

// ============================================================
// 5. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleGatewayAPI(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    try {
        const config = await loadConfig();
        const cache = await loadCache();

        // --- GET /api/gateway/providers ---
        if (path === '/api/gateway/providers' && req.method === 'GET') {
            const providers = PROVIDERS.map(p => ({
                ...p,
                active: p.id === config.activeProvider
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                providers: providers,
                active: config.activeProvider,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/gateway/chat ---
        if (path === '/api/gateway/chat' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const prompt = data.prompt || '';
                    const model = data.model || null;
                    const options = data.options || {};
                    const useCache = data.useCache !== false && config.cacheEnabled;

                    if (!prompt) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: false, error: 'Введите промпт' }));
                        return;
                    }

                    let result;
                    if (useCache) {
                        const cacheKey = getCacheKey(model || 'default', prompt);
                        if (cache[cacheKey]) {
                            result = { ...cache[cacheKey], cached: true };
                        }
                    }

                    if (!result) {
                        result = await queryWithFallback(prompt, config, { model, ...options });
                        if (useCache) {
                            const cacheKey = getCacheKey(model || 'default', prompt);
                            cache[cacheKey] = { ...result, timestamp: Date.now() };
                            await saveCache(cache);
                        }
                    }

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        ...result,
                        timestamp: new Date().toISOString()
                    }));
                } catch (e) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- GET /api/gateway/status ---
        if (path === '/api/gateway/status' && req.method === 'GET') {
            const status = await Promise.all(PROVIDERS.map(async p => {
                try {
                    if (p.id === 'ollama') {
                        const resp = await fetch('http://localhost:11434/api/tags');
                        return { ...p, status: resp.ok ? 'online' : 'offline' };
                    }
                    return { ...p, status: p.requiresKey && !config.apiKeys?.[p.id] ? 'disabled' : p.status };
                } catch {
                    return { ...p, status: 'offline' };
                }
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                providers: status,
                active: config.activeProvider,
                timestamp: new Date().toISOString()
            }));
            return;
        }

        // --- POST /api/gateway/configure ---
        if (path === '/api/gateway/configure' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    if (data.activeProvider) {
                        const provider = PROVIDERS.find(p => p.id === data.activeProvider);
                        if (!provider) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Провайдер не найден' }));
                            return;
                        }
                        config.activeProvider = data.activeProvider;
                    }
                    if (data.apiKeys) {
                        config.apiKeys = { ...config.apiKeys, ...data.apiKeys };
                    }
                    if (data.cacheEnabled !== undefined) {
                        config.cacheEnabled = data.cacheEnabled;
                    }
                    await saveConfig(config);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        config: config,
                        message: 'Настройки сохранены'
                    }));
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: e.message }));
                }
            });
            return;
        }

        // --- DELETE /api/gateway/cache ---
        if (path === '/api/gateway/cache' && req.method === 'DELETE') {
            await saveCache({});
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                message: 'Кэш очищен'
            }));
            return;
        }

        // 404
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Неизвестный путь'
        }));

    } catch (error) {
        console.error('[Gateway API] Ошибка:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: false,
            error: 'Внутренняя ошибка сервера',
            details: error.message
        }));
    }
}

export default { handleGatewayAPI };
