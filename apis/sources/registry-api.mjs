/**
 * apis/sources/registry-api.mjs — SERVICE-МОДУЛЬ: АВТОРЕЕСТР КОМПОНЕНТОВ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: сканирует файловую систему проекта (dashboard/public, apis/sources, scripts, scripts/collectors, data/basket) на каждый запрос.
 * ДОПОЛНИТЕЛЬНО: server/registry.generated.json (сгенерированный реестр Layer/Service).
 *
 * ЭНДПОИНТЫ:
 *   GET /             — полный реестр (все страницы, API, сборщики, скрипты, basket)
 *   GET /stats        — только сводка
 *   GET /pages        — страницы
 *   GET /api          — API-модули
 *   GET /collectors   — сборщики
 *   GET /scripts      — остальные скрипты
 *   GET /basket       — файлы корзины
 *   GET /generated    — сгенерированный реестр (registry.generated.json)
 *   GET /health       — проверка работы сервиса
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DESCRIPTIONS_FILE = join(PROJECT_ROOT, 'data', 'registry', 'registry-descriptions.json');
const GENERATED_FILE = join(PROJECT_ROOT, 'server', 'registry.generated.json');

export const route  = '/api/services/registry';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Registry service: scans the entire project (pages, API modules, collectors, scripts, basket) and returns a full inventory. Also proxies registry.generated.json.',
  cache: 60,
  version: '2.0.0',
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function fileInfo(filePath) {
  try {
    const st = await fs.stat(filePath);
    return { size: st.size, sizeFormatted: formatSize(st.size), mtime: st.mtime.toISOString() };
  } catch { return { size: 0, sizeFormatted: '0 B', mtime: null }; }
}

async function scanDir(dir, extensions, filterFn) {
  const out = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isFile()) continue;
      const ext = extname(e.name).toLowerCase();
      if (!extensions.includes(ext)) continue;
      if (filterFn && !filterFn(e.name)) continue;
      const full = join(dir, e.name);
      const info = await fileInfo(full);
      out.push({ name: e.name, path: full, ...info });
    }
  } catch {}
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

let _descriptions = null;
async function loadDescriptions() {
  if (_descriptions) return _descriptions;
  try {
    const raw = await fs.readFile(DESCRIPTIONS_FILE, 'utf8');
    const data = JSON.parse(raw);
    _descriptions = data.descriptions || {};
  } catch { _descriptions = {}; }
  return _descriptions;
}

function getDescription(name, type, descriptions) {
  const key = name.replace(/\.(html|mjs|js|sh)$/, '').replace(/^collect-/, '');
  if (descriptions[key]) return descriptions[key];
  const defaults = { page: 'Страница интерфейса', api: 'API-модуль', collector: 'Сборщик данных', script: 'Системный скрипт', basket: 'Файл данных' };
  return defaults[type] || '—';
}

// ============================================================
//  СБОР РЕЕСТРА
// ============================================================

async function collectRegistry() {
  const timestamp = new Date().toISOString();
  const descriptions = await loadDescriptions();

  const pages = await scanDir(join(PROJECT_ROOT, 'dashboard', 'public'), ['.html'],
    n => !n.startsWith('_') && n !== 'index.html' && !n.includes('template'));
  const apiFiles = await scanDir(join(PROJECT_ROOT, 'apis', 'sources'), ['.mjs', '.js']);
  const allScripts = await scanDir(join(PROJECT_ROOT, 'scripts'), ['.mjs', '.js', '.sh']);
  const collectors = await scanDir(join(PROJECT_ROOT, 'scripts', 'collectors'), ['.mjs', '.js', '.sh']);
  const scripts = allScripts.filter(f => !f.path.includes('/collectors/') && !f.name.startsWith('collect-'));
  const basket = await scanDir(join(PROJECT_ROOT, 'data', 'basket'), ['.json']);

  const summary = {
    pages: pages.length,
    api: apiFiles.length,
    collectors: collectors.length,
    scripts: scripts.length,
    basket: basket.length,
    total: pages.length + apiFiles.length + collectors.length + scripts.length + basket.length,
  };

  return {
    timestamp,
    summary,
    pages: pages.map(p => ({
      name: p.name, url: '/' + p.name.replace(/\.html$/, ''),
      size: p.size, sizeFormatted: p.sizeFormatted, mtime: p.mtime,
      description: getDescription(p.name, 'page', descriptions),
    })),
    api: apiFiles.map(a => ({
      name: a.name, url: '/api/layers/' + a.name.replace(/\.(mjs|js)$/, ''),
      size: a.size, sizeFormatted: a.sizeFormatted, mtime: a.mtime,
      description: getDescription(a.name, 'api', descriptions),
    })),
    collectors: collectors.map(c => ({
      name: c.name, source: c.name.replace(/^collect-/, '').replace(/\.(mjs|js|sh)$/, '').toUpperCase(),
      size: c.size, sizeFormatted: c.sizeFormatted, mtime: c.mtime,
      description: getDescription(c.name, 'collector', descriptions),
    })),
    scripts: scripts.map(s => ({
      name: s.name, path: s.path.replace(PROJECT_ROOT + '/', ''),
      size: s.size, sizeFormatted: s.sizeFormatted, mtime: s.mtime,
      description: getDescription(s.name, 'script', descriptions),
    })),
    basket: basket.map(b => ({
      name: b.name, size: b.size, sizeFormatted: b.sizeFormatted, mtime: b.mtime,
      description: getDescription(b.name, 'basket', descriptions),
    })),
  };
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epRoot() { return collectRegistry(); }
async function epStats() { const r = await collectRegistry(); return { summary: r.summary, timestamp: r.timestamp }; }
async function epPages() { const r = await collectRegistry(); return { pages: r.pages, total: r.pages.length }; }
async function epApi() { const r = await collectRegistry(); return { api: r.api, total: r.api.length }; }
async function epCollectors() { const r = await collectRegistry(); return { collectors: r.collectors, total: r.collectors.length }; }
async function epScripts() { const r = await collectRegistry(); return { scripts: r.scripts, total: r.scripts.length }; }
async function epBasket() { const r = await collectRegistry(); return { basket: r.basket, total: r.basket.length }; }

async function epGenerated() {
  try {
    const raw = await fs.readFile(GENERATED_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    if (e.code === 'ENOENT') { const err = new Error('generated_registry_missing'); err.statusCode = 503; err.hint = 'run node server/build-registry.mjs'; throw err; }
    throw e;
  }
}

async function epHealth() {
  const r = await collectRegistry();
  return { ok: true, timestamp: r.timestamp, summary: r.summary };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(data) {
  if (!data || typeof data !== 'object') return null;
  const key = ['pages', 'api', 'collectors', 'scripts', 'basket'].find(k => Array.isArray(data[k]));
  if (!key) return null;
  const arr = data[key];
  if (arr.length === 0) return '';
  const cols = [...new Set(arr.flatMap(r => Object.keys(r || {})))];
  const esc = (v) => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  return cols.join(',') + '\n' + arr.map(r => cols.map(c => esc(r[c])).join(',')).join('\n') + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
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
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/registry/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'registry',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const segs = subPath.split('/').filter(Boolean);
    let result;

    if (segs.length === 0) result = await epRoot();
    else if (segs[0] === 'stats') result = await epStats();
    else if (segs[0] === 'pages') result = await epPages();
    else if (segs[0] === 'api') result = await epApi();
    else if (segs[0] === 'collectors') result = await epCollectors();
    else if (segs[0] === 'scripts') result = await epScripts();
    else if (segs[0] === 'basket') result = await epBasket();
    else if (segs[0] === 'generated') result = await epGenerated();
    else if (segs[0] === 'health') result = await epHealth();
    else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }

    if (format === 'csv') {
      const csv = toCSV(result);
      if (csv === null) return sendJSON(res, 400, { error: 'csv_not_supported' }, extra);
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }
    if (format === 'stats') return sendJSON(res, 200, { stats: result.summary || result, timestamp: result.timestamp || new Date().toISOString() }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: result }, extra);

    return sendJSON(res, 200, {
      service: 'registry',
      endpoint: subPath,
      generated_at: new Date().toISOString(),
      data: result,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
