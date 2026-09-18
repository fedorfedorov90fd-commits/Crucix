/**
 * apis/sources/diagnostic-tool-api.mjs — SERVICE-МОДУЛЬ: ДИАГНОСТИЧЕСКИЙ ИНСТРУМЕНТ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: сканирует файловую систему проекта (dashboard/public, apis/sources, scripts, data/basket, server.mjs).
 *
 * Полная диагностика проекта Crucix: страницы, API-модули, слои, сборщики, корзина,
 * размеры, даты обновления, регистрация в server.mjs, health-check подсистем.
 *
 * ЭНДПОИНТЫ:
 *   GET /                   — сводка
 *   GET /stats              — детальная статистика
 *   GET /health             — health-check подсистем
 *   GET /pages              — все HTML-страницы
 *   GET /api                — все API-модули
 *   GET /layers             — работоспособность слоёв через /api/registry/stats
 *   GET /collectors         — все сборщики
 *   GET /basket             — файлы корзины
 *   GET /report             — текстовый отчёт (?types=&maxSizeKB=)
 *   GET /scripts            — все скрипты
 *   GET /config             — конфиги проекта
 *
 * ФОРМАТ: JSON.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const PUBLIC_DIR = join(PROJECT_ROOT, 'dashboard', 'public');
const API_DIR = join(PROJECT_ROOT, 'apis', 'sources');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');
const COLLECTORS_DIR = join(SCRIPTS_DIR, 'collectors');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const CONFIG_DIR = join(PROJECT_ROOT, 'data', 'config');
const SERVER_FILE = join(PROJECT_ROOT, 'server.mjs');

export const route  = '/api/services/diagnostic-tool';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Diagnostic tool service: scan project FS (pages, API modules, layers, collectors, basket), generate text report, health-check subsystems.',
  cache: 30,
  version: '2.0.0',
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

async function readFileSafe(path) {
  try { return await fs.readFile(path, 'utf-8'); } catch { return null; }
}

async function fileExists(path) {
  try { await fs.access(path); return true; } catch { return false; }
}

async function scanDirectory(dir, pattern = null) {
  const result = [];
  try {
    const entries = await fs.readdir(dir);
    for (const file of entries) {
      const fullPath = join(dir, file);
      let st;
      try { st = await fs.stat(fullPath); } catch { continue; }
      if (st.isDirectory()) {
        const sub = await scanDirectory(fullPath, pattern);
        result.push(...sub);
      } else if (!pattern || pattern.test(file)) {
        result.push({
          name: file,
          path: fullPath,
          size: st.size,
          mtime: st.mtime ? st.mtime.toISOString() : null,
        });
      }
    }
  } catch {}
  return result;
}

async function getServerContent() {
  return await readFileSafe(SERVER_FILE);
}

// ============================================================
//  КОМПОНЕНТЫ ДИАГНОСТИКИ
// ============================================================

async function scanPages() {
  const files = await scanDirectory(PUBLIC_DIR, /\.html$/);
  const server = await getServerContent() || '';
  // НЕ используем regex из имени файла — только indexOf (защита от метасимволов)
  const registered = files.filter(f => {
    const name = f.name.replace(/\.html$/, '');
    const marker1 = `'/${name}'`;
    const marker2 = `${name}.html`;
    return server.indexOf(marker1) !== -1 || server.indexOf(marker2) !== -1;
  }).length;
  return {
    total: files.length,
    registered,
    unregistered: files.length - registered,
    total_size: files.reduce((s, f) => s + f.size, 0),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function scanApiModules() {
  const files = await scanDirectory(API_DIR, /-api\.mjs$/);
  return {
    total: files.length,
    total_size: files.reduce((s, f) => s + f.size, 0),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function scanCollectors() {
  const files = await scanDirectory(COLLECTORS_DIR, /^collect-.*\.mjs$/);
  const scriptFiles = await scanDirectory(SCRIPTS_DIR, /^collect-.*\.mjs$/);
  const all = [...files, ...scriptFiles.filter(f => !files.some(x => x.name === f.name))];
  return {
    total: all.length,
    total_size: all.reduce((s, f) => s + f.size, 0),
    files: all.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function scanBasket() {
  const files = await scanDirectory(BASKET_DIR, /\.json$/);
  return {
    total: files.length,
    total_size: files.reduce((s, f) => s + f.size, 0),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function scanScripts() {
  const files = await scanDirectory(SCRIPTS_DIR, /\.mjs$/);
  return {
    total: files.length,
    total_size: files.reduce((s, f) => s + f.size, 0),
    files: files.sort((a, b) => a.name.localeCompare(b.name)),
  };
}

async function scanConfigs() {
  const files = await scanDirectory(CONFIG_DIR, /\.json$/);
  return {
    total: files.length,
    total_size: files.reduce((s, f) => s + f.size, 0),
    files,
  };
}

// ============================================================
//  HEALTH-CHECK
// ============================================================

async function layerStatus() {
  const url = `http://127.0.0.1:${process.env.PORT || 3117}/api/registry/stats`;
  try {
    const res = await fetch(url);
    if (!res.ok) return { ok: false, status: res.status, error: 'registry_api_not_ok' };
    const data = await res.json();
    return {
      ok: true,
      status: res.status,
      total_routes: data.total_routes ?? null,
      total_layers: data.total_layers ?? null,
      total_services: data.total_services ?? null,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function healthCheck() {
  const [pages, api, collectors, basket] = await Promise.all([
    scanPages(), scanApiModules(), scanCollectors(), scanBasket(),
  ]);
  const layersCheck = await layerStatus();
  const serverOk = await fileExists(SERVER_FILE);
  const registryOk = await fileExists(join(PROJECT_ROOT, 'server', 'registry.generated.json'));

  const checks = {
    server_file:   { ok: serverOk, path: 'server.mjs' },
    registry_file: { ok: registryOk, path: 'server/registry.generated.json' },
    api_modules:   { ok: api.total > 100, count: api.total },
    pages:         { ok: pages.total > 0, count: pages.total },
    collectors:    { ok: collectors.total > 0, count: collectors.total },
    basket:        { ok: basket.total > 0, count: basket.total },
    layers_api:    layersCheck,
  };

  const failed = Object.values(checks).filter(c => !c.ok).length;
  return {
    ok: failed === 0,
    checks_count: Object.keys(checks).length,
    failed_count: failed,
    checks,
    timestamp: new Date().toISOString(),
  };
}

// ============================================================
//  ТЕКСТОВЫЙ ОТЧЁТ
// ============================================================

async function generateReport(options = {}) {
  const types = options.types || ['pages', 'api', 'collectors', 'basket'];
  const maxSizeKB = options.maxSizeKB || 100;
  const maxBytes = maxSizeKB * 1024;
  const lines = [];

  lines.push('════════════════════════════════════════════════════════════');
  lines.push('  CRUCIX DIAGNOSTIC REPORT');
  lines.push(`  Generated: ${new Date().toISOString()}`);
  lines.push('════════════════════════════════════════════════════════════');
  lines.push('');

  const summary = {};

  if (types.includes('pages')) {
    const p = await scanPages();
    summary.pages = { total: p.total, registered: p.registered, size: formatSize(p.total_size) };
    lines.push(`СТРАНИЦЫ (${p.total} файлов, ${formatSize(p.total_size)}):`);
    lines.push(`   Зарегистрировано в server.mjs: ${p.registered} из ${p.total}`);
    lines.push('');
    for (const f of p.files.slice(0, 50)) lines.push(`   ${f.name} — ${formatSize(f.size)}`);
    if (p.files.length > 50) lines.push(`   ... и ещё ${p.files.length - 50} файлов`);
    lines.push('');
  }

  if (types.includes('api')) {
    const a = await scanApiModules();
    summary.api = { total: a.total, size: formatSize(a.total_size) };
    lines.push(`API-МОДУЛИ (${a.total}, ${formatSize(a.total_size)}):`);
    lines.push('');
    for (const f of a.files.slice(0, 30)) lines.push(`   ${f.name} — ${formatSize(f.size)}`);
    if (a.files.length > 30) lines.push(`   ... и ещё ${a.files.length - 30} модулей`);
    lines.push('');
  }

  if (types.includes('collectors')) {
    const c = await scanCollectors();
    summary.collectors = { total: c.total, size: formatSize(c.total_size) };
    lines.push(`СБОРЩИКИ (${c.total}, ${formatSize(c.total_size)}):`);
    lines.push('');
    for (const f of c.files.slice(0, 30)) lines.push(`   ${f.name} — ${formatSize(f.size)}`);
    if (c.files.length > 30) lines.push(`   ... и ещё ${c.files.length - 30} сборщиков`);
    lines.push('');
  }

  if (types.includes('basket')) {
    const b = await scanBasket();
    summary.basket = { total: b.total, size: formatSize(b.total_size) };
    lines.push(`КОРЗИНА (${b.total} файлов, ${formatSize(b.total_size)}):`);
    lines.push('');
    for (const f of b.files.slice(0, 30)) lines.push(`   ${f.name} — ${formatSize(f.size)}`);
    if (b.files.length > 30) lines.push(`   ... и ещё ${b.files.length - 30} файлов`);
    lines.push('');
  }

  lines.push('────────────────────────────────────────────────────────────');
  lines.push('  ИТОГО:');
  for (const [k, v] of Object.entries(summary)) lines.push(`  ${k}: ${JSON.stringify(v)}`);
  lines.push('════════════════════════════════════════════════════════════');

  const fullText = lines.join('\n');
  const totalSize = Buffer.byteLength(fullText, 'utf-8');
  if (totalSize <= maxBytes) return { text: fullText, totalSize, truncated: false };
  const cut = fullText.slice(0, maxBytes - 200);
  return { text: cut + '\n\n[... ОБРЕЗАНО ДО ЛИМИТА]\n', totalSize, truncated: true };
}

// ============================================================
//  ОТВЕТЫ
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/diagnostic-tool/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'diagnostic-tool',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (subPath === '/report') {
      const types = (query.types || 'pages,api,collectors,basket').split(',').map(s => s.trim()).filter(Boolean);
      const maxSizeKB = parseInt(query.maxSizeKB || '100', 10);
      const report = await generateReport({ types, maxSizeKB });
      return sendText(res, 200, report.text, 'text/plain; charset=utf-8');
    }
    if (subPath === '/health') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/health', data: await healthCheck() }, extra);
    }
    if (subPath === '/pages') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/pages', data: await scanPages() }, extra);
    }
    if (subPath === '/api') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/api', data: await scanApiModules() }, extra);
    }
    if (subPath === '/layers') {
      const layers = await layerStatus();
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/layers', data: layers }, extra);
    }
    if (subPath === '/collectors') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/collectors', data: await scanCollectors() }, extra);
    }
    if (subPath === '/basket') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/basket', data: await scanBasket() }, extra);
    }
    if (subPath === '/scripts') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/scripts', data: await scanScripts() }, extra);
    }
    if (subPath === '/config') {
      return sendJSON(res, 200, { service: 'diagnostic-tool', endpoint: '/config', data: await scanConfigs() }, extra);
    }
    if (subPath === '/stats' || subPath === '/' || subPath === '') {
      const [pages, api, collectors, basket, scripts, configs, health] = await Promise.all([
        scanPages(), scanApiModules(), scanCollectors(), scanBasket(), scanScripts(), scanConfigs(), healthCheck(),
      ]);
      return sendJSON(res, 200, {
        service: 'diagnostic-tool',
        endpoint: subPath,
        data: {
          pages: { total: pages.total, registered: pages.registered, unregistered: pages.unregistered, size: formatSize(pages.total_size) },
          api: { total: api.total, size: formatSize(api.total_size) },
          collectors: { total: collectors.total, size: formatSize(collectors.total_size) },
          basket: { total: basket.total, size: formatSize(basket.total_size) },
          scripts: { total: scripts.total, size: formatSize(scripts.total_size) },
          configs: { total: configs.total, size: formatSize(configs.total_size) },
          health: { ok: health.ok, failed_count: health.failed_count },
          generated_at: new Date().toISOString(),
        },
      }, extra);
    }
    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['/', '/stats', '/health', '/pages', '/api', '/layers', '/collectors', '/basket', '/scripts', '/config', '/report'] }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    try { sendJSON(res, status, { error: 'service_error', message: e.message }, extra); } catch {}
  }
}
