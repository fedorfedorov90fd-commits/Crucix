/**
 * apis/sources/storage-api.mjs — SERVICE-МОДУЛЬ: УПРАВЛЕНИЕ ХРАНИЛИЩЕМ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК:
 *   - data/raw/ — папка с сырыми данными (JSON-файлы).
 *   - data/storage/config.json — persist-файл настроек (дни хранения).
 *
 * Управление хранилищем сырых данных: конфигурация срока хранения,
 * статистика по файлам и объёму, dry-run превью очистки, безопасная
 * очистка с подтверждением.
 *
 * ПОЧЕМУ SERVICE:
 *   - Мультиметодный (GET + POST + DELETE).
 *   - Хранит состояние (config.json) и удаляет файлы.
 *   - Не слой карты.
 *
 * БЕЗОПАСНОСТЬ:
 *   - Удаление ТОЛЬКО с confirm: true в теле запроса.
 *   - Dry-run preview-clean показывает, что будет удалено, БЕЗ удаления.
 *   - Удаляются только .json файлы в data/raw/.
 *   - Защита от path traversal в /files/:name.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET    /                 — корень
 *   GET    /status           — health-check
 *   GET    /config           — текущий конфиг
 *   GET    /files            — список файлов в data/raw/ (?filter=)
 *   GET    /files/:name      — конкретный файл
 *   GET    /stats            — статистика (кол-во, размер, старые/новые)
 *   GET    /old?days=N       — файлы старше N дней (preview без удаления)
 *   GET    /render           — рендер-конфиг
 *   POST   /config           — обновить {days: N}
 *   POST   /preview-clean    — dry-run: {days} → что будет удалено
 *   POST   /clean            — очистка {days, confirm: true}
 *   DELETE /files/:name      — удалить файл {confirm: true}
 *   DELETE /files            — очистить всё {confirm: true}
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const RAW_DIR = join(PROJECT_ROOT, 'data', 'raw');
const STORAGE_DIR = join(PROJECT_ROOT, 'data', 'storage');
const CONFIG_FILE = join(STORAGE_DIR, 'config.json');

export const route = '/api/services/storage';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Управление хранилищем сырых данных: конфиг срока хранения, статистика, dry-run preview, безопасная очистка',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 100_000;
const DEFAULT_CONFIG = { days: 7 };
const MIN_DAYS = 1;
const MAX_DAYS = 730;
const MAX_PREVIEW_ITEMS = 200;

// ============================================================
//  УТИЛИТЫ
// ============================================================

function formatBytes(n) {
  if (!Number.isFinite(n) || n < 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(2)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function isSafeFilename(name) {
  if (!name || typeof name !== 'string') return false;
  // Только basename, никаких слешей и ..
  if (name !== basename(name)) return false;
  if (name.includes('..')) return false;
  if (name.startsWith('.')) return false;
  if (!name.endsWith('.json')) return false;
  // Только безопасные символы
  if (!/^[a-zA-Z0-9._-]+$/.test(name)) return false;
  return true;
}

function readBody(req, maxBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', c => {
      total += c.length;
      if (total > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text, 'utf8')) });
  res.end(text);
}

// ============================================================
//  КОНФИГ
// ============================================================

async function ensureDirs() {
  try { await fs.mkdir(RAW_DIR, { recursive: true }); } catch {}
  try { await fs.mkdir(STORAGE_DIR, { recursive: true }); } catch {}
}

async function loadConfig() {
  const result = await loadPersist({
    persistFile: CONFIG_FILE,
    defaults: DEFAULT_CONFIG,
  });
  const data = result.data || {};
  const days = Number(data.days);
  const safeDays = Number.isFinite(days) && days >= MIN_DAYS && days <= MAX_DAYS ? Math.floor(days) : DEFAULT_CONFIG.days;
  return { config: { days: safeDays }, source: result.source };
}

async function saveConfig(config) {
  return savePersist({
    persistFile: CONFIG_FILE,
    data: { days: config.days, updated_at: new Date().toISOString() },
  });
}

// ============================================================
//  ФАЙЛЫ data/raw/
// ============================================================

async function listRawFiles(filter = null) {
  await ensureDirs();
  let entries;
  try { entries = await fs.readdir(RAW_DIR, { withFileTypes: true }); }
  catch { return []; }

  const files = [];
  for (const e of entries) {
    if (!e.isFile()) continue;
    if (!e.name.endsWith('.json')) continue;
    if (e.name.startsWith('.')) continue;
    if (e.name.endsWith('.tmp') || e.name.endsWith('.bak')) continue;
    if (filter && !e.name.includes(filter)) continue;
    try {
      const st = await fs.stat(join(RAW_DIR, e.name));
      files.push({
        name: e.name,
        size: st.size,
        sizeFormatted: formatBytes(st.size),
        mtime: st.mtime.toISOString(),
        mtime_ms: st.mtime.getTime(),
        age_days: Math.floor((Date.now() - st.mtime.getTime()) / 86400000),
      });
    } catch {}
  }
  files.sort((a, b) => b.mtime_ms - a.mtime_ms);
  return files;
}

async function getFileInfo(name) {
  const safe = basename(name);
  if (!isSafeFilename(safe)) return null;
  try {
    const st = await fs.stat(join(RAW_DIR, safe));
    if (!st.isFile()) return null;
    return {
      name: safe,
      size: st.size,
      sizeFormatted: formatBytes(st.size),
      mtime: st.mtime.toISOString(),
      mtime_ms: st.mtime.getTime(),
      age_days: Math.floor((Date.now() - st.mtime.getTime()) / 86400000),
    };
  } catch { return null; }
}

async function computeStats(files) {
  const totalSize = files.reduce((s, f) => s + f.size, 0);
  const sizes = files.map(f => f.size);
  const ages = files.map(f => f.age_days);
  const dateMin = files.length > 0 ? files[files.length - 1].mtime : null;
  const dateMax = files.length > 0 ? files[0].mtime : null;

  return {
    total_files: files.length,
    total_size: totalSize,
    total_size_formatted: formatBytes(totalSize),
    size_min: sizes.length ? Math.min(...sizes) : 0,
    size_max: sizes.length ? Math.max(...sizes) : 0,
    size_mean: sizes.length ? Math.round(totalSize / sizes.length) : 0,
    age_min_days: ages.length ? Math.min(...ages) : null,
    age_max_days: ages.length ? Math.max(...ages) : null,
    oldest_mtime: dateMin,
    newest_mtime: dateMax,
  };
}

// ============================================================
//  ПРЕДПРОСМОТР ОЧИСТКИ (DRY-RUN)
// ============================================================

async function previewClean(days) {
  const files = await listRawFiles();
  const cutoff = Date.now() - (days * 86400000);
  const toDelete = files.filter(f => f.mtime_ms < cutoff);
  const kept = files.filter(f => f.mtime_ms >= cutoff);
  const deleteSize = toDelete.reduce((s, f) => s + f.size, 0);
  const keepSize = kept.reduce((s, f) => s + f.size, 0);

  return {
    days,
    cutoff: new Date(cutoff).toISOString(),
    will_delete: {
      count: toDelete.length,
      size: deleteSize,
      size_formatted: formatBytes(deleteSize),
      files: toDelete.slice(0, MAX_PREVIEW_ITEMS).map(f => ({ name: f.name, size: f.size, age_days: f.age_days, mtime: f.mtime })),
      truncated: toDelete.length > MAX_PREVIEW_ITEMS,
    },
    will_keep: {
      count: kept.length,
      size: keepSize,
      size_formatted: formatBytes(keepSize),
    },
    total_files: files.length,
  };
}

async function executeClean(days) {
  const files = await listRawFiles();
  const cutoff = Date.now() - (days * 86400000);
  const toDelete = files.filter(f => f.mtime_ms < cutoff);

  let deleted = 0;
  let deletedSize = 0;
  const errors = [];

  for (const f of toDelete) {
    try {
      await fs.unlink(join(RAW_DIR, f.name));
      deleted++;
      deletedSize += f.size;
    } catch (e) {
      errors.push({ name: f.name, error: e.message });
    }
  }

  return {
    days,
    deleted,
    deleted_size: deletedSize,
    deleted_size_formatted: formatBytes(deletedSize),
    errors: errors.slice(0, 20),
    errors_count: errors.length,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(files) {
  const lines = ['name,size,sizeFormatted,mtime,age_days'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const f of files) lines.push([f.name, f.size, f.sizeFormatted, f.mtime, f.age_days].map(esc).join(','));
  return lines.join('\n') + '\n';
}

function toSeries(files) {
  return files.map(f => ({
    name: f.name,
    size: f.size,
    age_days: f.age_days,
    mtime: f.mtime,
  }));
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const extra = {
    'X-Service': 'storage',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/services\/storage/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end();
      return;
    }

    // Загрузка конфига
    let configLoaded;
    try { configLoaded = await loadConfig(); }
    catch (e) { return sendJSON(res, 500, { success: false, error: 'config_load_error', message: e.message }, extra); }
    const { config, source: configSource } = configLoaded;

    // ============================================================
    //  GET
    // ============================================================
    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        let files = [];
        try { files = await listRawFiles(); }
        catch (e) { /* пустая папка */ }
        return sendJSON(res, 200, {
          service: 'storage',
          version: meta.version,
          description: meta.description,
          config,
          raw_dir: RAW_DIR,
          files_count: files.length,
          stats: await computeStats(files),
          endpoints: {
            'GET /status': 'health-check',
            'GET /config': 'текущий конфиг',
            'GET /files': 'список файлов (?filter=)',
            'GET /files/:name': 'конкретный файл',
            'GET /stats': 'статистика',
            'GET /old?days=N': 'файлы старше N дней',
            'GET /render': 'рендер-конфиг',
            'POST /config': 'обновить {days}',
            'POST /preview-clean': 'dry-run {days}',
            'POST /clean': 'очистка {days, confirm:true}',
            'DELETE /files/:name': 'удалить {confirm:true}',
            'DELETE /files': 'очистить всё {confirm:true}',
          },
        }, extra);
      }

      if (sub === '/status') {
        let files = [];
        try { files = await listRawFiles(); } catch {}
        return sendJSON(res, 200, {
          success: true,
          service: 'storage',
          status: 'online',
          raw_dir_exists: await fileExists(RAW_DIR),
          config_source: configSource,
          config,
          files_count: files.length,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/config') {
        let files = [];
        try { files = await listRawFiles(); } catch {}
        const totalSize = files.reduce((s, f) => s + f.size, 0);
        return sendJSON(res, 200, {
          success: true,
          config,
          files: files.length,
          size: totalSize,
          sizeHuman: formatBytes(totalSize),
        }, extra);
      }

      if (sub === '/files') {
        const filter = query.filter || null;
        const files = await listRawFiles(filter);
        if (format === 'csv') return sendText(res, 200, toCSV(files), 'text/csv; charset=utf-8');
        if (format === 'series') return sendJSON(res, 200, { series: toSeries(files), count: files.length }, extra);
        if (format === 'raw') return sendJSON(res, 200, { data: files, total: files.length }, extra);
        return sendJSON(res, 200, { success: true, files, count: files.length, filter }, extra);
      }

      if (sub.startsWith('/files/')) {
        const name = decodeURIComponent(sub.slice('/files/'.length));
        const info = await getFileInfo(name);
        if (!info) return sendJSON(res, 404, { success: false, error: 'file_not_found', name }, extra);
        return sendJSON(res, 200, { success: true, file: info }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        const files = await listRawFiles();
        return sendJSON(res, 200, {
          success: true,
          stats: await computeStats(files),
          config,
        }, extra);
      }

      if (sub === '/old') {
        const days = parseInt(query.days, 10) || config.days;
        const files = await listRawFiles();
        const cutoff = Date.now() - (days * 86400000);
        const old = files.filter(f => f.mtime_ms < cutoff);
        const size = old.reduce((s, f) => s + f.size, 0);
        return sendJSON(res, 200, {
          success: true,
          days,
          cutoff: new Date(cutoff).toISOString(),
          count: old.length,
          size,
          size_formatted: formatBytes(size),
          files: old.slice(0, MAX_PREVIEW_ITEMS),
        }, extra);
      }

      if (sub === '/render') {
        const files = await listRawFiles();
        const stats = await computeStats(files);
        return sendJSON(res, 200, {
          render: {
            type: 'table',
            columns: ['name', 'sizeFormatted', 'age_days', 'mtime'],
            files: files.slice(0, 200),
            stats,
            config,
          },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/config', '/files', '/files/:name', '/stats', '/old', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/config') {
        const days = parseInt(body.days, 10);
        if (!Number.isFinite(days) || days < MIN_DAYS || days > MAX_DAYS) {
          return sendJSON(res, 400, {
            success: false,
            error: 'invalid_days',
            message: `days должно быть от ${MIN_DAYS} до ${MAX_DAYS}`,
            got: body.days,
          }, extra);
        }
        const saved = await saveConfig({ days });
        if (!saved.ok) return sendJSON(res, 500, { success: false, error: 'save_failed', detail: saved.error }, extra);
        return sendJSON(res, 200, { success: true, config: { days } }, extra);
      }

      if (sub === '/preview-clean') {
        const days = parseInt(body.days, 10) || config.days;
        if (days < MIN_DAYS || days > MAX_DAYS) {
          return sendJSON(res, 400, { success: false, error: 'invalid_days', got: days }, extra);
        }
        const preview = await previewClean(days);
        return sendJSON(res, 200, { success: true, dry_run: true, ...preview }, extra);
      }

      if (sub === '/clean') {
        if (body.confirm !== true) {
          const preview = await previewClean(parseInt(body.days, 10) || config.days);
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send POST /api/services/storage/clean with body {"days": N, "confirm": true}',
            preview,
          }, extra);
        }
        const days = parseInt(body.days, 10) || config.days;
        if (days < MIN_DAYS || days > MAX_DAYS) {
          return sendJSON(res, 400, { success: false, error: 'invalid_days', got: days }, extra);
        }
        const result = await executeClean(days);
        return sendJSON(res, 200, { success: true, ...result }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'post_endpoint_not_found',
        path: sub,
        available: ['/config', '/preview-clean', '/clean'],
      }, extra);
    }

    // ============================================================
    //  DELETE
    // ============================================================
    if (req.method === 'DELETE') {
      let body;
      try { body = await readBody(req); } catch { body = {}; }

      if (sub === '/files') {
        if (body.confirm !== true) {
          const files = await listRawFiles();
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/storage/files with body {"confirm": true}',
            will_remove: files.length,
          }, extra);
        }
        const files = await listRawFiles();
        let deleted = 0, deletedSize = 0;
        const errors = [];
        for (const f of files) {
          try {
            await fs.unlink(join(RAW_DIR, f.name));
            deleted++;
            deletedSize += f.size;
          } catch (e) {
            errors.push({ name: f.name, error: e.message });
          }
        }
        return sendJSON(res, 200, {
          success: true,
          deleted,
          deleted_size: deletedSize,
          deleted_size_formatted: formatBytes(deletedSize),
          errors: errors.slice(0, 20),
          errors_count: errors.length,
        }, extra);
      }

      if (sub.startsWith('/files/')) {
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: 'send DELETE /api/services/storage/files/:name with body {"confirm": true}',
          }, extra);
        }
        const name = decodeURIComponent(sub.slice('/files/'.length));
        const info = await getFileInfo(name);
        if (!info) return sendJSON(res, 404, { success: false, error: 'file_not_found', name }, extra);
        try {
          await fs.unlink(join(RAW_DIR, info.name));
          return sendJSON(res, 200, { success: true, deleted: info.name, size: info.size, size_formatted: info.sizeFormatted }, extra);
        } catch (e) {
          return sendJSON(res, 500, { success: false, error: 'delete_failed', message: e.message }, extra);
        }
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'delete_endpoint_not_found',
        path: sub,
        available: ['/files', '/files/:name'],
      }, extra);
    }

    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { success: false, error: status === 400 ? 'bad_request' : 'handler_error', message: e.message };
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}
