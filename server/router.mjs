/**
 * server/router.mjs — РОУТЕР API CRUCIX v2.3.0
 *
 * КОНТРАКТНЫЙ РОУТЕР. Одна форма handler. Никаких fallback.
 *
 * ВОЗМОЖНОСТИ:
 *   1. Загрузка registry.generated.json с валидацией схемы.
 *   2. Авто-перезагрузка реестра при изменении файла (fs.watch с debounce).
 *   3. Маршрутизация: точное совпадение, wildcard (*), параметры (:name).
 *   4. Приоритет по специфичности маршрута.
 *   5. Middleware-цепочка: CORS, gzip, ETag, Cache-Control, X-Request-Id.
 *   6. Кэш ответов (по route+method+query с TTL из meta.cache).
 *   7. Retry и circuit breaker для упавших модулей.
 *   8. Структурированный лог (JSON lines).
 *   9. Метрики per-route: вызовы, среднее время, ошибки, последний вызов.
 *  10. Служебные эндпоинты РЕЕСТРА (см. BUILTIN_ENDPOINTS ниже):
 *        /api/registry/layers            — только Layer
 *        /api/registry/services          — только Service
 *        /api/registry/summary           — { layers, services, total }
 *        /api/registry/modules           — ?kind=layer|service (фильтр)
 *        /api/registry/module/:id        — конкретный модуль по moduleId
 *        /api/registry/health            — health-check
 *        /api/registry/stats             — детальная статистика
 *  11. JSONP (?callback=) и CSV (?format=csv) для массивов.
 *  12. Graceful shutdown: дождаться активных запросов по SIGTERM/SIGINT.
 *  13. МУЛЬТИМЕТОДНАЯ ПОДДЕРЖКА: entry.method (строка) ИЛИ entry.methods (массив).
 *  14. РАЗДЕЛЕНИЕ LAYER / SERVICE: в реестре две секции, отдаются раздельно.
 *
 * КОНТРАКТ МОДУЛЯ:
 *   export const route   = '/api/layers/{name}';
 *   export const method  = 'GET';                 // single-method (Layer)
 *   // ИЛИ
 *   export const methods = ['GET', 'POST'];        // multi-method (Service)
 *   export const meta    = { ... };
 *   export async function handler(req, res) {}
 */

import { promises as fs, watch } from 'fs';
import { createGzip } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');
const REGISTRY_FILE = join(__dirname, 'registry.generated.json');
const LOG_FILE = join(PROJECT_ROOT, 'logs', 'api-requests.log');
const ERR_FILE = join(PROJECT_ROOT, 'logs', 'api-errors.log');

// ============================================================
//  КОНФИГ
// ============================================================

const CONFIG = {
  cors: {
    allowOrigin: '*',
    allowMethods: 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    allowHeaders: 'Content-Type, Authorization, X-Request-Id',
    maxAge: 86400,
  },
  gzip: {
    enabled: true,
    minBytes: 512,
  },
  cache: {
    defaultTTL: 60,
    maxEntries: 500,
  },
  rateLimit: {
    enabled: true,
    windowMs: 60_000,
    maxPerWindow: 600,
  },
  circuitBreaker: {
    enabled: true,
    failThreshold: 5,
    openMs: 30_000,
  },
  timeout: {
    handlerMs: 25_000,
  },
  dev: process.env.NODE_ENV !== 'production',
};

// ============================================================
//  СОСТОЯНИЕ
// ============================================================

const state = {
  registry: null,
  registryLoadedAt: null,
  registryReloadCount: 0,
  moduleCache: new Map(),
  responseCache: new Map(),
  metrics: new Map(),
  rateBuckets: new Map(),
  circuit: new Map(),
  activeRequests: new Set(),
  shuttingDown: false,
};

// ============================================================
//  ЛОГИ
// ============================================================

async function ensureLogsDir() {
  try { await fs.mkdir(join(PROJECT_ROOT, 'logs'), { recursive: true }); } catch {}
}

function logLine(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(LOG_FILE, line).catch(() => {});
  if (CONFIG.dev) {
    const level = entry.status >= 500 ? 'ERR' : entry.status >= 400 ? 'WRN' : 'INF';
    console.log(`[${level}] ${entry.method} ${entry.path} -> ${entry.status} ${entry.durationMs}ms  ${entry.moduleId || '-'}`);
  }
}

function logError(entry) {
  const line = JSON.stringify(entry) + '\n';
  fs.appendFile(ERR_FILE, line).catch(() => {});
  console.error(`[ROUTER ERR] ${entry.path}: ${entry.err}`);
}

// ============================================================
//  МЕТОДЫ — универсальное определение разрешённых методов
// ============================================================

/**
 * Возвращает массив разрешённых HTTP-методов для entry.
 * Приоритет:
 *   1. entry.methods (массив) — если объявлен.
 *   2. entry.method (строка) — single-method.
 *   3. null — метод не объявлен, разрешены все.
 */
function getAllowedMethods(entry) {
  if (Array.isArray(entry.methods) && entry.methods.length > 0) {
    return entry.methods.map(m => String(m).toUpperCase());
  }
  if (typeof entry.method === 'string' && entry.method.length > 0) {
    return [entry.method.toUpperCase()];
  }
  return null;
}

// ============================================================
//  РЕЕСТР — загрузка и валидация
// ============================================================

function validateRegistry(reg) {
  const errors = [];
  if (!reg || typeof reg !== 'object') errors.push('registry is not an object');
  if (!reg.meta || typeof reg.meta !== 'object') errors.push('registry.meta missing');
  if (!reg.routes || typeof reg.routes !== 'object') errors.push('registry.routes missing');
  if (!reg.services || typeof reg.services !== 'object') errors.push('registry.services missing');

  const checkSection = (section, label) => {
    if (!section) return;
    for (const [route, entry] of Object.entries(section)) {
      if (!route.startsWith('/api/')) errors.push(`${label} route ${route} does not start with /api/`);
      if (!entry.moduleId) errors.push(`${label} route ${route}: no moduleId`);
      if (!entry.file)     errors.push(`${label} route ${route}: no file`);
      if (entry.methods !== undefined && !Array.isArray(entry.methods)) {
        errors.push(`${label} route ${route}: methods must be array`);
      }
    }
  };

  checkSection(reg.routes, 'layer');
  checkSection(reg.services, 'service');
  return errors;
}

async function loadRegistry() {
  const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
  const reg = JSON.parse(raw);
  const errors = validateRegistry(reg);
  if (errors.length > 0) {
    throw new Error('registry validation failed:\n  ' + errors.join('\n  '));
  }

  // СЛИЯНИЕ СЕКЦИЙ: Layer (routes) + Service (services) → плоский индекс маршрутизации.
  // Оригиналы сохраняются в _sections для служебных эндпоинтов реестра.
  const layerRoutes = reg.routes || {};
  const serviceRoutes = reg.services || {};
  const merged = { ...layerRoutes, ...serviceRoutes };

  state.registry = {
    ...reg,
    routes: merged,
    _sections: {
      layer: layerRoutes,
      service: serviceRoutes,
    },
  };
  state.registryLoadedAt = new Date().toISOString();
  state.registryReloadCount++;
  state.moduleCache.clear();
  state.responseCache.clear();

  const layerCount = Object.keys(layerRoutes).length;
  const serviceCount = Object.keys(serviceRoutes).length;
  console.log(`[router] реестр загружен: ${layerCount} layer + ${serviceCount} service = ${Object.keys(merged).length} маршрутов (перезагрузка #${state.registryReloadCount})`);
}

let reloadTimer = null;
function scheduleReload() {
  if (reloadTimer) clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    loadRegistry().catch(e => console.error('[router] ошибка перезагрузки реестра:', e.message));
  }, 500);
}

async function watchRegistry() {
  try {
    watch(REGISTRY_FILE, { persistent: false }, (event) => {
      if (event === 'change' || event === 'rename') scheduleReload();
    });
  } catch (e) {
    console.warn('[router] не удалось следить за реестром:', e.message);
  }
}

// ============================================================
//  ЗАГРУЗКА МОДУЛЯ
// ============================================================

async function loadModule(moduleId, file) {
  if (state.moduleCache.has(moduleId)) return state.moduleCache.get(moduleId);

  const modulePath = join(PROJECT_ROOT, 'apis', 'sources', file);
  let mod;
  try {
    mod = await import(`file://${modulePath}?t=${Date.now()}`);
  } catch (e) {
    throw new Error(`module load failed: ${moduleId}: ${e.message}`);
  }

  if (typeof mod.handler !== 'function') {
    throw new Error(`module ${moduleId} does not export a function 'handler'`);
  }

  const entry = {
    handler: mod.handler,
    route: mod.route,
    method: mod.method,
    methods: mod.methods,
    meta: mod.meta || {},
    file,
    moduleId,
  };
  state.moduleCache.set(moduleId, entry);
  return entry;
}

// ============================================================
//  МАРШРУТИЗАЦИЯ
// ============================================================

function matchRoute(route, pathname) {
  if (route === pathname) return { matched: true, params: {}, specificity: 100 };

  const rParts = route.split('/');
  const pParts = pathname.split('/');
  if (rParts.length !== pParts.length) {
    if (route.endsWith('*')) {
      const prefix = route.slice(0, -1);
      const prefixNoSlash = prefix.slice(0, -1);
      if (pathname === prefixNoSlash) return { matched: true, params: {}, specificity: 15 };
      if (pathname.startsWith(prefix)) return { matched: true, params: {}, specificity: 10 };
    }
    return { matched: false };
  }

  const params = {};
  let specificity = 0;
  for (let i = 0; i < rParts.length; i++) {
    const rp = rParts[i], pp = pParts[i];
    if (rp.startsWith(':')) { params[rp.slice(1)] = pp; specificity += 5; }
    else if (rp === '*')    { return { matched: true, params, specificity: 1 }; }
    else if (rp === pp)     { specificity += 10; }
    else                    { return { matched: false }; }
  }
  return { matched: true, params, specificity };
}

function findRoute(pathname) {
  if (!state.registry) return null;
  let best = null;
  for (const route of Object.keys(state.registry.routes)) {
    const res = matchRoute(route, pathname);
    if (res.matched && (!best || res.specificity > best.specificity)) {
      best = { route, entry: state.registry.routes[route], params: res.params, specificity: res.specificity };
    }
  }
  return best;
}

// ============================================================
//  MIDDLEWARE
// ============================================================

function applyCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', CONFIG.cors.allowOrigin);
  res.setHeader('Access-Control-Allow-Methods', CONFIG.cors.allowMethods);
  res.setHeader('Access-Control-Allow-Headers', CONFIG.cors.allowHeaders);
  res.setHeader('Access-Control-Max-Age', String(CONFIG.cors.maxAge));
}

function applyRateLimit(req, res) {
  if (!CONFIG.rateLimit.enabled) return true;
  const ip = req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  let bucket = state.rateBuckets.get(ip);
  if (!bucket || bucket.resetAt < now) {
    bucket = { count: 0, resetAt: now + CONFIG.rateLimit.windowMs };
    state.rateBuckets.set(ip, bucket);
  }
  bucket.count++;
  const remaining = Math.max(0, CONFIG.rateLimit.maxPerWindow - bucket.count);
  res.setHeader('X-RateLimit-Limit', String(CONFIG.rateLimit.maxPerWindow));
  res.setHeader('X-RateLimit-Remaining', String(remaining));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(bucket.resetAt / 1000)));
  if (bucket.count > CONFIG.rateLimit.maxPerWindow) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'rate_limit_exceeded', retry_after: Math.ceil((bucket.resetAt - now) / 1000) }));
    return false;
  }
  return true;
}

// ============================================================
//  КЭШ ОТВЕТОВ
// ============================================================

function cacheKeyFor(route, method, query) {
  const q = Object.keys(query || {}).sort().map(k => `${k}=${query[k]}`).join('&');
  return `${method}:${route}?${q}`;
}

function cacheGet(key) {
  const item = state.responseCache.get(key);
  if (!item) return null;
  if (item.expires < Date.now()) { state.responseCache.delete(key); return null; }
  return item;
}

function cachePut(key, body, status, headers, ttlSec) {
  if (state.responseCache.size >= CONFIG.cache.maxEntries) {
    const firstKey = state.responseCache.keys().next().value;
    state.responseCache.delete(firstKey);
  }
  state.responseCache.set(key, {
    body, status, headers,
    expires: Date.now() + ttlSec * 1000,
  });
}

// ============================================================
//  CIRCUIT BREAKER
// ============================================================

function circuitCheck(moduleId) {
  if (!CONFIG.circuitBreaker.enabled) return true;
  const c = state.circuit.get(moduleId);
  if (!c) return true;
  if (c.openUntil && c.openUntil > Date.now()) return false;
  if (c.openUntil && c.openUntil <= Date.now()) {
    state.circuit.delete(moduleId);
    return true;
  }
  return true;
}

function circuitFail(moduleId) {
  const c = state.circuit.get(moduleId) || { fails: 0, openUntil: 0 };
  c.fails++;
  if (c.fails >= CONFIG.circuitBreaker.failThreshold) {
    c.openUntil = Date.now() + CONFIG.circuitBreaker.openMs;
    c.fails = 0;
    console.warn(`[router] circuit OPEN for ${moduleId} on ${CONFIG.circuitBreaker.openMs}ms`);
  }
  state.circuit.set(moduleId, c);
}

function circuitOk(moduleId) {
  state.circuit.delete(moduleId);
}

// ============================================================
//  МЕТРИКИ
// ============================================================

function metricStart(route) {
  let m = state.metrics.get(route);
  if (!m) { m = { calls: 0, errors: 0, totalMs: 0, lastAt: null, lastStatus: 0 }; state.metrics.set(route, m); }
  m.calls++;
  return m;
}

function metricEnd(route, ms, status) {
  const m = state.metrics.get(route);
  if (!m) return;
  m.totalMs += ms;
  m.lastAt = new Date().toISOString();
  m.lastStatus = status;
  if (status >= 500) m.errors++;
}

// ============================================================
//  ФОРМАТ ОТВЕТА (JSON / JSONP / CSV)
// ============================================================

function wantsCSV(req) {
  const url = new URL(req.url, 'http://x');
  return url.searchParams.get('format') === 'csv';
}

function wantsJSONP(req) {
  const url = new URL(req.url, 'http://x');
  return url.searchParams.get('callback');
}

function toCSV(data) {
  const arr = Array.isArray(data) ? data : (data && Array.isArray(data.features) ? data.features : null);
  if (!arr) return null;
  if (arr.length === 0) return '';
  const keys = new Set();
  for (const row of arr) {
    const flat = { ...(row.properties || row), _lat: row?.geometry?.coordinates?.[1], _lng: row?.geometry?.coordinates?.[0] };
    Object.keys(flat).forEach(k => keys.add(k));
  }
  const cols = [...keys];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(',');
  const body = arr.map(row => {
    const flat = { ...(row.properties || row), _lat: row?.geometry?.coordinates?.[1], _lng: row?.geometry?.coordinates?.[0] };
    return cols.map(c => esc(flat[c])).join(',');
  }).join('\n');
  return head + '\n' + body + '\n';
}

// ============================================================
//  ВСПОМОГАТЕЛЬНОЕ — запись JSON-ответа
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

// ============================================================
//  СЛУЖЕБНЫЕ ЭНДПОИНТЫ РЕЕСТРА
// ============================================================

/**
 * Формирует запись модуля для отдачи в UI/клиент.
 */
function serializeEntry(route, entry, kind) {
  return {
    route,
    kind,
    moduleId: entry.moduleId,
    method: entry.method || null,
    methods: Array.isArray(entry.methods) ? entry.methods : null,
    meta: entry.meta || {},
  };
}

/**
 * GET /api/registry/layers — только Layer (из _sections.layer).
 */
async function handleRegistryLayers(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const layers = Object.entries(state.registry._sections?.layer || {})
    .map(([route, entry]) => serializeEntry(route, entry, 'layer'));
  return sendJSON(res, 200, {
    count: layers.length,
    kind: 'layer',
    layers,
    generated_at: state.registry.meta?.generated_at || null,
  });
}

/**
 * GET /api/registry/services — только Service (из _sections.service).
 */
async function handleRegistryServices(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const services = Object.entries(state.registry._sections?.service || {})
    .map(([route, entry]) => serializeEntry(route, entry, 'service'));
  return sendJSON(res, 200, {
    count: services.length,
    kind: 'service',
    services,
    generated_at: state.registry.meta?.generated_at || null,
  });
}

/**
 * GET /api/registry/summary — краткая сводка { layers, services, total }.
 */
async function handleRegistrySummary(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const layer = state.registry._sections?.layer || {};
  const service = state.registry._sections?.service || {};
  return sendJSON(res, 200, {
    layers: Object.keys(layer).length,
    services: Object.keys(service).length,
    total: Object.keys(layer).length + Object.keys(service).length,
    generated_at: state.registry.meta?.generated_at || null,
    reload_count: state.registryReloadCount,
  });
}

/**
 * GET /api/registry/modules?kind=layer|service
 * Без kind — отдаёт оба раздела в одном ответе.
 */
async function handleRegistryModules(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const url = new URL(req.url, 'http://x');
  const kind = (url.searchParams.get('kind') || '').toLowerCase();

  const layer = state.registry._sections?.layer || {};
  const service = state.registry._sections?.service || {};

  if (kind === 'layer') {
    const layers = Object.entries(layer).map(([route, e]) => serializeEntry(route, e, 'layer'));
    return sendJSON(res, 200, { kind: 'layer', count: layers.length, modules: layers });
  }
  if (kind === 'service') {
    const services = Object.entries(service).map(([route, e]) => serializeEntry(route, e, 'service'));
    return sendJSON(res, 200, { kind: 'service', count: services.length, modules: services });
  }
  if (kind && kind !== 'layer' && kind !== 'service') {
    return sendJSON(res, 400, { error: 'invalid_kind', allowed: ['layer', 'service'] });
  }

  const layers = Object.entries(layer).map(([route, e]) => serializeEntry(route, e, 'layer'));
  const services = Object.entries(service).map(([route, e]) => serializeEntry(route, e, 'service'));
  return sendJSON(res, 200, {
    total: layers.length + services.length,
    counts: { layers: layers.length, services: services.length },
    layers,
    services,
  });
}

/**
 * GET /api/registry/module/:id — конкретный модуль по moduleId (без -api).
 */
async function handleRegistryModule(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const url = new URL(req.url, 'http://x');
  const id = decodeURIComponent(url.pathname.replace(/^\/api\/registry\/module\//, '').split('/')[0] || '');
  if (!id) return sendJSON(res, 400, { error: 'module_id_required' });

  const layer = state.registry._sections?.layer || {};
  const service = state.registry._sections?.service || {};

  // moduleId в реестре с суффиксом -api. Пробуем оба варианта.
  const tryIds = [id, `${id}-api`];
  for (const [route, entry] of Object.entries(layer)) {
    if (tryIds.includes(entry.moduleId)) {
      return sendJSON(res, 200, { kind: 'layer', module: serializeEntry(route, entry, 'layer') });
    }
  }
  for (const [route, entry] of Object.entries(service)) {
    if (tryIds.includes(entry.moduleId)) {
      return sendJSON(res, 200, { kind: 'service', module: serializeEntry(route, entry, 'service') });
    }
  }
  return sendJSON(res, 404, { error: 'module_not_found', id, tried: tryIds });
}

/**
 * GET /api/registry/health — health-check сервера и реестра.
 */
async function handleRegistryHealth(req, res) {
  const health = {
    ok: true,
    uptime_s: Math.floor(process.uptime()),
    registry_loaded: !!state.registry,
    registry_age_s: state.registryLoadedAt ? Math.floor((Date.now() - new Date(state.registryLoadedAt).getTime()) / 1000) : null,
    registry_routes: state.registry ? Object.keys(state.registry.routes).length : 0,
    registry_layers: state.registry?._sections?.layer ? Object.keys(state.registry._sections.layer).length : 0,
    registry_services: state.registry?._sections?.service ? Object.keys(state.registry._sections.service).length : 0,
    module_cache_size: state.moduleCache.size,
    response_cache_size: state.responseCache.size,
    circuits_open: [...state.circuit.entries()].filter(([, c]) => c.openUntil > Date.now()).length,
    active_requests: state.activeRequests.size,
    metrics: Object.fromEntries([...state.metrics.entries()].map(([r, m]) => [r, {
      calls: m.calls,
      errors: m.errors,
      avg_ms: m.calls > 0 ? Math.round(m.totalMs / m.calls) : 0,
      last_at: m.lastAt,
      last_status: m.lastStatus,
    }])),
  };
  return sendJSON(res, health.ok ? 200 : 503, health);
}

/**
 * GET /api/registry/stats — детальная статистика реестра.
 */
async function handleRegistryStats(req, res) {
  if (!state.registry) return sendJSON(res, 503, { error: 'registry_not_loaded' });
  const layerRoutes = state.registry._sections?.layer || {};
  const serviceRoutes = state.registry._sections?.service || {};

  const layerByCategory = {};
  const layerByIcon = {};
  for (const entry of Object.values(layerRoutes)) {
    const cat = (entry.meta && entry.meta.category) || 'unknown';
    layerByCategory[cat] = (layerByCategory[cat] || 0) + 1;
    const icon = (entry.meta && entry.meta.icon) || 'unknown';
    layerByIcon[icon] = (layerByIcon[icon] || 0) + 1;
  }

  const servicesByMethod = {};
  const servicesByName = {};
  for (const [route, entry] of Object.entries(serviceRoutes)) {
    const methods = getAllowedMethods(entry) || ['ANY'];
    for (const m of methods) {
      servicesByMethod[m] = (servicesByMethod[m] || 0) + 1;
    }
    servicesByName[route] = {
      moduleId: entry.moduleId,
      methods,
      description: entry.meta?.description || null,
    };
  }

  return sendJSON(res, 200, {
    total_routes: Object.keys(state.registry.routes).length,
    total_layers: Object.keys(layerRoutes).length,
    total_services: Object.keys(serviceRoutes).length,
    layer_by_category: layerByCategory,
    layer_by_icon: layerByIcon,
    services_by_method: servicesByMethod,
    services: servicesByName,
    registry_generated_at: state.registry.meta?.generated_at || null,
    registry_reload_count: state.registryReloadCount,
  });
}

/**
 * BUILTIN_ENDPOINTS — служебные эндпоинты сервера Crucix.
 * НЕ путать с Service-модулями из /apis/sources/*-api.mjs с route /api/services/*.
 * Здесь — обработчики самого роутера (реестр, health, stats и т.д.).
 */
const BUILTIN_ENDPOINTS = {
  '/api/registry/layers':     handleRegistryLayers,
  '/api/registry/services':   handleRegistryServices,
  '/api/registry/summary':    handleRegistrySummary,
  '/api/registry/modules':    handleRegistryModules,
  '/api/registry/module/:id': handleRegistryModule,
  '/api/registry/health':     handleRegistryHealth,
  '/api/registry/stats':      handleRegistryStats,
};

// ============================================================
//  ПОИСК BUILTIN-ЭНДПОИНТА (с поддержкой :id)
// ============================================================

function findBuiltinEndpoint(pathname) {
  if (BUILTIN_ENDPOINTS[pathname]) return BUILTIN_ENDPOINTS[pathname];
  // Проверка с :id
  for (const pattern of Object.keys(BUILTIN_ENDPOINTS)) {
    if (!pattern.includes(':')) continue;
    const res = matchRoute(pattern, pathname);
    if (res.matched) return BUILTIN_ENDPOINTS[pattern];
  }
  return null;
}

// ============================================================
//  ОСНОВНОЙ ОБРАБОТЧИК
// ============================================================

export async function handleAPI(req, res, pathname) {
  const startTime = Date.now();
  const reqId = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', reqId);
  applyCORS(res);

  // Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return true;
  }

  if (state.shuttingDown) {
    return sendJSON(res, 503, { error: 'shutting_down' });
  }

  if (!applyRateLimit(req, res)) return true;

  // Служебные эндпоинты (BUILTIN)
  const builtinHandler = findBuiltinEndpoint(pathname);
  if (builtinHandler) {
    state.activeRequests.add(reqId);
    try {
      await builtinHandler(req, res);
    } catch (e) {
      if (!res.headersSent) sendJSON(res, 500, { error: 'builtin_handler_failed', message: e.message });
    } finally {
      state.activeRequests.delete(reqId);
      logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status: res.statusCode, durationMs: Date.now() - startTime, moduleId: null, route: pathname });
    }
    return true;
  }

  // Поиск маршрута в реестре
  const match = findRoute(pathname);
  if (!match) {
    sendJSON(res, 404, { error: 'route_not_found', path: pathname });
    logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status: 404, durationMs: Date.now() - startTime, moduleId: null, route: null });
    return true;
  }

  const { route, entry, params } = match;
  const { moduleId, file, meta } = entry;
  metricStart(route);
  req.params = params;

  // Проверка методов — МУЛЬТИМЕТОДНАЯ (method или methods)
  const allowedMethods = getAllowedMethods(entry);
  if (allowedMethods && !allowedMethods.includes(req.method) && req.method !== 'HEAD') {
    const allowHeader = allowedMethods.join(', ');
    sendJSON(res, 405, { error: 'method_not_allowed', allowed: allowedMethods }, { 'Allow': allowHeader });
    metricEnd(route, Date.now() - startTime, 405);
    logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status: 405, durationMs: Date.now() - startTime, moduleId, route });
    return true;
  }

  // Circuit breaker
  if (!circuitCheck(moduleId)) {
    sendJSON(res, 503, { error: 'circuit_open', moduleId, retry_after: 30 }, { 'Retry-After': '30' });
    metricEnd(route, Date.now() - startTime, 503);
    logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status: 503, durationMs: Date.now() - startTime, moduleId, route });
    return true;
  }

  // Кэш ответов
  const urlObj = new URL(req.url, 'http://x');
  const query = Object.fromEntries(urlObj.searchParams.entries());
  const cacheKey = cacheKeyFor(route, req.method, query);
  const ttl = Number(meta.cache) || 0;
  if (ttl > 0 && req.method === 'GET' && !wantsCSV(req) && !wantsJSONP(req)) {
    const cached = cacheGet(cacheKey);
    if (cached) {
      res.writeHead(cached.status, { ...cached.headers, 'X-Cache': 'HIT' });
      res.end(cached.body);
      metricEnd(route, Date.now() - startTime, cached.status);
      logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status: cached.status, durationMs: Date.now() - startTime, moduleId, route, cache: 'HIT' });
      return true;
    }
  }

  // Загрузка и вызов модуля
  state.activeRequests.add(reqId);
  const captured = { status: 0, headers: {}, chunks: [] };
  const originalWriteHead = res.writeHead.bind(res);
  const originalSetHeader = res.setHeader.bind(res);
  const originalEnd = res.end.bind(res);
  const originalWrite = res.write.bind(res);

  res.writeHead = (status, headers) => {
    captured.status = status;
    if (headers) Object.assign(captured.headers, headers);
    if (headers) for (const [k, v] of Object.entries(headers)) originalSetHeader(k, v);
    return res;
  };
  res.write = (chunk, enc) => { captured.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc)); return true; };
  res.end = (chunk, enc) => {
    if (chunk) captured.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, enc));
    const body = Buffer.concat(captured.chunks);
    const status = captured.status || 200;

    const jsonpCallback = wantsJSONP(req);
    const csvRequested = wantsCSV(req);
    let finalBody = body;
    let finalHeaders = { ...captured.headers };

    if (csvRequested && status === 200) {
      try {
        const parsed = JSON.parse(body.toString('utf8'));
        const csv = toCSV(parsed);
        if (csv !== null) {
          finalBody = Buffer.from(csv, 'utf8');
          finalHeaders['Content-Type'] = 'text/csv; charset=utf-8';
        }
      } catch {}
    } else if (jsonpCallback && status === 200) {
      finalBody = Buffer.from(`${jsonpCallback}(${body.toString('utf8')});`, 'utf8');
      finalHeaders['Content-Type'] = 'application/javascript; charset=utf-8';
    }

    if (ttl > 0 && status === 200 && req.method === 'GET' && !csvRequested && !jsonpCallback) {
      cachePut(cacheKey, finalBody, status, finalHeaders, ttl);
    }

    finalHeaders['Content-Length'] = String(finalBody.length);
    originalWriteHead(status, finalHeaders);

    if (CONFIG.gzip.enabled && finalBody.length >= CONFIG.gzip.minBytes && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
      originalSetHeader('Content-Encoding', 'gzip');
      const gz = createGzip();
      gz.on('data', d => originalWrite(d));
      gz.on('end', () => originalEnd());
      gz.end(finalBody);
    } else {
      originalWrite(finalBody);
      originalEnd();
    }

    metricEnd(route, Date.now() - startTime, status);
    if (status >= 500) circuitFail(moduleId); else circuitOk(moduleId);
    logLine({
      ts: new Date().toISOString(), reqId, method: req.method, path: pathname,
      status, durationMs: Date.now() - startTime, moduleId, route,
      bytes: finalBody.length, format: csvRequested ? 'csv' : jsonpCallback ? 'jsonp' : 'json',
    });
    state.activeRequests.delete(reqId);
    return res;
  };

  try {
    const loaded = await loadModule(moduleId, file);
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('handler_timeout')), CONFIG.timeout.handlerMs));
    await Promise.race([loaded.handler(req, res), timeout]);
  } catch (e) {
    const status = e.message === 'handler_timeout' ? 504 : 500;
    if (!res.headersSent) {
      originalWriteHead(status, { 'Content-Type': 'application/json' });
      originalEnd(JSON.stringify({
        error: status === 504 ? 'handler_timeout' : 'handler_threw',
        moduleId,
        message: e.message,
        stack: CONFIG.dev ? (e.stack || '').split('\n').slice(0, 5) : undefined,
      }));
    }
    circuitFail(moduleId);
    metricEnd(route, Date.now() - startTime, status);
    logError({ ts: new Date().toISOString(), reqId, path: pathname, moduleId, err: e.message, stack: CONFIG.dev ? e.stack : undefined });
    logLine({ ts: new Date().toISOString(), reqId, method: req.method, path: pathname, status, durationMs: Date.now() - startTime, moduleId, route });
    state.activeRequests.delete(reqId);
  }

  return true;
}

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ И GRACEFUL SHUTDOWN
// ============================================================

export async function initRouter() {
  await ensureLogsDir();
  await loadRegistry();
  await watchRegistry();
  console.log('[router] инициализация завершена');
}

export async function shutdownRouter() {
  state.shuttingDown = true;
  const deadline = Date.now() + 5000;
  while (state.activeRequests.size > 0 && Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`[router] shutdown: ${state.activeRequests.size} активных запросов осталось`);
}

export function getRouterState() {
  return state;
}
