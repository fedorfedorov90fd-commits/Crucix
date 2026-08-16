#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №47: ИНТЕГРАЦИЯ С ВНЕШНИМИ AI-СЕРВИСАМИ
// MODULE №47: EXTERNAL AI SERVICES INTEGRATION (AI GATEWAY)
// ============================================================
// Поддерживает: OpenAI, Anthropic, Groq, DeepSeek (облачный)
// Автоматический fallback между провайдерами
// Кэширование ответов
// Статистика использования
// Версия: 1.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CACHE_DIR = join(ROOT, 'data', 'ai-cache');
const CONFIG_FILE = join(ROOT, 'data', 'ai-cache', 'config.json');
const STATS_FILE = join(ROOT, 'data', 'ai-cache', 'stats.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ ПРОВАЙДЕРОВ
// ============================================================

const PROVIDERS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    defaultModel: 'gpt-4o',
    requiresKey: true,
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    buildBody: (model, messages, options) => ({
      model: model || 'gpt-4o',
      messages: messages,
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 800,
      stream: false
    }),
    parseResponse: (data) => ({
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || { total_tokens: 0 }
    })
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    url: 'https://api.anthropic.com/v1/messages',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    defaultModel: 'claude-3-5-sonnet-20241022',
    requiresKey: true,
    headers: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01'
    }),
    buildBody: (model, messages, options) => ({
      model: model || 'claude-3-5-sonnet-20241022',
      messages: messages,
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 800
    }),
    parseResponse: (data) => ({
      text: data.content?.[0]?.text || '',
      usage: { total_tokens: data.usage?.input_tokens + data.usage?.output_tokens || 0 }
    })
  },
  groq: {
    id: 'groq',
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    models: ['llama3-70b-8192', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    defaultModel: 'llama3-70b-8192',
    requiresKey: true,
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    buildBody: (model, messages, options) => ({
      model: model || 'llama3-70b-8192',
      messages: messages,
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 800,
      stream: false
    }),
    parseResponse: (data) => ({
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || { total_tokens: 0 }
    })
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    url: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    requiresKey: true,
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`
    }),
    buildBody: (model, messages, options) => ({
      model: model || 'deepseek-chat',
      messages: messages,
      temperature: options.temperature || 0.5,
      max_tokens: options.maxTokens || 800,
      stream: false
    }),
    parseResponse: (data) => ({
      text: data.choices?.[0]?.message?.content || '',
      usage: data.usage || { total_tokens: 0 }
    })
  }
};

// ============================================================
// 2. КЛАСС AI GATEWAY
// ============================================================

class AIGateway {
  constructor() {
    this.config = { providers: {}, activeProvider: 'openai', cacheEnabled: true };
    this.stats = { requests: 0, tokens: 0, byProvider: {} };
    this.cache = new Map();
  }

  async init() {
    await this.ensureDirs();
    await this.loadConfig();
    await this.loadStats();
    console.log('[AI Gateway] Инициализирован, провайдеров:', Object.keys(this.config.providers).length);
  }

  async ensureDirs() {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(data);
    } catch (e) {
      this.config = { providers: {}, activeProvider: 'openai', cacheEnabled: true };
      await this.saveConfig();
    }
  }

  async saveConfig() {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  async loadStats() {
    try {
      const data = await fs.readFile(STATS_FILE, 'utf-8');
      this.stats = JSON.parse(data);
    } catch (e) {
      this.stats = { requests: 0, tokens: 0, byProvider: {} };
      await this.saveStats();
    }
  }

  async saveStats() {
    await fs.writeFile(STATS_FILE, JSON.stringify(this.stats, null, 2));
  }

  getCacheKey(provider, model, messages) {
    const text = messages.map(m => m.content).join(' ');
    return crypto.createHash('md5').update(`${provider}:${model}:${text}`).digest('hex');
  }

  async getProvider(providerId) {
    const provider = PROVIDERS[providerId];
    if (!provider) throw new Error(`Провайдер ${providerId} не найден`);
    const config = this.config.providers[providerId] || {};
    if (provider.requiresKey && !config.apiKey) {
      throw new Error(`API-ключ для ${provider.name} не настроен`);
    }
    return { provider, config };
  }

  async queryProvider(providerId, messages, options = {}) {
    const { provider, config } = await this.getProvider(providerId);
    const model = options.model || provider.defaultModel;

    // Проверка кэша
    if (this.config.cacheEnabled) {
      const cacheKey = this.getCacheKey(providerId, model, messages);
      if (this.cache.has(cacheKey)) {
        const cached = this.cache.get(cacheKey);
        cached.cached = true;
        return cached;
      }
    }

    const startTime = Date.now();
    try {
      const headers = provider.headers(config.apiKey);
      const body = provider.buildBody(model, messages, options);

      const response = await fetch(provider.url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`${provider.name} ошибка ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const parsed = provider.parseResponse(data);
      const responseTime = Date.now() - startTime;

      const result = {
        text: parsed.text,
        model: model,
        provider: providerId,
        usage: parsed.usage || { total_tokens: 0 },
        responseTime: responseTime,
        cached: false
      };

      // Сохраняем в кэш
      if (this.config.cacheEnabled) {
        const cacheKey = this.getCacheKey(providerId, model, messages);
        this.cache.set(cacheKey, result);
        // Ограничиваем размер кэша
        if (this.cache.size > 1000) {
          const keys = Array.from(this.cache.keys());
          for (let i = 0; i < 100; i++) this.cache.delete(keys[i]);
        }
      }

      // Обновляем статистику
      this.stats.requests++;
      this.stats.tokens += result.usage.total_tokens || 0;
      if (!this.stats.byProvider[providerId]) this.stats.byProvider[providerId] = { requests: 0, tokens: 0 };
      this.stats.byProvider[providerId].requests++;
      this.stats.byProvider[providerId].tokens += result.usage.total_tokens || 0;
      await this.saveStats();

      return result;

    } catch (e) {
      console.error(`[AI Gateway] ${provider.name} ошибка:`, e.message);
      throw e;
    }
  }

  async queryWithFallback(messages, options = {}) {
    const providers = options.providers || [this.config.activeProvider, 'groq', 'openai', 'anthropic'];
    const errors = [];

    for (const providerId of providers) {
      try {
        const result = await this.queryProvider(providerId, messages, options);
        result.fallbackUsed = providerId !== providers[0];
        return result;
      } catch (e) {
        errors.push(`${providerId}: ${e.message}`);
      }
    }

    throw new Error(`Все провайдеры недоступны: ${errors.join('; ')}`);
  }

  getModels() {
    const result = {};
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      const config = this.config.providers[id] || {};
      result[id] = {
        name: provider.name,
        models: provider.models,
        default: provider.defaultModel,
        isConfigured: !provider.requiresKey || !!config.apiKey,
        isActive: id === this.config.activeProvider
      };
    }
    return result;
  }

  getStats() {
    return {
      requests: this.stats.requests,
      tokens: this.stats.tokens,
      byProvider: this.stats.byProvider,
      cacheSize: this.cache.size,
      activeProvider: this.config.activeProvider
    };
  }

  async configureProvider(providerId, apiKey) {
    if (!PROVIDERS[providerId]) throw new Error(`Провайдер ${providerId} не найден`);
    if (!this.config.providers[providerId]) this.config.providers[providerId] = {};
    this.config.providers[providerId].apiKey = apiKey;
    await this.saveConfig();
    return true;
  }

  async setActiveProvider(providerId) {
    if (!PROVIDERS[providerId]) throw new Error(`Провайдер ${providerId} не найден`);
    const config = this.config.providers[providerId] || {};
    if (PROVIDERS[providerId].requiresKey && !config.apiKey) {
      throw new Error(`API-ключ для ${PROVIDERS[providerId].name} не настроен`);
    }
    this.config.activeProvider = providerId;
    await this.saveConfig();
    return true;
  }

  async toggleCache(enabled) {
    this.config.cacheEnabled = enabled;
    if (!enabled) this.cache.clear();
    await this.saveConfig();
    return this.config.cacheEnabled;
  }

  async clearCache() {
    this.cache.clear();
    return true;
  }

  async healthCheck() {
    const result = {};
    for (const [id, provider] of Object.entries(PROVIDERS)) {
      const config = this.config.providers[id] || {};
      const isConfigured = !provider.requiresKey || !!config.apiKey;
      let status = 'unknown';
      if (isConfigured) {
        try {
          const resp = await this.queryProvider(id, [{ role: 'user', content: 'ping' }], { maxTokens: 1 });
          status = resp.text ? 'online' : 'error';
        } catch (e) {
          status = 'offline';
        }
      } else {
        status = 'not_configured';
      }
      result[id] = { status, name: provider.name, configured: isConfigured };
    }
    return result;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

let gateway = null;

async function getGateway() {
  if (!gateway) {
    gateway = new AIGateway();
    await gateway.init();
  }
  return gateway;
}

export async function handleAIGatewayAPI(req, res) {
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
    const gateway = await getGateway();

    // ============================================================
    // GET /api/ai-gateway/status — статус модуля (для диагностики)
    // ============================================================
    if (path === '/api/ai-gateway/status' && req.method === 'GET') {
      const stats = gateway.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'ai-gateway',
        status: 'online',
        activeProvider: stats.activeProvider,
        requests: stats.requests,
        tokens: stats.tokens,
        cacheSize: stats.cacheSize,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // ============================================================
    // GET /api/ai-gateway/models — список моделей
    // ============================================================
    if (path === '/api/ai-gateway/models' && req.method === 'GET') {
      const models = gateway.getModels();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, models }));
      return;
    }

    // ============================================================
    // POST /api/ai-gateway/chat — чат с AI
    // ============================================================
    if (path === '/api/ai-gateway/chat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          if (!data.messages || !Array.isArray(data.messages)) {
            throw new Error('Поле "messages" обязательно и должно быть массивом');
          }

          const result = await gateway.queryWithFallback(data.messages, {
            model: data.model,
            temperature: data.temperature,
            maxTokens: data.maxTokens,
            providers: data.providers
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, ...result }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // POST /api/ai-gateway/configure — настройка провайдера
    // ============================================================
    if (path === '/api/ai-gateway/configure' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          if (!data.provider) throw new Error('Поле "provider" обязательно');

          if (data.apiKey) {
            await gateway.configureProvider(data.provider, data.apiKey);
          }

          if (data.active) {
            await gateway.setActiveProvider(data.provider);
          }

          if (data.cacheEnabled !== undefined) {
            await gateway.toggleCache(data.cacheEnabled);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, config: gateway.config }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // ============================================================
    // GET /api/ai-gateway/stats — статистика
    // ============================================================
    if (path === '/api/ai-gateway/stats' && req.method === 'GET') {
      const stats = gateway.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, stats }));
      return;
    }

    // ============================================================
    // POST /api/ai-gateway/cache/clear — очистка кэша
    // ============================================================
    if (path === '/api/ai-gateway/cache/clear' && req.method === 'POST') {
      await gateway.clearCache();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Кэш очищен' }));
      return;
    }

    // ============================================================
    // GET /api/ai-gateway/health — проверка всех провайдеров
    // ============================================================
    if (path === '/api/ai-gateway/health' && req.method === 'GET') {
      const health = await gateway.healthCheck();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, health }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[AI Gateway API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка сервера', details: error.message }));
  }
}

export default { handleAIGatewayAPI, AIGateway };
