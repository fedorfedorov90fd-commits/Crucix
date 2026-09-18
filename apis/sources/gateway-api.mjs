/**
 * apis/sources/gateway-api.mjs — SERVICE-МОДУЛЬ: ШЛЮЗ API
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: опрашивает /api/registry/* (self) для проверки доступности слоёв и сервисов.
 *
 * Служебный шлюз: проверка доступности маршрутов, health-check эндпоинтов,
 * мониторинг API-шлюза, список доступных разделов.
 *
 * ЭНДПОИНТЫ:
 *   GET /              — корень (список эндпоинтов + версия)
 *   GET /status        — статус шлюза
 *   GET /health        — health-check upstream (registry, слои, сервисы)
 *   GET /routes        — список всех маршрутов из реестра
 *   GET /layers        — список слоёв
 *   GET /services      — список сервисов
 *   GET /upstream      — проверка upstream (/api/registry/stats)
 *   GET /ping/:name    — пинг конкретного маршрута
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const REGISTRY_FILE = join(PROJECT_ROOT, 'server', 'registry.generated.json');
const BASE_URL = `http://127.0.0.1:${process.env.PORT || 3117}`;

export const route  = '/api/services/gateway';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'API gateway service: route inventory, upstream health-check, layer/service listings, ping.',
  cache: 10,
  version: '2.0.0',
};

// ============================================================
//  ЗАГРУЗКА РЕЕСТРА
// ============================================================

let _registryCache = null;
let _registryCacheTime = 0;
const REGISTRY_TTL = 10_000;

async function loadRegistry() {
  const now = Date.now();
  if (_registryCache && (now - _registryCacheTime) < REGISTRY_TTL) return _registryCache;
  try {
    const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
    _registryCache = JSON.parse(raw);
    _registryCacheTime = now;
    return _registryCache;
  } catch (e) {
    const err = new Error('registry_not_available: ' + e.message);
    err.statusCode = 503;
    err.hint = 'run node server/build-registry.mjs';
    throw err;
  }
}

// ============================================================
//  UPSTREAM-ЗАПРОСЫ
// ============================================================

async function fetchUpstream(pathname) {
  try {
    const res = await fetch(BASE_URL + pathname);
    const ok = res.ok;
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok, status: res.status, data };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function fetchUpstreamHead(pathname) {
  try {
    const res = await fetch(BASE_URL + pathname, { method: 'GET' });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, status: 0, error: e.message };
  }
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epRoot() {
  return {
    service: 'gateway',
    version: meta.version,
    endpoints: ['/', '/status', '/health', '/routes', '/layers', '/services', '/upstream', '/ping/:name'],
    generated_at: new Date().toISOString(),
  };
}

async function epStatus() {
  return { status: 'online', uptime_s: Math.floor(process.uptime()), timestamp: new Date().toISOString() };
}

async function epHealth() {
  const checks = {};
  // 1. registry stats
  const regStats = await fetchUpstream('/api/registry/stats');
  checks.registry = { ok: regStats.ok, status: regStats.status };
  if (regStats.ok && regStats.data) {
    checks.registry.total_routes = regStats.data.total_routes ?? null;
    checks.registry.total_layers = regStats.data.total_layers ?? null;
    checks.registry.total_services = regStats.data.total_services ?? null;
  }
  // 2. registry health
  const regHealth = await fetchUpstream('/api/registry/health');
  checks.registry_health = { ok: regHealth.ok, status: regHealth.status };

  const failed = Object.values(checks).filter(c => !c.ok).length;
  return {
    ok: failed === 0,
    checks_count: Object.keys(checks).length,
    failed_count: failed,
    checks,
    timestamp: new Date().toISOString(),
  };
}

async function epRoutes() {
  const reg = await loadRegistry();
  const routes = Object.entries(reg.routes || {}).map(([route, entry]) => ({
    route,
    moduleId: entry.moduleId,
    method: entry.method || 'GET',
    category: entry.meta?.category || null,
    cache: entry.meta?.cache ?? null,
  }));
  const services = Object.entries(reg.services || {}).map(([route, entry]) => ({
    route,
    moduleId: entry.moduleId,
    method: entry.method || 'GET',
    description: entry.meta?.description || null,
  }));
  return {
    total_layers: routes.length,
    total_services: services.length,
    total_routes: routes.length + services.length,
    layers: routes,
    services,
  };
}

async function epLayers() {
  const reg = await loadRegistry();
  const layers = Object.entries(reg.routes || {}).map(([route, entry]) => ({
    route, moduleId: entry.moduleId, method: entry.method || 'GET',
    category: entry.meta?.category || null,
    icon: entry.meta?.icon || null,
    description: entry.meta?.description || null,
  }));
  return { total: layers.length, layers };
}

async function epServices() {
  const reg = await loadRegistry();
  const services = Object.entries(reg.services || {}).map(([route, entry]) => ({
    route, moduleId: entry.moduleId, method: entry.method || 'GET',
    description: entry.meta?.description || null,
  }));
  return { total: services.length, services };
}

async function epUpstream() {
  const urls = ['/api/registry/stats', '/api/registry/health', '/api/registry/layers'];
  const results = {};
  for (const u of urls) {
    const r = await fetchUpstreamHead(u);
    results[u] = { ok: r.ok, status: r.status };
  }
  const failed = Object.values(results).filter(r => !r.ok).length;
  return { upstream_base: BASE_URL, checks: results, failed_count: failed };
}

async function epPing(name) {
  if (!name) { const e = new Error('field_required: name'); e.statusCode = 400; throw e; }
  const reg = await loadRegistry();
  // Ищем маршрут: точное совпадение, /api/layers/<name>, /api/services/<name>
  const candidates = [
    name,
    `/api/layers/${name}`,
    `/api/services/${name}`,
  ];
  let found = null;
  for (const c of candidates) {
    if (reg.routes?.[c] || reg.services?.[c]) { found = c; break; }
  }
  if (!found) { const e = new Error('route_not_found'); e.statusCode = 404; e.candidates = candidates; throw e; }
  const start = Date.now();
  const r = await fetchUpstreamHead(found);
  const durationMs = Date.now() - start;
  return { route: found, ok: r.ok, status: r.status, duration_ms: durationMs };
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
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/gateway/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'gateway',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (subPath === '/' || subPath === '') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/', data: await epRoot() }, extra);
    }
    if (subPath === '/status') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/status', data: await epStatus() }, extra);
    }
    if (subPath === '/health') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/health', data: await epHealth() }, extra);
    }
    if (subPath === '/routes') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/routes', data: await epRoutes() }, extra);
    }
    if (subPath === '/layers') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/layers', data: await epLayers() }, extra);
    }
    if (subPath === '/services') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/services', data: await epServices() }, extra);
    }
    if (subPath === '/upstream') {
      return sendJSON(res, 200, { service: 'gateway', endpoint: '/upstream', data: await epUpstream() }, extra);
    }
    if (subPath.startsWith('/ping/')) {
      const name = subPath.slice('/ping/'.length).split('/')[0];
      return sendJSON(res, 200, { service: 'gateway', endpoint: subPath, data: await epPing(name) }, extra);
    }
    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['/', '/status', '/health', '/routes', '/layers', '/services', '/upstream', '/ping/:name'] }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'upstream_unavailable' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    if (e.candidates) payload.candidates = e.candidates;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
