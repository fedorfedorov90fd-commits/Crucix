/**
 * apis/sources/monitor-api.mjs — SERVICE-МОДУЛЬ: МОНИТОР СИСТЕМЫ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: server/registry.generated.json + process.* (системные метрики).
 *
 * Монитор состояния системы Crucix: uptime, память, реестр, активные сервисы,
 * health-check подсистем, счётчики ошибок.
 *
 * ЭНДПОИНТЫ:
 *   GET /              — корень (список эндпоинтов + версия)
 *   GET /status        — health-check
 *   GET /state         — текущее состояние монитора
 *   GET /system        — системные метрики (uptime, память, версия Node)
 *   GET /registry      — состояние реестра (routes/services, время генерации)
 *   GET /services      — список всех сервисов из реестра
 *   GET /checks        — список проверок подсистем
 *   GET /metrics       — метрики (кол-во маршрутов, время работы, память)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const REGISTRY_FILE = join(PROJECT_ROOT, 'server', 'registry.generated.json');

export const route  = '/api/services/monitor';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'System monitor service: uptime, memory, registry state, active routes/services, subsystem health-checks.',
  cache: 10,
  version: '2.0.0',
};

const START_TIME = Date.now();
let _requestCount = 0;

// ============================================================
//  СИСТЕМНЫЕ МЕТРИКИ
// ============================================================

function getSystemMetrics() {
  const mem = process.memoryUsage();
  return {
    node_version: process.version,
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    uptime_s: Math.floor(process.uptime()),
    uptime_human: formatUptime(process.uptime()),
    monitor_uptime_s: Math.floor((Date.now() - START_TIME) / 1000),
    memory: {
      rss_mb: Number((mem.rss / 1024 / 1024).toFixed(2)),
      heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)),
      heap_total_mb: Number((mem.heapTotal / 1024 / 1024).toFixed(2)),
      external_mb: Number((mem.external / 1024 / 1024).toFixed(2)),
    },
    requests_handled: _requestCount,
    timestamp: new Date().toISOString(),
  };
}

function formatUptime(s) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(' ');
}

// ============================================================
//  РЕЕСТР
// ============================================================

async function loadRegistry() {
  let raw;
  try { raw = await fs.readFile(REGISTRY_FILE, 'utf8'); }
  catch (e) {
    const err = new Error('registry_not_available: ' + e.message);
    err.statusCode = 503;
    err.hint = 'run node server/build-registry.mjs';
    throw err;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_registry_json: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

async function getRegistryState() {
  const reg = await loadRegistry();
  const routes = Object.keys(reg.routes || {});
  const services = Object.keys(reg.services || {});
  const byCategory = {};
  for (const [route, entry] of Object.entries(reg.routes || {})) {
    const cat = entry.meta?.category || 'unknown';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }
  return {
    generated_at: reg.meta?.generated_at || null,
    total_layers: routes.length,
    total_services: services.length,
    total_routes: routes.length + services.length,
    by_category: byCategory,
  };
}

async function listServices() {
  const reg = await loadRegistry();
  return Object.entries(reg.services || {}).map(([route, entry]) => ({
    route,
    moduleId: entry.moduleId,
    method: entry.method || 'GET',
    description: entry.meta?.description || null,
  }));
}

// ============================================================
//  CHECKS
// ============================================================

async function runChecks() {
  const checks = {};
  // 1. Registry file
  try {
    await fs.access(REGISTRY_FILE);
    checks.registry_file = { ok: true, path: 'server/registry.generated.json' };
  } catch {
    checks.registry_file = { ok: false, path: 'server/registry.generated.json' };
  }
  // 2. Registry valid + numbers
  try {
    const reg = await loadRegistry();
    checks.registry_parsable = { ok: true };
    checks.registry_has_routes = { ok: (Object.keys(reg.routes || {}).length) > 0, count: Object.keys(reg.routes || {}).length };
    checks.registry_has_services = { ok: (Object.keys(reg.services || {}).length) > 0, count: Object.keys(reg.services || {}).length };
  } catch (e) {
    checks.registry_parsable = { ok: false, error: e.message };
    checks.registry_has_routes = { ok: false };
    checks.registry_has_services = { ok: false };
  }
  // 3. Memory
  const mem = process.memoryUsage();
  checks.memory_ok = { ok: mem.heapUsed < 500 * 1024 * 1024, heap_used_mb: Number((mem.heapUsed / 1024 / 1024).toFixed(2)) };
  // 4. Uptime
  checks.uptime_ok = { ok: process.uptime() > 5, uptime_s: Math.floor(process.uptime()) };

  const failed = Object.values(checks).filter(c => !c.ok).length;
  return { ok: failed === 0, checks_count: Object.keys(checks).length, failed_count: failed, checks, timestamp: new Date().toISOString() };
}

// ============================================================
//  STATE (текущее состояние монитора)
// ============================================================

async function getMonitorState() {
  let registryOk = false;
  let totalRoutes = 0;
  let totalServices = 0;
  try {
    const reg = await loadRegistry();
    registryOk = true;
    totalRoutes = Object.keys(reg.routes || {}).length;
    totalServices = Object.keys(reg.services || {}).length;
  } catch {}
  return {
    monitoring: true,
    registry_available: registryOk,
    total_routes: totalRoutes,
    total_services: totalServices,
    checks: 0,
    errors: 0,
    onlineModules: totalRoutes + totalServices,
    lastCheck: new Date().toISOString(),
  };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  _requestCount++;
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/monitor/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'monitor',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (subPath === '/' || subPath === '') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/', data: {
        version: meta.version,
        endpoints: ['/status', '/state', '/system', '/registry', '/services', '/checks', '/metrics'],
      }}, extra);
    }
    if (subPath === '/status') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/status', data: { status: 'online', version: meta.version, timestamp: new Date().toISOString() } }, extra);
    }
    if (subPath === '/state') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/state', data: await getMonitorState() }, extra);
    }
    if (subPath === '/system') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/system', data: getSystemMetrics() }, extra);
    }
    if (subPath === '/registry') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/registry', data: await getRegistryState() }, extra);
    }
    if (subPath === '/services') {
      const services = await listServices();
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/services', data: { services, total: services.length } }, extra);
    }
    if (subPath === '/checks') {
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/checks', data: await runChecks() }, extra);
    }
    if (subPath === '/metrics') {
      const [sys, reg] = await Promise.all([Promise.resolve(getSystemMetrics()), getRegistryState()]);
      return sendJSON(res, 200, { service: 'monitor', endpoint: '/metrics', data: {
        system: sys,
        registry: { total_routes: reg.total_routes, total_layers: reg.total_layers, total_services: reg.total_services },
        requests_handled: _requestCount,
      }}, extra);
    }
    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['/', '/status', '/state', '/system', '/registry', '/services', '/checks', '/metrics'] }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'registry_unavailable' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
