/**
 * apis/sources/diagnostics-api.mjs — SERVICE-МОДУЛЬ: САМОДИАГНОСТИКА СИСТЕМЫ
 *
 * КОНТРАКТ CRUCIX v2 (Service, мультиметодный).
 * ИСТОЧНИК: проверка собственного HTTP-сервера (self-probe), файловой системы,
 * системных метрик ОС, внешних источников (Ollama, USGS, NewsAPI), логов.
 *
 * Самодиагностика: параллельная проверка всех модулей реестра, страниц,
 * внешних источников, целостности данных, AI-анализ логов.
 * Работает через /api/registry/layers и /api/registry/services (SSOT).
 *
 * ПАРАЛЛЕЛИЗМ:
 *   - Батчи по N модулей одновременно (default 20).
 *   - Внутренний бюджет времени 20 сек (default) — не даём роутеру 504.
 *   - Что не успело — статус SKIPPED.
 *
 * ЭНДПОИНТЫ:
 *   GET  /                    — корень (список эндпоинтов)
 *   GET  /status              — короткий online/offline
 *   GET  /health              — расширенный health (self-check)
 *   GET  /config              — конфиг (concurrency, budget, timeout)
 *   GET  /system              — метрики ОС (память, CPU, uptime, load avg)
 *   GET  /modules             — параллельная проверка всех модулей реестра
 *   GET  /pages               — проверка страниц
 *   GET  /external            — проверка внешних источников
 *   GET  /integrity           — целостность данных (basket, logs, config)
 *   GET  /logs                — список логов
 *   GET  /logs/:name          — tail лога
 *   GET  /stats               — статистика сервиса
 *   GET  /summary             — краткая сводка из последнего отчёта
 *   GET  /latest              — последний сохранённый отчёт
 *   GET  /history             — история отчётов (до 20)
 *   GET  /run                 — полная диагностика (all-in-one)
 *   POST /run                 — принудительный пересчёт
 *   POST /reset-stats         — сброс статистики
 *   POST /reset-cache         — сброс кэша
 *
 * ФИЛЬТРЫ: ?skipAI=, ?modulesOnly=, ?pagesOnly=, ?externalOnly=,
 *          ?concurrency=, ?budgetMs=, ?timeout=, ?format=, ?limit=.
 * ФОРМАТЫ: json, csv, text.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const REGISTRY_FILE = join(PROJECT_ROOT, 'server', 'registry.generated.json');
const BASKET_DIR    = join(PROJECT_ROOT, 'data', 'basket');
const LOGS_DIR      = join(PROJECT_ROOT, 'logs');
const COLLECTOR_LOGS_DIR = join(LOGS_DIR, 'collectors');
const DIAG_DIR      = join(PROJECT_ROOT, 'data', 'diagnostics');
const DIAG_LATEST   = join(DIAG_DIR, 'latest.json');
const DIAG_HISTORY  = join(DIAG_DIR, 'history.json');

export const route   = '/api/services/diagnostics';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'Самодиагностика: параллельная проверка всех модулей реестра, страниц, внешних источников, целостности, AI-анализ логов',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНФИГ
// ============================================================

const CONFIG = {
  baseUrl: `http://127.0.0.1:${process.env.PORT || 3117}`,
  concurrency: 20,             // модулей одновременно
  budgetMs: 20_000,            // внутренний бюджет (роутер 25 сек)
  probeTimeoutMs: 3_000,       // таймаут одной проверки
  batchPauseMs: 50,            // пауза между батчами
  externalTimeoutMs: 3_000,
  ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'deepseek-r1:1.5b',
  maxHistory: 20,
  cacheTTL: 60_000,
};

// ============================================================
//  СОСТОЯНИЕ
// ============================================================

let _cache = { report: null, computedAt: 0 };
let _history = [];
let _stats = {
  startedAt: Date.now(),
  runs: 0,
  modulesProbes: 0,
  pagesProbes: 0,
  externalProbes: 0,
  aiRuns: 0,
  aiErrors: 0,
  lastRunMs: null,
  lastRunAt: null,
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function parseBool(v, def = false) {
  if (v == null) return def;
  const s = String(v).toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'on';
}

function parseIntSafe(v, def) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : def;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function nowIso() { return new Date().toISOString(); }

function formatBytes(b) {
  if (!b) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return parseFloat((b / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ============================================================
//  ПАРАЛЛЕЛЬНАЯ ПРОВЕРКА (батчи + бюджет)
// ============================================================

/**
 * Параллельная проверка списка URL с батчами и бюджетом.
 * items: [{ id, url, method? }]
 */
async function probeBatch(items, opts = {}) {
  const concurrency = opts.concurrency || CONFIG.concurrency;
  const budgetMs = opts.budgetMs || CONFIG.budgetMs;
  const timeoutMs = opts.timeoutMs || CONFIG.probeTimeoutMs;
  const startedAt = Date.now();
  const results = [];

  for (let i = 0; i < items.length; i += concurrency) {
    // Проверка бюджета — если уже вышли, оставшиеся SKIPPED
    const elapsed = Date.now() - startedAt;
    if (elapsed >= budgetMs) {
      const remaining = items.slice(i);
      for (const item of remaining) {
        results.push({
          id: item.id || item.path || item.url,
          url: item.url,
          status: 'SKIPPED',
          statusCode: null,
          durationMs: null,
          error: 'budget_exceeded',
        });
      }
      break;
    }

    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(item => probeOne(item, timeoutMs, budgetMs - elapsed)));
    results.push(...batchResults);

    // Пауза между батчами
    if (i + concurrency < items.length) await sleep(CONFIG.batchPauseMs);
  }

  return results;
}

async function probeOne(item, timeoutMs, remainingBudget) {
  const started = Date.now();
  const effectiveTimeout = Math.min(timeoutMs, Math.max(500, remainingBudget));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    const res = await fetch(item.url, {
      method: item.method || 'GET',
      headers: { 'Accept': 'application/json, text/html' },
      signal: controller.signal,
    });
    const text = await res.text();
    const durationMs = Date.now() - started;
    let isJson = false;
    try { JSON.parse(text); isJson = true; } catch {}

    return {
      id: item.id || item.path,
      url: item.url,
      status: res.ok ? 'ONLINE' : 'ERROR',
      statusCode: res.status,
      durationMs,
      bytes: Buffer.byteLength(text, 'utf-8'),
      isJson,
    };
  } catch (e) {
    const durationMs = Date.now() - started;
    let status = 'OFFLINE';
    let error = e.message;
    if (e.name === 'AbortError') { status = 'TIMEOUT'; error = `timeout_${effectiveTimeout}ms`; }
    return {
      id: item.id || item.path,
      url: item.url,
      status,
      statusCode: null,
      durationMs,
      bytes: 0,
      isJson: false,
      error,
    };
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================
//  РЕЕСТР — сборка списка модулей для проверки
// ============================================================

async function loadRegistryModules() {
  let reg;
  try { reg = JSON.parse(await fs.readFile(REGISTRY_FILE, 'utf8')); }
  catch (e) {
    return { layers: [], services: [], error: e.message };
  }
  const layers = [];
  const services = [];
  for (const [route, entry] of Object.entries(reg.routes || {})) {
    if (route.endsWith('/*')) continue;
    layers.push({ id: entry.moduleId || route, path: route, url: CONFIG.baseUrl + route });
  }
  for (const [route, entry] of Object.entries(reg.services || {})) {
    if (route.endsWith('/*')) continue;
    services.push({ id: entry.moduleId || route, path: route, url: CONFIG.baseUrl + route });
  }
  return { layers, services, total: layers.length + services.length };
}

// ============================================================
//  СПРАВОЧНИК СТРАНИЦ
// ============================================================

const DEFAULT_PAGES = [
  '/', '/jarvis', '/rss-feed', '/rss-dashboard', '/ai-chat', '/geo-map',
  '/basket', '/global-index', '/historical-analysis', '/correlation',
  '/infrastructure', '/diagnostics', '/monitor', '/registry', '/scheduler',
  '/kartochki', '/grid-tool', '/profile', '/silence', '/live', '/lenses',
  '/usgs', '/local', '/trust', '/ai-gateway', '/hidden-links',
  '/market-predictor', '/early-warning', '/scenarios', '/sentiment',
  '/kiwisdr', '/safecast', '/noaa', '/ofac', '/eia', '/cisa', '/who', '/news',
];

// ============================================================
//  ВНЕШНИЕ ИСТОЧНИКИ
// ============================================================

const EXTERNAL_SOURCES = [
  { id: 'ollama', url: CONFIG.ollamaUrl + '/api/tags' },
  { id: 'usgs', url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson' },
  { id: 'coingecko', url: 'https://api.coingecko.com/api/v3/ping' },
  { id: 'worldbank', url: 'https://api.worldbank.org/v2/country/all/indicator/IS.SHP.GOOD.TU?format=json&per_page=1' },
  { id: 'github', url: 'https://api.github.com' },
];

// ============================================================
//  СИСТЕМНЫЕ МЕТРИКИ
// ============================================================

function getSystemMetrics() {
  const mem = process.memoryUsage();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    memory: {
      heapUsedMb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heapTotalMb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      rssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      externalMb: Number((mem.external / 1024 / 1024).toFixed(2)),
      systemUsedPercent: Number((((totalMem - freeMem) / totalMem) * 100).toFixed(1)),
    },
    cpu: {
      cores: os.cpus().length,
      model: os.cpus()[0]?.model || 'Unknown',
      loadAvg1m: Number(os.loadavg()[0].toFixed(2)),
      loadAvg5m: Number(os.loadavg()[1].toFixed(2)),
      loadAvg15m: Number(os.loadavg()[2].toFixed(2)),
    },
    uptime: {
      systemHours: Number((os.uptime() / 3600).toFixed(2)),
      processHours: Number((process.uptime() / 3600).toFixed(2)),
    },
    platform: `${os.platform()} ${os.release()}`,
    arch: os.arch(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    pid: process.pid,
    timestamp: nowIso(),
  };
}

// ============================================================
//  ЦЕЛОСТНОСТЬ ДАННЫХ
// ============================================================

async function checkIntegrity() {
  const results = {};

  // Basket
  try {
    const files = await fs.readdir(BASKET_DIR);
    const json = files.filter(f => f.endsWith('.json'));
    let totalSize = 0;
    for (const f of json) {
      try { const st = await fs.stat(join(BASKET_DIR, f)); totalSize += st.size; } catch {}
    }
    results.basket = { ok: true, files: json.length, total_size: totalSize, total_size_human: formatBytes(totalSize) };
  } catch (e) {
    results.basket = { ok: false, error: e.message };
  }

  // Logs collectors
  try {
    const files = await fs.readdir(COLLECTOR_LOGS_DIR);
    const logs = files.filter(f => f.endsWith('.log'));
    let totalSize = 0;
    for (const f of logs) {
      try { const st = await fs.stat(join(COLLECTOR_LOGS_DIR, f)); totalSize += st.size; } catch {}
    }
    results.collector_logs = { ok: true, files: logs.length, total_size: totalSize, total_size_human: formatBytes(totalSize) };
  } catch (e) {
    results.collector_logs = { ok: false, error: e.message };
  }

  // Registry
  try {
    const st = await fs.stat(REGISTRY_FILE);
    const content = await fs.readFile(REGISTRY_FILE, 'utf8');
    const parsed = JSON.parse(content);
    results.registry = {
      ok: true,
      size: st.size,
      size_human: formatBytes(st.size),
      layers: Object.keys(parsed.routes || {}).length,
      services: Object.keys(parsed.services || {}).length,
    };
  } catch (e) {
    results.registry = { ok: false, error: e.message };
  }

  // Diagnostics dir
  try {
    const st = await fs.stat(DIAG_LATEST).catch(() => null);
    results.diagnostics_history = st ? { ok: true, size: st.size, size_human: formatBytes(st.size) } : { ok: false, error: 'no_history' };
  } catch (e) {
    results.diagnostics_history = { ok: false, error: e.message };
  }

  return results;
}

// ============================================================
//  ЛОГИ — СПИСОК И TAIL
// ============================================================

async function listLogs() {
  const logs = [];
  for (const dir of [LOGS_DIR, COLLECTOR_LOGS_DIR]) {
    try {
      const entries = await fs.readdir(dir);
      for (const f of entries) {
        if (!f.endsWith('.log')) continue;
        try {
          const st = await fs.stat(join(dir, f));
          logs.push({
            name: f,
            dir: dir === LOGS_DIR ? 'logs' : 'logs/collectors',
            size: st.size,
            size_human: formatBytes(st.size),
            mtime: st.mtime.toISOString(),
          });
        } catch {}
      }
    } catch {}
  }
  logs.sort((a, b) => b.size - a.size);
  return logs;
}

async function tailLog(name, lines = 50) {
  if (!name || /[\\/]/.test(name)) throw new Error('invalid_log_name');
  for (const dir of [LOGS_DIR, COLLECTOR_LOGS_DIR]) {
    try {
      const content = await fs.readFile(join(dir, name), 'utf8');
      const all = content.split('\n').filter(l => l.trim());
      return { name, dir: dir === LOGS_DIR ? 'logs' : 'logs/collectors', total_lines: all.length, tail: all.slice(-lines) };
    } catch (e) { /* try next */ }
  }
  throw Object.assign(new Error('log_not_found'), { statusCode: 404 });
}

// ============================================================
//  AI-АНАЛИЗ ЛОГОВ
// ============================================================

async function analyzeLogsWithAI() {
  _stats.aiRuns++;
  try {
    const logEntries = [];
    try {
      const files = await fs.readdir(LOGS_DIR);
      const logFiles = files.filter(f => f.endsWith('.log')).slice(-3);
      for (const file of logFiles) {
        const content = await fs.readFile(join(LOGS_DIR, file), 'utf8');
        const lines = content.split('\n').filter(l => l.trim()).slice(-20);
        if (lines.length) logEntries.push(`=== ${file} ===\n${lines.join('\n')}`);
      }
    } catch {}

    if (!logEntries.length) return { status: 'NO_LOGS' };
    const logText = logEntries.join('\n\n').slice(0, 3000);
    const prompt = `Ты — AI-аналитик. Проанализируй логи Crucix.\nЛОГИ:\n${logText}\nОтветь строго JSON: {"status":"STABLE"|"WARNING"|"CRITICAL","summary":"...","issues":["..."],"recommendations":["..."]}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    const res = await fetch(`${CONFIG.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: CONFIG.ollamaModel, prompt, stream: false, options: { temperature: 0.3, num_predict: 400 } }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return { status: 'AI_UNAVAILABLE', http: res.status };
    const data = await res.json();
    const raw = data.response || '';
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch { return { status: 'PARSE_ERROR', raw: raw.slice(0, 300) }; } }
    return { status: 'NO_JSON', raw: raw.slice(0, 300) };
  } catch (e) {
    _stats.aiErrors++;
    return { status: 'ERROR', message: e.message };
  }
}

// ============================================================
//  ОБЩИЙ СТАТУС
// ============================================================

function computeOverallStatus(modules, pages, external) {
  const all = [...(modules || []), ...(pages || []), ...(external || [])];
  if (!all.length) return 'UNKNOWN';
  const online = all.filter(x => x.status === 'ONLINE').length;
  const offline = all.filter(x => x.status === 'OFFLINE' || x.status === 'TIMEOUT').length;
  const error = all.filter(x => x.status === 'ERROR').length;
  const skipped = all.filter(x => x.status === 'SKIPPED').length;
  const total = all.length;
  if (online === total) return 'ONLINE';
  if (offline > total * 0.3) return 'CRITICAL';
  if (error + offline + skipped > 0) return 'DEGRADED';
  return 'ONLINE';
}

// ============================================================
//  СОХРАНЕНИЕ ОТЧЁТА
// ============================================================

async function saveReport(report) {
  try {
    await fs.mkdir(DIAG_DIR, { recursive: true });
    await fs.writeFile(DIAG_LATEST, JSON.stringify(report, null, 2), 'utf8');
    _history.unshift({
      timestamp: report.timestamp,
      overall: report.overall_status,
      modules_online: (report.modules || []).filter(m => m.status === 'ONLINE').length,
      modules_total: (report.modules || []).length,
      duration_ms: report.duration_ms,
    });
    if (_history.length > CONFIG.maxHistory) _history = _history.slice(0, CONFIG.maxHistory);
    await fs.writeFile(DIAG_HISTORY, JSON.stringify(_history, null, 2), 'utf8');
  } catch (e) {
    console.error('[diagnostics] save error:', e.message);
  }
}

async function loadLatestReport() {
  try { return JSON.parse(await fs.readFile(DIAG_LATEST, 'utf8')); }
  catch { return null; }
}

async function loadHistory() {
  try { return JSON.parse(await fs.readFile(DIAG_HISTORY, 'utf8')); }
  catch { return _history; }
}

// ============================================================
//  ПОЛНЫЙ ПРОГОН
// ============================================================

async function runFullDiagnostics(opts = {}) {
  _stats.runs++;
  const started = Date.now();
  const report = {
    timestamp: nowIso(),
    overall_status: 'UNKNOWN',
    duration_ms: 0,
    config: {
      concurrency: opts.concurrency,
      budget_ms: opts.budgetMs,
      probe_timeout_ms: opts.timeoutMs,
    },
    modules: null,
    pages: null,
    external: null,
    system: null,
    integrity: null,
    ai_log_analysis: null,
  };

  const skipAI = opts.skipAI === true;
  const modulesOnly = opts.modulesOnly === true;
  const pagesOnly = opts.pagesOnly === true;
  const externalOnly = opts.externalOnly === true;

  // MODULES
  if (!pagesOnly && !externalOnly) {
    const registry = await loadRegistryModules();
    const items = [...registry.layers, ...registry.services];
    report.modules = await probeBatch(items, {
      concurrency: opts.concurrency,
      budgetMs: opts.budgetMs,
      timeoutMs: opts.timeoutMs,
    });
    _stats.modulesProbes += report.modules.length;
  }

  // PAGES
  if (!modulesOnly && !externalOnly) {
    const items = DEFAULT_PAGES.map(p => ({ id: p, path: p, url: CONFIG.baseUrl + p }));
    report.pages = await probeBatch(items, {
      concurrency: opts.concurrency,
      budgetMs: opts.budgetMs,
      timeoutMs: opts.timeoutMs,
    });
    _stats.pagesProbes += report.pages.length;
  }

  // EXTERNAL
  if (!modulesOnly && !pagesOnly) {
    const items = EXTERNAL_SOURCES.map(s => ({ id: s.id, url: s.url }));
    report.external = await probeBatch(items, {
      concurrency: 5,
      budgetMs: opts.budgetMs,
      timeoutMs: CONFIG.externalTimeoutMs,
    });
    _stats.externalProbes += report.external.length;
  }

  // SYSTEM
  if (!modulesOnly && !pagesOnly && !externalOnly) {
    report.system = getSystemMetrics();
    report.integrity = await checkIntegrity();
    if (!skipAI) report.ai_log_analysis = await analyzeLogsWithAI();
    else report.ai_log_analysis = { status: 'SKIPPED_BY_FLAG' };
  }

  report.overall_status = computeOverallStatus(report.modules, report.pages, report.external);
  report.duration_ms = Date.now() - started;
  _stats.lastRunMs = report.duration_ms;
  _stats.lastRunAt = report.timestamp;

  await saveReport(report);
  return report;
}

// ============================================================
//  ФОРМАТЫ ОТВЕТА
// ============================================================

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

function toCSV(items) {
  const lines = ['id,url,status,statusCode,durationMs,bytes'];
  const esc = v => v == null ? '' : (String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  for (const i of items) {
    lines.push([i.id, i.url, i.status, i.statusCode, i.durationMs, i.bytes].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const sub = urlObj.pathname.replace(/^\/api\/services\/diagnostics/, '') || '/';
  const query = Object.fromEntries(urlObj.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

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
    'X-Service': 'diagnostics',
    'X-Service-Version': meta.version,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  };

  try {
    // ============ GET ============
    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/', data: {
          version: meta.version,
          endpoints: ['/', '/status', '/health', '/config', '/system', '/modules', '/pages',
                      '/external', '/integrity', '/logs', '/logs/:name', '/stats', '/summary',
                      '/latest', '/history', '/run', 'POST /run', 'POST /reset-stats', 'POST /reset-cache'],
          methods,
        }}, extra);
      }
      if (sub === '/status') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/status', data: {
          status: 'online',
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
          last_run_at: _stats.lastRunAt,
          last_run_ms: _stats.lastRunMs,
        }}, extra);
      }
      if (sub === '/health') {
        const me = await probeOne({ id: 'self', url: CONFIG.baseUrl + route + '/status' }, 2000, 2000);
        return sendJSON(res, me.status === 'ONLINE' ? 200 : 503, { service: 'diagnostics', endpoint: '/health', data: {
          self_probe: me,
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
        }}, extra);
      }
      if (sub === '/config') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/config', data: {
          base_url: CONFIG.baseUrl,
          concurrency: CONFIG.concurrency,
          budget_ms: CONFIG.budgetMs,
          probe_timeout_ms: CONFIG.probeTimeoutMs,
          external_timeout_ms: CONFIG.externalTimeoutMs,
          ollama_url: CONFIG.ollamaUrl,
          ollama_model: CONFIG.ollamaModel,
        }}, extra);
      }
      if (sub === '/system') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/system', data: getSystemMetrics() }, extra);
      }
      if (sub === '/modules') {
        const registry = await loadRegistryModules();
        if (registry.error) return sendJSON(res, 503, { error: 'registry_unavailable', message: registry.error }, extra);
        const items = [...registry.layers, ...registry.services];
        const results = await probeBatch(items, {
          concurrency: parseIntSafe(query.concurrency, CONFIG.concurrency),
          budgetMs: parseIntSafe(query.budgetMs, CONFIG.budgetMs),
          timeoutMs: parseIntSafe(query.timeout, CONFIG.probeTimeoutMs),
        });
        if (format === 'csv') return sendText(res, 200, toCSV(results), 'text/csv; charset=utf-8');
        const ok = results.filter(r => r.status === 'ONLINE').length;
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/modules', data: {
          total: results.length, online: ok, offline: results.filter(r => r.status === 'OFFLINE').length,
          error: results.filter(r => r.status === 'ERROR').length, timeout: results.filter(r => r.status === 'TIMEOUT').length,
          skipped: results.filter(r => r.status === 'SKIPPED').length,
          results,
        }}, extra);
      }
      if (sub === '/pages') {
        const items = DEFAULT_PAGES.map(p => ({ id: p, path: p, url: CONFIG.baseUrl + p }));
        const results = await probeBatch(items, {
          concurrency: parseIntSafe(query.concurrency, CONFIG.concurrency),
          budgetMs: parseIntSafe(query.budgetMs, CONFIG.budgetMs),
          timeoutMs: parseIntSafe(query.timeout, CONFIG.probeTimeoutMs),
        });
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/pages', data: { total: results.length, results }}, extra);
      }
      if (sub === '/external') {
        const items = EXTERNAL_SOURCES.map(s => ({ id: s.id, url: s.url }));
        const results = await probeBatch(items, {
          concurrency: 5, budgetMs: parseIntSafe(query.budgetMs, CONFIG.budgetMs), timeoutMs: CONFIG.externalTimeoutMs,
        });
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/external', data: { total: results.length, results }}, extra);
      }
      if (sub === '/integrity') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/integrity', data: await checkIntegrity() }, extra);
      }
      if (sub === '/logs') {
        const logs = await listLogs();
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/logs', data: { count: logs.length, logs }}, extra);
      }
      if (sub.startsWith('/logs/')) {
        const name = decodeURIComponent(sub.slice('/logs/'.length));
        const lines = parseIntSafe(query.lines, 50);
        const result = await tailLog(name, lines);
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: sub, data: result }, extra);
      }
      if (sub === '/stats') {
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/stats', data: {
          started_at: new Date(_stats.startedAt).toISOString(),
          uptime_s: Math.floor((Date.now() - _stats.startedAt) / 1000),
          runs: _stats.runs,
          modules_probes: _stats.modulesProbes,
          pages_probes: _stats.pagesProbes,
          external_probes: _stats.externalProbes,
          ai_runs: _stats.aiRuns,
          ai_errors: _stats.aiErrors,
          last_run_at: _stats.lastRunAt,
          last_run_ms: _stats.lastRunMs,
        }}, extra);
      }
      if (sub === '/summary') {
        const report = _cache.report || await loadLatestReport();
        if (!report) return sendJSON(res, 404, { error: 'no_report' }, extra);
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/summary', data: {
          overall_status: report.overall_status,
          timestamp: report.timestamp,
          duration_ms: report.duration_ms,
          modules_total: (report.modules || []).length,
          modules_online: (report.modules || []).filter(m => m.status === 'ONLINE').length,
          pages_total: (report.pages || []).length,
          pages_online: (report.pages || []).filter(p => p.status === 'ONLINE').length,
          external_total: (report.external || []).length,
          external_online: (report.external || []).filter(e => e.status === 'ONLINE').length,
          ai_status: report.ai_log_analysis?.status || null,
        }}, extra);
      }
      if (sub === '/latest') {
        const report = await loadLatestReport();
        if (!report) return sendJSON(res, 404, { error: 'no_report' }, extra);
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/latest', data: report }, extra);
      }
      if (sub === '/history') {
        const hist = await loadHistory();
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/history', data: { count: hist.length, history: hist }}, extra);
      }
      if (sub === '/run') {
        const report = await runFullDiagnostics({
          concurrency: parseIntSafe(query.concurrency, CONFIG.concurrency),
          budgetMs: parseIntSafe(query.budgetMs, CONFIG.budgetMs),
          timeoutMs: parseIntSafe(query.timeout, CONFIG.probeTimeoutMs),
          skipAI: parseBool(query.skipAI, false),
          modulesOnly: parseBool(query.modulesOnly, false),
          pagesOnly: parseBool(query.pagesOnly, false),
          externalOnly: parseBool(query.externalOnly, false),
        });
        if (format === 'text') return sendText(res, 200, reportToText(report));
        return sendJSON(res, 200, { service: 'diagnostics', endpoint: '/run', data: report }, extra);
      }
      return sendJSON(res, 404, { error: 'get_endpoint_not_found', path: sub }, extra);
    }

    // ============ POST ============
    if (req.method === 'POST') {
      if (sub === '/run') {
        const report = await runFullDiagnostics({
          concurrency: parseIntSafe(query.concurrency, CONFIG.concurrency),
          budgetMs: parseIntSafe(query.budgetMs, CONFIG.budgetMs),
          timeoutMs: parseIntSafe(query.timeout, CONFIG.probeTimeoutMs),
          skipAI: parseBool(query.skipAI, false),
          modulesOnly: parseBool(query.modulesOnly, false),
          pagesOnly: parseBool(query.pagesOnly, false),
          externalOnly: parseBool(query.externalOnly, false),
        });
        return sendJSON(res, 200, { success: true, data: report }, extra);
      }
      if (sub === '/reset-stats') {
        _stats = { startedAt: Date.now(), runs: 0, modulesProbes: 0, pagesProbes: 0, externalProbes: 0, aiRuns: 0, aiErrors: 0, lastRunMs: null, lastRunAt: null };
        return sendJSON(res, 200, { success: true }, extra);
      }
      if (sub === '/reset-cache') {
        _cache = { report: null, computedAt: 0 };
        return sendJSON(res, 200, { success: true }, extra);
      }
      return sendJSON(res, 404, { error: 'post_endpoint_not_found', path: sub }, extra);
    }

    return sendJSON(res, 405, { error: 'method_not_allowed', method: req.method }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    return sendJSON(res, status, { error: 'service_error', message: e.message }, extra);
  }
}

// ============================================================
//  ТЕКСТОВЫЙ ОТЧЁТ
// ============================================================

function reportToText(report) {
  const lines = [];
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  CRUCIX DIAGNOSTICS REPORT');
  lines.push(`  ${report.timestamp}`);
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Overall: ${report.overall_status}`);
  lines.push(`Duration: ${report.duration_ms} мс`);
  lines.push('');
  if (report.modules) {
    const m = report.modules;
    lines.push(`MODULES (${m.length}):`);
    lines.push(`  ONLINE:  ${m.filter(x => x.status === 'ONLINE').length}`);
    lines.push(`  ERROR:   ${m.filter(x => x.status === 'ERROR').length}`);
    lines.push(`  OFFLINE: ${m.filter(x => x.status === 'OFFLINE').length}`);
    lines.push(`  TIMEOUT: ${m.filter(x => x.status === 'TIMEOUT').length}`);
    lines.push(`  SKIPPED: ${m.filter(x => x.status === 'SKIPPED').length}`);
    lines.push('');
    const failed = m.filter(x => x.status !== 'ONLINE' && x.status !== 'SKIPPED');
    if (failed.length) {
      lines.push('Ошибки:');
      for (const f of failed.slice(0, 15)) {
        lines.push(`  [${f.status}] ${f.id} (${f.url}) — ${f.error || f.statusCode}`);
      }
      if (failed.length > 15) lines.push(`  ... и ещё ${failed.length - 15}`);
      lines.push('');
    }
  }
  if (report.system) {
    lines.push(`SYSTEM: ${report.system.platform} ${report.system.arch}, node ${report.system.nodeVersion}`);
    lines.push(`  Memory heap used: ${report.system.memory.heapUsedMb} MB / rss ${report.system.memory.rssMb} MB`);
    lines.push(`  CPU load avg: ${report.system.cpu.loadAvg1m} / ${report.system.cpu.loadAvg5m} / ${report.system.cpu.loadAvg15m}`);
    lines.push('');
  }
  if (report.integrity) {
    lines.push('INTEGRITY:');
    for (const [k, v] of Object.entries(report.integrity)) {
      lines.push(`  ${k}: ${v.ok ? 'OK' : 'FAIL'} ${v.error ? '— ' + v.error : (v.files ? `(${v.files} файлов, ${v.size_human || v.total_size_human || ''})` : '')}`);
    }
    lines.push('');
  }
  if (report.ai_log_analysis) {
    lines.push(`AI LOG ANALYSIS: ${report.ai_log_analysis.status}`);
    if (report.ai_log_analysis.summary) lines.push(`  ${report.ai_log_analysis.summary}`);
  }
  lines.push('═══════════════════════════════════════════════════════════');
  return lines.join('\n');
}
