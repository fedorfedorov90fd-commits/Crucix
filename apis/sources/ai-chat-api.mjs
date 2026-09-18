/**
 * apis/sources/ai-chat-api.mjs — SERVICE-МОДУЛЬ: AI-ЧАТ ЧЕРЕЗ OLLAMA
 *
 * КОНТРАКТ CRUCIX v2 (Service, мультиметодный).
 * ИСТОЧНИК: Ollama (http://localhost:11434) — локальный AI-сервер.
 * ЗНАНИЯ: data/ai_knowledge/knowledge.json — контекст проекта для system prompt.
 * СЕССИИ: in-memory Map с TTL 30 мин, до 100 сессий, до 50 сообщений в сессии.
 *
 * AI-чат с локальной моделью Ollama. Мультиметодный Service с поддержкой:
 *   - GET /                  — корень (список эндпоинтов + версия)
 *   - GET /status            — health-check сервиса
 *   - GET /health            — расширенный health (проверка Ollama + knowledge.json)
 *   - GET /config            — конфиг (модель по умолчанию, лимиты, TTL)
 *   - GET /models            — список моделей Ollama
 *   - GET /knowledge         — содержимое knowledge.json
 *   - GET /prompt            — текущий system prompt
 *   - GET /sessions          — список сессий
 *   - GET /sessions/:id      — конкретная сессия
 *   - GET /stats             — статистика сервиса
 *   - GET /export            — экспорт сессий в текст/JSON
 *   - POST /chat             — основной чат (message, model, sessionId)
 *   - POST /chat/stream      — SSE-стрим ответа
 *   - POST /session/new      — новая сессия
 *   - POST /session/clear    — очистка сессии
 *   - POST /session/delete   — удалить сессию
 *   - POST /knowledge/reload — перезагрузить knowledge.json
 *   - POST /reset-cache      — сброс кэша system prompt
 *   - POST /reset-stats      — сброс статистики
 *
 * ФОРМАТЫ: json, text, sse, raw.
 * ФИЛЬТРЫ: ?sessionId=, ?limit=, ?format=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const KNOWLEDGE_FILE = join(PROJECT_ROOT, 'data', 'ai_knowledge', 'knowledge.json');

export const route   = '/api/services/ai-chat';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'AI-чат через локальный Ollama: сессии, knowledge.json, стрим, мультимодельность',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНФИГ
// ============================================================

const CONFIG = {
  ollamaBase: process.env.OLLAMA_URL || 'http://localhost:11434',
  defaultModel: process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b',
  requestTimeoutMs: 60_000,
  maxMessageLength: 4000,
  maxSessions: 100,
  maxMessagesPerSession: 50,
  sessionTTL: 30 * 60 * 1000,      // 30 минут
  temperature: 0.7,
  numPredict: 500,
};

// ============================================================
//  IN-MEMORY СЕССИИ И КЭШ
// ============================================================

const sessions = new Map();    // sessionId → { id, createdAt, updatedAt, messages: [] }
let _knowledgeCache = null;    // { raw, parsed, loadedAt, prompt }
let _stats = {
  startedAt: Date.now(),
  chatRequests: 0,
  successfulChats: 0,
  failedChats: 0,
  totalLatencyMs: 0,
  modelsUsed: {},
};

function generateSessionId() {
  return 'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function createSession() {
  // Очистка старых
  if (sessions.size >= CONFIG.maxSessions) {
    const oldest = [...sessions.values()].sort((a, b) => a.updatedAt - b.updatedAt)[0];
    if (oldest) sessions.delete(oldest.id);
  }
  const id = generateSessionId();
  const session = { id, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  const s = sessions.get(id);
  if (!s) return null;
  if (Date.now() - s.updatedAt > CONFIG.sessionTTL) {
    sessions.delete(id);
    return null;
  }
  return s;
}

function appendMessage(session, role, content) {
  session.messages.push({ role, content, at: Date.now() });
  if (session.messages.length > CONFIG.maxMessagesPerSession) {
    session.messages = session.messages.slice(-CONFIG.maxMessagesPerSession);
  }
  session.updatedAt = Date.now();
}

function gcSessions() {
  const now = Date.now();
  let removed = 0;
  for (const [id, s] of sessions) {
    if (now - s.updatedAt > CONFIG.sessionTTL) { sessions.delete(id); removed++; }
  }
  return removed;
}

// ============================================================
//  KNOWLEDGE — загрузка и кэш system prompt
// ============================================================

async function loadKnowledge(force = false) {
  if (!force && _knowledgeCache && (Date.now() - _knowledgeCache.loadedAt) < 60_000) {
    return _knowledgeCache;
  }
  let parsed = null;
  let raw = null;
  try {
    raw = await fs.readFile(KNOWLEDGE_FILE, 'utf8');
    parsed = JSON.parse(raw);
  } catch (e) {
    raw = null;
    parsed = null;
  }
  const prompt = buildSystemPrompt(parsed);
  _knowledgeCache = { raw, parsed, loadedAt: Date.now(), prompt };
  return _knowledgeCache;
}

function buildSystemPrompt(knowledge) {
  let prompt = 'Ты — AI-помощник проекта Crucix. Отвечай кратко и по делу на русском языке.\n\n';
  prompt += '=== О ПРОЕКТЕ ===\n';
  prompt += 'Crucix — OSINT-платформа для сбора и анализа данных из открытых источников.\n';
  prompt += 'Версия: 2.3.0\n\n';
  if (!knowledge) {
    prompt += '=== ПРАВИЛА ===\n';
    prompt += '1. Отвечай на русском языке кратко и по делу\n';
    prompt += '2. Если не знаешь — скажи честно\n';
    return prompt;
  }
  if (knowledge.modules && typeof knowledge.modules === 'object') {
    prompt += '=== МОДУЛИ ===\n';
    for (const [key, mod] of Object.entries(knowledge.modules)) {
      const name = mod?.name || key;
      const desc = mod?.description || '';
      prompt += `- ${name}: ${desc}\n`;
    }
    prompt += '\n';
  }
  if (knowledge.how_to && typeof knowledge.how_to === 'object') {
    prompt += '=== ИНСТРУКЦИИ ===\n';
    for (const [key, value] of Object.entries(knowledge.how_to)) {
      prompt += `${key}: ${value}\n`;
    }
    prompt += '\n';
  }
  prompt += '=== ПРАВИЛА ===\n';
  prompt += '1. Отвечай на русском языке кратко и по делу\n';
  prompt += '2. Если не знаешь — скажи честно\n';
  prompt += '3. Используй знания о проекте\n';
  return prompt;
}

// ============================================================
//  OLLAMA-КЛИЕНТ
// ============================================================

async function ollamaFetch(path, options = {}, timeoutMs = CONFIG.requestTimeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(CONFIG.ollamaBase + path, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function ollamaGenerate({ model, prompt, stream = false, temperature = CONFIG.temperature, numPredict = CONFIG.numPredict }) {
  const started = Date.now();
  const body = JSON.stringify({
    model: model || CONFIG.defaultModel,
    prompt,
    stream,
    options: { temperature, num_predict: numPredict },
  });

  const res = await ollamaFetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  }, CONFIG.requestTimeoutMs);

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ollama_generate_failed: HTTP ${res.status} ${errText.slice(0, 200)}`);
  }
  const data = await res.json();
  return {
    response: data.response || '',
    model: data.model || model || CONFIG.defaultModel,
    done: !!data.done,
    durationMs: Date.now() - started,
    promptEvalCount: data.prompt_eval_count || null,
    evalCount: data.eval_count || null,
  };
}

async function ollamaListModels() {
  const res = await ollamaFetch('/api/tags', { method: 'GET' }, 5000);
  if (!res.ok) throw new Error(`ollama_list_failed: HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.models) ? data.models : [];
}

async function ollamaHealth() {
  const started = Date.now();
  try {
    const res = await ollamaFetch('/api/tags', { method: 'GET' }, 3000);
    return { ok: res.ok, status: res.status, durationMs: Date.now() - started };
  } catch (e) {
    return { ok: false, status: 0, error: e.message, durationMs: Date.now() - started };
  }
}

// ============================================================
//  ВАЛИДАЦИЯ И ПАРСИНГ BODY
// ============================================================

function readBody(req, maxBytes = 100_000) {
  return new Promise((resolve, reject) => {
    let buf = '', size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function validateMessage(message) {
  if (typeof message !== 'string') return 'message must be string';
  const t = message.trim();
  if (!t) return 'message is empty';
  if (t.length > CONFIG.maxMessageLength) return `message too long (max ${CONFIG.maxMessageLength})`;
  return null;
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJSON(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extraHeaders,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sub = urlObj.pathname.replace(/^\/api\/services\/ai-chat/, '') || '/';
  const query = Object.fromEntries(urlObj.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'ai-chat',
    'X-Service-Version': meta.version,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  // Периодическая сборка мусора
  if (Math.random() < 0.05) gcSessions();

  try {
    // ============================================================
    //  GET-ЭНДПОИНТЫ
    // ============================================================

    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/', data: {
          version: meta.version,
          endpoints: ['/', '/status', '/health', '/config', '/models', '/knowledge', '/prompt',
                      '/sessions', '/sessions/:id', '/stats', '/export', 'POST /chat',
                      'POST /chat/stream', 'POST /session/new', 'POST /session/clear',
                      'POST /session/delete', 'POST /knowledge/reload', 'POST /reset-cache',
                      'POST /reset-stats'],
          methods: methods,
        }}, extra);
      }
      if (sub === '/status') {
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/status', data: {
          status: 'online', sessions: sessions.size, ollama_base: CONFIG.ollamaBase,
          default_model: CONFIG.defaultModel,
        }}, extra);
      }
      if (sub === '/health') {
        const [ollama, knowledge] = await Promise.all([
          ollamaHealth(),
          loadKnowledge().then(k => ({ ok: !!k.raw, has_parsed: !!k.parsed, loaded_at: k.loadedAt })),
        ]);
        const ok = ollama.ok;
        return sendJSON(res, ok ? 200 : 503, { service: 'ai-chat', endpoint: '/health', data: {
          ok, ollama, knowledge, sessions: sessions.size,
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
        }}, extra);
      }
      if (sub === '/config') {
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/config', data: {
          ollama_base: CONFIG.ollamaBase,
          default_model: CONFIG.defaultModel,
          request_timeout_ms: CONFIG.requestTimeoutMs,
          max_message_length: CONFIG.maxMessageLength,
          max_sessions: CONFIG.maxSessions,
          max_messages_per_session: CONFIG.maxMessagesPerSession,
          session_ttl_ms: CONFIG.sessionTTL,
          temperature: CONFIG.temperature,
          num_predict: CONFIG.numPredict,
        }}, extra);
      }
      if (sub === '/models') {
        try {
          const models = await ollamaListModels();
          const enriched = models.map(m => ({
            name: m.name,
            model: m.model,
            size: m.size,
            size_human: typeof m.size === 'number' ? (m.size / 1024 / 1024 / 1024).toFixed(2) + ' GB' : null,
            modified_at: m.modified_at,
            family: m.details?.family || null,
            parameter_size: m.details?.parameter_size || null,
            quantization_level: m.details?.quantization_level || null,
          }));
          return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/models', data: { count: enriched.length, models: enriched }}, extra);
        } catch (e) {
          return sendJSON(res, 503, { error: 'ollama_unavailable', message: e.message }, extra);
        }
      }
      if (sub === '/knowledge') {
        const k = await loadKnowledge();
        if (!k.parsed) return sendJSON(res, 503, { error: 'knowledge_not_available', hint: 'check ' + KNOWLEDGE_FILE }, extra);
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/knowledge', data: {
          loaded_at: k.loadedAt,
          keys: Object.keys(k.parsed),
          modules_count: k.parsed.modules ? Object.keys(k.parsed.modules).length : 0,
          how_to_count: k.parsed.how_to ? Object.keys(k.parsed.how_to).length : 0,
          knowledge: k.parsed,
        }}, extra);
      }
      if (sub === '/prompt') {
        const k = await loadKnowledge();
        return sendText(res, 200, k.prompt, 'text/plain; charset=utf-8');
      }
      if (sub === '/sessions') {
        const list = [...sessions.values()].map(s => ({
          id: s.id, createdAt: s.createdAt, updatedAt: s.updatedAt, messages: s.messages.length,
        })).sort((a, b) => b.updatedAt - a.updatedAt);
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/sessions', data: { count: list.length, sessions: list }}, extra);
      }
      if (sub.startsWith('/sessions/')) {
        const id = decodeURIComponent(sub.slice('/sessions/'.length));
        const s = getSession(id);
        if (!s) return sendJSON(res, 404, { error: 'session_not_found', id }, extra);
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: sub, data: s }, extra);
      }
      if (sub === '/stats') {
        const avg = _stats.chatRequests > 0 ? Math.round(_stats.totalLatencyMs / _stats.chatRequests) : 0;
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/stats', data: {
          started_at: new Date(_stats.startedAt).toISOString(),
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
          chat_requests: _stats.chatRequests,
          successful_chats: _stats.successfulChats,
          failed_chats: _stats.failedChats,
          success_rate: _stats.chatRequests > 0 ? Number((_stats.successfulChats / _stats.chatRequests * 100).toFixed(1)) : 0,
          avg_latency_ms: avg,
          models_used: _stats.modelsUsed,
          active_sessions: sessions.size,
        }}, extra);
      }
      if (sub === '/export') {
        const format = (query.format || 'json').toLowerCase();
        const data = [...sessions.values()].map(s => ({
          id: s.id, createdAt: new Date(s.createdAt).toISOString(),
          updatedAt: new Date(s.updatedAt).toISOString(),
          messages: s.messages.map(m => ({ role: m.role, content: m.content, at: new Date(m.at).toISOString() })),
        }));
        if (format === 'text') {
          const lines = [];
          lines.push('═══════════════════════════════════════════════════════════');
          lines.push('  AI-CHAT SESSIONS EXPORT');
          lines.push(`  ${new Date().toISOString()}`);
          lines.push('═══════════════════════════════════════════════════════════');
          for (const s of data) {
            lines.push('');
            lines.push(`── ${s.id} (${s.messages.length} сообщений) ──`);
            for (const m of s.messages) lines.push(`[${m.role}] ${m.content}`);
          }
          return sendText(res, 200, lines.join('\n'), 'text/plain; charset=utf-8');
        }
        return sendJSON(res, 200, { service: 'ai-chat', endpoint: '/export', data: { count: data.length, sessions: data }}, extra);
      }
      return sendJSON(res, 404, { error: 'get_endpoint_not_found', path: sub }, extra);
    }

    // ============================================================
    //  POST-ЭНДПОИНТЫ
    // ============================================================

    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }

      // POST /chat — основной
      if (sub === '/chat' || sub === '/' || sub === '') {
        const err = validateMessage(body.message);
        if (err) return sendJSON(res, 400, { error: 'invalid_message', message: err }, extra);

        const model = body.model || CONFIG.defaultModel;
        const sessionId = body.sessionId || null;
        let session = sessionId ? getSession(sessionId) : null;
        if (sessionId && !session) return sendJSON(res, 404, { error: 'session_not_found', sessionId }, extra);
        if (!session) session = createSession();

        const k = await loadKnowledge();
        const historyBlock = session.messages.length
          ? '\n\n=== ИСТОРИЯ ДИАЛОГА ===\n' + session.messages.map(m => `${m.role}: ${m.content}`).join('\n')
          : '';
        const fullPrompt = `${k.prompt}${historyBlock}\n\nВопрос пользователя: ${body.message}\n\nОтвет AI:`;

        appendMessage(session, 'user', body.message);
        _stats.chatRequests++;
        _stats.modelsUsed[model] = (_stats.modelsUsed[model] || 0) + 1;

        try {
          const result = await ollamaGenerate({ model, prompt: fullPrompt, stream: false });
          appendMessage(session, 'assistant', result.response);
          _stats.successfulChats++;
          _stats.totalLatencyMs += result.durationMs;
          return sendJSON(res, 200, {
            success: true,
            response: result.response,
            sessionId: session.id,
            model: result.model,
            durationMs: result.durationMs,
            stats: { promptEvalCount: result.promptEvalCount, evalCount: result.evalCount },
          }, extra);
        } catch (e) {
          _stats.failedChats++;
          return sendJSON(res, 502, { error: 'ollama_error', message: e.message, sessionId: session.id }, extra);
        }
      }

      // POST /chat/stream — SSE
      if (sub === '/chat/stream') {
        const err = validateMessage(body.message);
        if (err) return sendJSON(res, 400, { error: 'invalid_message', message: err }, extra);

        const model = body.model || CONFIG.defaultModel;
        const sessionId = body.sessionId || null;
        let session = sessionId ? getSession(sessionId) : null;
        if (!session) session = createSession();

        const k = await loadKnowledge();
        const fullPrompt = `${k.prompt}\n\nВопрос пользователя: ${body.message}\n\nОтвет AI:`;

        res.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        });

        try {
          const ollamaRes = await ollamaFetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, prompt: fullPrompt, stream: true, options: { temperature: CONFIG.temperature, num_predict: CONFIG.numPredict } }),
          }, CONFIG.requestTimeoutMs);

          if (!ollamaRes.ok) {
            res.write(`data: ${JSON.stringify({ error: 'ollama_error', status: ollamaRes.status })}\n\n`);
            res.end();
            return;
          }

          let full = '';
          const reader = ollamaRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              if (!line.trim()) continue;
              try {
                const chunk = JSON.parse(line);
                if (chunk.response) { full += chunk.response; res.write(`data: ${JSON.stringify({ delta: chunk.response })}\n\n`); }
                if (chunk.done) { res.write(`data: ${JSON.stringify({ done: true })}\n\n`); }
              } catch {}
            }
          }
          appendMessage(session, 'user', body.message);
          appendMessage(session, 'assistant', full);
          res.write(`data: ${JSON.stringify({ sessionId: session.id, full })}\n\n`);
          res.end();
        } catch (e) {
          res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
          res.end();
        }
        return;
      }

      // POST /session/new
      if (sub === '/session/new') {
        const session = createSession();
        return sendJSON(res, 200, { success: true, session }, extra);
      }

      // POST /session/clear
      if (sub === '/session/clear') {
        const sessionId = body.sessionId;
        if (!sessionId) return sendJSON(res, 400, { error: 'sessionId_required' }, extra);
        const s = getSession(sessionId);
        if (!s) return sendJSON(res, 404, { error: 'session_not_found', sessionId }, extra);
        s.messages = [];
        s.updatedAt = Date.now();
        return sendJSON(res, 200, { success: true, sessionId, messages: 0 }, extra);
      }

      // POST /session/delete
      if (sub === '/session/delete') {
        const sessionId = body.sessionId;
        if (!sessionId) return sendJSON(res, 400, { error: 'sessionId_required' }, extra);
        const existed = sessions.delete(sessionId);
        return sendJSON(res, 200, { success: true, sessionId, deleted: existed }, extra);
      }

      // POST /knowledge/reload
      if (sub === '/knowledge/reload') {
        const k = await loadKnowledge(true);
        return sendJSON(res, 200, { success: true, loaded_at: k.loadedAt, has_parsed: !!k.parsed }, extra);
      }

      // POST /reset-cache
      if (sub === '/reset-cache') {
        _knowledgeCache = null;
        return sendJSON(res, 200, { success: true }, extra);
      }

      // POST /reset-stats
      if (sub === '/reset-stats') {
        _stats = { startedAt: Date.now(), chatRequests: 0, successfulChats: 0, failedChats: 0, totalLatencyMs: 0, modelsUsed: {} };
        return sendJSON(res, 200, { success: true }, extra);
      }

      return sendJSON(res, 404, { error: 'post_endpoint_not_found', path: sub }, extra);
    }

    return sendJSON(res, 405, { error: 'method_not_allowed', method: req.method }, extra);

  } catch (e) {
    return sendJSON(res, 500, { error: 'service_error', message: e.message }, extra);
  }
}
