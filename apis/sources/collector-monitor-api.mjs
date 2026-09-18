/**
 * apis/sources/collector-monitor-api.mjs — SERVICE-МОДУЛЬ: МОНИТОРИНГ СБОРЩИКОВ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: сканирует data/basket/*.json (статус данных), logs/collectors/*.log (ошибки), scripts/collect-*.mjs (наличие скриптов), data/config/monitor-settings.json (настройки).
 *
 * Мониторинг сборщиков: статусы, сводка, логи, ошибки, сканирование, очистка логов и истории, перезапуск сборщиков (одиночный, batch, по статусу, все), настройки.
 *
 * ЭНДПОИНТЫ:
 *   GET /                   — корень (список эндпоинтов)
 *   GET /status             — статус всех сборщиков
 *   GET /summary            — сводка по статусам
 *   GET /scan               — сканирование скриптов
 *   GET /errors             — отчёт по ошибкам логов
 *   GET /logs/:name         — лог конкретного сборщика (?lines=N)
 *   POST /cleanup/logs      — очистить все логи
 *   POST /cleanup/history   — удалить историю
 *   POST /cleanup/auto      — автоочистка (?maxMB=N)
 *   GET /settings           — настройки
 *   POST /settings/set      — сохранить настройки (body: {...})
 *   POST /restart           — перезапуск одного (?name=)
 *   POST /restart/batch     — перезапуск списка (body: {names:[]})
 *   POST /restart/status    — перезапуск по статусу (?status=warning)
 *   POST /restart/all       — перезапуск всех
 *
 * ФОРМАТ: JSON (инфраструктурный сервис, CSV не имеет смысла).
 */

import { promises as fs, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const LOGS_DIR = join(PROJECT_ROOT, 'logs', 'collectors');
const SCRIPTS_DIR = join(PROJECT_ROOT, 'scripts');
const CONFIG_DIR = join(PROJECT_ROOT, 'data', 'config');
const SETTINGS_FILE = join(CONFIG_DIR, 'monitor-settings.json');

export const route  = '/api/services/collector-monitor';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Collector monitor service: statuses, summaries, logs, errors, cleanup, restart. Full control panel for scripts/collect-*.mjs.',
  cache: 0,
  version: '2.0.0',
};

const EXPECTED_COUNTS = {
  'vix': 200, 'bdi': 200, 'gold-oil-ratio': 200, 'inflation': 100,
  'unemployment': 80, 'pmi': 80, 'recession': 80, 'dxy': 200,
  'tips': 200, 'ovx': 200, 'hy-spread': 200, 'war-preparation': 100,
  'consumer-confidence': 80, 'nuclear-monitor': 80, 'social-unrest': 80,
  'copper-gold': 200, 'viirs': 100, 'uranium': 100, 'sp500-vix': 200,
  'crypto-fear': 100, 'oil-gas': 100, 'gold-silver': 200,
  'happiness': 50, 'big-mac': 50, 'big-mac-alt': 50,
  'big-mac-main': 50, 'debt-gdp': 80, 'vxx': 200, 'happiness-alt': 50,
};

const DEFAULT_SETTINGS = { maxLogSizeMB: 100, autoCleanup: true, cleanupInterval: 3600000, lastCleanup: null };

async function loadSettings() {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8')) }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}

async function saveSettings(settings) {
  try { await fs.mkdir(CONFIG_DIR, { recursive: true }); await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2)); }
  catch (e) { console.error('[Monitor] saveSettings error:', e.message); }
}

async function safeReaddir(dir) { try { return await fs.readdir(dir); } catch { return []; } }

function detectMode(collectorName) {
  const scriptPath = join(SCRIPTS_DIR, `collect-${collectorName}.mjs`);
  try {
    const content = readFileSync(scriptPath, 'utf8');
    if (/demo|test|mock|sample/i.test(content) && !/real|production|live/i.test(content)) return 'demo';
    return 'real';
  } catch { return 'inactive'; }
}

function parseLogErrorsSync(logPath) {
  try {
    const lines = readFileSync(logPath, 'utf8').split('\n').filter(Boolean);
    const errorLines = lines.filter(l => /\[ERROR\]|\[WARN\]|\[FAIL\]|\[ERR\]|Error:|Failed:|❌|Ошибка/i.test(l));
    return {
      total: lines.length,
      errors: errorLines,
      lastError: errorLines.length > 0 ? errorLines[errorLines.length - 1] : null,
      errorCount: errorLines.length,
    };
  } catch { return { total: 0, errors: [], lastError: null, errorCount: 0 }; }
}

async function getFolderSize(dir) {
  let size = 0;
  try {
    const files = await fs.readdir(dir);
    for (const f of files) {
      const st = await fs.stat(join(dir, f));
      if (st.isDirectory()) size += await getFolderSize(join(dir, f));
      else size += st.size;
    }
  } catch {}
  return size;
}

async function getLogsSize() { return getFolderSize(LOGS_DIR); }

async function cleanupLogs(maxSizeMB) {
  const files = await fs.readdir(LOGS_DIR).catch(() => []);
  const logFiles = files.filter(f => f.endsWith('.log') || f.endsWith('.txt'));
  const fileStats = await Promise.all(logFiles.map(async (f) => {
    const st = await fs.stat(join(LOGS_DIR, f));
    return { name: f, mtime: st.mtime, size: st.size };
  }));
  fileStats.sort((a, b) => a.mtime - b.mtime);
  let currentSize = await getLogsSize();
  const maxBytes = maxSizeMB * 1024 * 1024;
  const deleted = [];
  for (const file of fileStats) {
    if (currentSize <= maxBytes) break;
    await fs.unlink(join(LOGS_DIR, file.name));
    currentSize -= file.size;
    deleted.push(file.name);
  }
  return { deleted, deletedCount: deleted.length, currentSizeMB: Math.round(currentSize / (1024 * 1024 * 10)) / 10 };
}

async function clearAllLogs() {
  const files = await fs.readdir(LOGS_DIR).catch(() => []);
  const deleted = [];
  for (const file of files) {
    const filePath = join(LOGS_DIR, file);
    const st = await fs.stat(filePath);
    if (st.isFile() && (file.endsWith('.log') || file.endsWith('.txt'))) {
      await fs.unlink(filePath);
      deleted.push(file);
    }
  }
  return { deleted, count: deleted.length };
}

async function clearHistory() {
  const historyPath = join(CONFIG_DIR, 'monitor-history.json');
  if (existsSync(historyPath)) { await fs.unlink(historyPath); return { success: true, message: 'История удалена' }; }
  return { success: true, message: 'История не найдена' };
}

async function getCollectorStatus() {
  const results = [];
  const files = await safeReaddir(BASKET_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'daily-briefing-cache.json');

  for (const file of jsonFiles) {
    const name = file.replace('.json', '');
    const filePath = join(BASKET_DIR, file);
    const logPath = join(LOGS_DIR, `collect-${name}.log`);
    let count = 0, size = 0, ageHours = 0, lastRun = null, errorCount = 0;
    try {
      const data = JSON.parse(await fs.readFile(filePath, 'utf8'));
      if (Array.isArray(data)) count = data.length;
      else if (data.data && Array.isArray(data.data)) count = data.data.length;
      else if (data.features && Array.isArray(data.features)) count = data.features.length;
      const st = await fs.stat(filePath);
      size = st.size;
      ageHours = Math.round((Date.now() - st.mtime.getTime()) / 3600000 * 10) / 10;
      lastRun = st.mtime;
    } catch { count = 0; }
    try { errorCount = ((await fs.readFile(logPath, 'utf8')).match(/❌|ERROR|Ошибка|failed|Error:|Failed:/gi) || []).length; } catch { errorCount = 0; }
    const expected = EXPECTED_COUNTS[name] || 50;
    const hasData = count > 0, isRecent = ageHours < 24, hasExpected = count >= expected * 0.5;
    let status;
    if (!hasData && errorCount === 0) status = 'inactive';
    else if (!hasData && errorCount > 0) status = 'error';
    else if (hasData && !isRecent && errorCount > 3) status = 'error';
    else if (hasData && !isRecent) status = 'warning';
    else if (hasData && errorCount > 10) status = 'warning';
    else if (hasData && errorCount <= 10) status = 'ok';
    else status = 'unknown';
    results.push({ name, file, status, mode: detectMode(name), count, expected, hasExpected, ageHours, size, errorCount, hasData, isRecent, lastRun: lastRun ? lastRun.toISOString() : null });
  }
  const order = { error: 0, warning: 1, unknown: 2, ok: 3, inactive: 4 };
  results.sort((a, b) => (order[a.status] || 5) - (order[b.status] || 5));
  return results;
}

async function restartCollector(name) {
  const scriptPath = join(SCRIPTS_DIR, `collect-${name}.mjs`);
  if (!existsSync(scriptPath)) return { success: false, error: `Скрипт ${name} не найден` };
  try {
    const child = spawn('node', [scriptPath], { detached: true, stdio: 'ignore', cwd: PROJECT_ROOT });
    child.unref();
    return { success: true, message: `Сборщик ${name} запущен`, pid: child.pid };
  } catch (error) { return { success: false, error: error.message }; }
}

async function restartCollectorsByStatus(status) {
  const all = await getCollectorStatus();
  const targets = all.filter(s => s.status === status);
  const results = [];
  for (const t of targets) results.push({ name: t.name, ...(await restartCollector(t.name)) });
  return { total: targets.length, success: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
}

async function restartAllCollectors() {
  const all = await getCollectorStatus();
  const targets = all.filter(s => s.status !== 'inactive');
  const results = [];
  for (const t of targets) results.push({ name: t.name, ...(await restartCollector(t.name)) });
  return { total: targets.length, success: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
}

function readBody(req, maxBytes = 200_000) {
  return new Promise((resolve, reject) => {
    let buf = ''; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => { if (!buf) return resolve({}); try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('invalid_json_body: ' + e.message)); } });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

const ENDPOINTS = {
  '/':                  async () => ({ service: 'collector-monitor', endpoints: ['/status','/summary','/scan','/errors','/logs/:name','/cleanup/logs','/cleanup/history','/cleanup/auto','/settings','/settings/set','/restart','/restart/batch','/restart/status','/restart/all'] }),
  '/status':            async () => ({ status: await getCollectorStatus() }),
  '/summary':           async () => {
    const all = await getCollectorStatus();
    return { total: all.length, ok: all.filter(s=>s.status==='ok').length, warning: all.filter(s=>s.status==='warning').length, error: all.filter(s=>s.status==='error').length, unknown: all.filter(s=>s.status==='unknown').length, inactive: all.filter(s=>s.status==='inactive').length };
  },
  '/scan':              async () => {
    const files = await safeReaddir(SCRIPTS_DIR);
    const collectors = files.filter(f => f.startsWith('collect-') && f.endsWith('.mjs')).map(f => {
      const name = f.replace('collect-','').replace('.mjs','');
      return { name, mode: detectMode(name), file: f };
    });
    return { collectors, total: collectors.length };
  },
  '/errors':            async () => {
    const logFiles = (await safeReaddir(LOGS_DIR)).filter(f => f.startsWith('collect-') && f.endsWith('.log'));
    const report = { collectors: [] };
    for (const f of logFiles) {
      const name = f.replace('collect-','').replace('.log','');
      const parsed = parseLogErrorsSync(join(LOGS_DIR, f));
      if (parsed.errorCount > 0) report.collectors.push({ name, errorCount: parsed.errorCount, totalLines: parsed.total, lastError: parsed.lastError, errors: parsed.errors.slice(-10) });
    }
    report.collectors.sort((a, b) => b.errorCount - a.errorCount);
    return { ...report, totalCollectors: logFiles.length };
  },
};

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/collector-monitor/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'collector-monitor',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // Логи по имени: /logs/:name
    if (req.method === 'GET' && subPath.startsWith('/logs/')) {
      const name = subPath.slice('/logs/'.length).split('/')[0];
      const lines = parseInt(query.lines || '100', 10);
      const logPath = join(LOGS_DIR, `collect-${name}.log`);
      let log = '❌ Лог не найден', totalLines = 0;
      try {
        const content = await fs.readFile(logPath, 'utf8');
        const allLines = content.split('\n').filter(Boolean);
        totalLines = allLines.length;
        log = allLines.slice(-lines).join('\n');
      } catch {}
      return sendJSON(res, 200, { service: 'collector-monitor', endpoint: subPath, data: { name, log, totalLines } }, extra);
    }

    const ep = ENDPOINTS[subPath];
    if (ep && req.method === 'GET') {
      return sendJSON(res, 200, { service: 'collector-monitor', endpoint: subPath, data: await ep() }, extra);
    }

    if (req.method === 'POST') {
      let body = {};
      try { body = await readBody(req); } catch (e) { return sendJSON(res, 400, { error: 'invalid_body', message: e.message }, extra); }
      let result;
      if (subPath === '/cleanup/logs')         result = await clearAllLogs();
      else if (subPath === '/cleanup/history') result = await clearHistory();
      else if (subPath === '/cleanup/auto') {
        const settings = await loadSettings();
        const maxSizeMB = parseInt(query.maxMB || settings.maxLogSizeMB, 10);
        const sizeMB = Math.round((await getLogsSize()) / (1024*1024*10)) / 10;
        let out = { sizeMB, maxSizeMB, cleaned: false, deleted: [] };
        if (sizeMB > maxSizeMB) {
          out = { ...(await cleanupLogs(maxSizeMB)), sizeMB, maxSizeMB, cleaned: true };
          settings.lastCleanup = new Date().toISOString();
          await saveSettings(settings);
        }
        result = out;
      }
      else if (subPath === '/settings/set')    { const cur = await loadSettings(); const merged = { ...cur, ...body }; await saveSettings(merged); result = merged; }
      else if (subPath === '/restart') {
        if (!query.name) { const e = new Error('field_required: name'); e.statusCode = 400; throw e; }
        result = await restartCollector(query.name);
      }
      else if (subPath === '/restart/batch') {
        if (!Array.isArray(body.names) || body.names.length === 0) { const e = new Error('field_required: names[]'); e.statusCode = 400; throw e; }
        const results = [];
        for (const n of body.names) results.push({ name: n, ...(await restartCollector(n)) });
        result = { total: body.names.length, success: results.filter(r => r.success).length, failed: results.filter(r => !r.success).length, results };
      }
      else if (subPath === '/restart/status') { result = await restartCollectorsByStatus(query.status || 'warning'); }
      else if (subPath === '/restart/all')    { result = await restartAllCollectors(); }
      else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }
      return sendJSON(res, 200, { service: 'collector-monitor', endpoint: subPath, data: result }, extra);
    }

    // GET /settings
    if (req.method === 'GET' && subPath === '/settings') {
      return sendJSON(res, 200, { service: 'collector-monitor', endpoint: '/settings', data: await loadSettings() }, extra);
    }

    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
