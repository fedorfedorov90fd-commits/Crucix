/**
 * apis/sources/favorites-api.mjs — SERVICE-МОДУЛЬ: УНИВЕРСАЛЬНОЕ ИЗБРАННОЕ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * ИСТОЧНИК: data/favorites/{module}.json — отдельный persist-файл на каждый модуль.
 *
 * Единый сервис избранного для всех модулей Crucix (live, news, rss-manager,
 * trust, user, scheduler, storage). Реализует CQRS-разделение: read-модель
 * (модуль-потребитель — чистый Layer, только GET) и write-модель (этот сервис,
 * GET/POST/DELETE). Атомарная запись через savePersist (temp+rename+promise chain).
 *
 * ПОЧЕМУ SERVICE А НЕ LAYER:
 *   - Мультиметодный (GET + POST + DELETE).
 *   - Хранит состояние (избранное), пишет в файлы.
 *   - Не является слоем карты (нет координат, нет vizType).
 *   - Обслуживает несколько модулей-потребителей.
 *
 * ПУБЛИЧНЫЕ ЭНДПОИНТЫ:
 *   GET    /                          — корень (описание + список модулей)
 *   GET    /status                    — health-check
 *   GET    /list                      — всё избранное всех модулей (агрегат)
 *   GET    /list?module=live          — избранное конкретного модуля
 *   GET    /item/:module/:itemId      — один элемент избранного
 *   GET    /stats                     — статистика по всем модулям
 *   GET    /stats?module=live         — статистика по модулю
 *   GET    /modules                   — список модулей с избранным
 *   GET    /render?module=live        — рендер-конфиг для UI
 *   POST   /                          — добавить (body: {module, itemId, meta?})
 *   POST   /toggle                    — toggle (body: {module, itemId, meta?})
 *   POST   /bulk-toggle               — массовый toggle (body: {module, itemIds})
 *   DELETE /:module/:itemId           — удалить конкретное
 *   DELETE /:module                   — очистить весь модуль (body: {confirm: true})
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ХРАНЕНИЕ: data/favorites/{module}.json — атомарная запись.
 * ЛИМИТЫ: 10 000 элементов на модуль, 5 КБ meta на элемент, 200 КБ body.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadPersist, savePersist } from './lib/basket-loader.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const FAVORITES_DIR = join(PROJECT_ROOT, 'data', 'favorites');

export const route = '/api/services/favorites';
export const methods = ['GET', 'POST', 'DELETE'];

export const meta = {
  service: true,
  description: 'Универсальный сервис избранного: per-module хранение, toggle, массовые операции, статистика. Обслуживает live, news, rss-manager, trust, user, scheduler, storage.',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const MAX_BODY_BYTES = 200_000;
const MAX_ITEMS_PER_MODULE = 10_000;
const MAX_META_BYTES = 5_000;
const KNOWN_MODULES = ['live', 'news', 'rss-manager', 'trust', 'user', 'scheduler', 'storage'];

// ============================================================
//  ВАЛИДАЦИЯ ИМЁН
// ============================================================

/**
 * Санитизация имени модуля: только [a-z0-9-], длина 1..64.
 * Защита от path traversal и подобного.
 */
function sanitizeModule(name) {
  const s = String(name || '').trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(s)) return null;
  return s;
}

/**
 * Санитизация itemId: любые символы кроме пробелов и слешей, длина 1..200.
 */
function sanitizeItemId(id) {
  const s = String(id || '').trim();
  if (!s || s.length > 200) return null;
  if (/[\/\\\x00-\x1f]/.test(s)) return null;
  return s;
}

function moduleFile(module) {
  return join(FAVORITES_DIR, `${module}.json`);
}

// ============================================================
//  ЗАГРУЗКА / СОХРАНЕНИЕ
// ============================================================

/**
 * Структура per-module JSON:
 *   {
 *     module: 'live',
 *     ids: ['live-001', 'live-002'],
 *     meta: { 'live-001': { title, category, added_at } },
 *     created_at: ISO,
 *     updated_at: ISO,
 *     count: 2
 *   }
 */
async function loadModuleFavorites(module) {
  const result = await loadPersist({
    persistFile: moduleFile(module),
    defaults: { module, ids: [], meta: {}, created_at: null, updated_at: null, count: 0 },
  });

  let data = result.data || {};
  if (!Array.isArray(data.ids)) data.ids = [];
  if (!data.meta || typeof data.meta !== 'object') data.meta = {};
  data.module = module;
  data.count = data.ids.length;

  return { data, source: result.source };
}

async function saveModuleFavorites(module, data) {
  const payload = {
    module,
    ids: Array.isArray(data.ids) ? data.ids : [],
    meta: data.meta || {},
    created_at: data.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    count: Array.isArray(data.ids) ? data.ids.length : 0,
  };

  const result = await savePersist({
    persistFile: moduleFile(module),
    data: payload,
  });

  return { ok: result.ok, error: result.error, payload };
}

/**
 * Список модулей, у которых есть файл избранного в data/favorites/.
 */
async function listExistingModules() {
  let entries;
  try { entries = await fs.readdir(FAVORITES_DIR); }
  catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const modules = [];
  for (const f of entries) {
    if (!f.endsWith('.json')) continue;
    const name = f.replace(/\.json$/, '');
    const safe = sanitizeModule(name);
    if (safe) modules.push(safe);
  }
  return modules;
}

// ============================================================
//  ОПЕРАЦИИ
// ============================================================

async function addFavorite(module, itemId, itemMeta) {
  const { data } = await loadModuleFavorites(module);

  if (data.ids.includes(itemId)) {
    return { action: 'exists', data, changed: false };
  }
  if (data.ids.length >= MAX_ITEMS_PER_MODULE) {
    return { action: 'limit_reached', error: 'MAX_ITEMS_REACHED', limit: MAX_ITEMS_PER_MODULE };
  }

  data.ids.push(itemId);
  if (itemMeta && typeof itemMeta === 'object') {
    const metaStr = JSON.stringify(itemMeta);
    if (metaStr.length <= MAX_META_BYTES) {
      data.meta[itemId] = { ...itemMeta, added_at: new Date().toISOString() };
    }
  }

  const saveResult = await saveModuleFavorites(module, data);
  return { action: 'added', data: saveResult.payload, changed: saveResult.ok };
}

async function removeFavorite(module, itemId) {
  const { data } = await loadModuleFavorites(module);
  if (!data.ids.includes(itemId)) {
    return { action: 'not_found', changed: false, data };
  }
  data.ids = data.ids.filter(x => x !== itemId);
  delete data.meta[itemId];
  const saveResult = await saveModuleFavorites(module, data);
  return { action: 'removed', data: saveResult.payload, changed: saveResult.ok };
}

async function toggleFavorite(module, itemId, itemMeta) {
  const { data } = await loadModuleFavorites(module);
  if (data.ids.includes(itemId)) {
    return await removeFavorite(module, itemId);
  }
  return await addFavorite(module, itemId, itemMeta);
}

async function clearModule(module) {
  const { data } = await loadModuleFavorites(module);
  const removed = data.ids.length;
  const saveResult = await saveModuleFavorites(module, { ...data, ids: [], meta: {}, count: 0 });
  return { action: 'cleared', removed, data: saveResult.payload };
}

async function bulkToggle(module, itemIds) {
  const { data } = await loadModuleFavorites(module);
  const results = { added: 0, removed: 0, unchanged: 0 };

  for (const id of itemIds) {
    if (data.ids.includes(id)) {
      data.ids = data.ids.filter(x => x !== id);
      delete data.meta[id];
      results.removed++;
    } else {
      if (data.ids.length >= MAX_ITEMS_PER_MODULE) {
        results.unchanged++;
        continue;
      }
      data.ids.push(id);
      results.added++;
    }
  }

  const saveResult = await saveModuleFavorites(module, data);
  return { ...results, changed: saveResult.ok, total: data.ids.length };
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

async function computeAggregateStats() {
  const modules = await listExistingModules();
  const perModule = {};
  let totalItems = 0;

  for (const m of modules) {
    const { data, source } = await loadModuleFavorites(m);
    perModule[m] = {
      module: m,
      count: data.ids.length,
      has_meta: Object.keys(data.meta).length,
      source,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };
    totalItems += data.ids.length;
  }

  return {
    modules_count: modules.length,
    total_items: totalItems,
    modules: perModule,
  };
}

// ============================================================
//  ФОРМАТЫ
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

function toCSV(items, module) {
  const lines = ['module,itemId,title,category,added_at'];
  const esc = v => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const id of items) {
    lines.push([module, id, '', '', ''].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const urlObj = new URL(req.url, 'http://x');
  const sub = urlObj.pathname.replace(/^\/api\/services\/favorites/, '') || '/';
  const query = Object.fromEntries(urlObj.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  // CORS + OPTIONS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const extra = {
    'X-Service': 'favorites',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    // ============================================================
    //  GET /status, /, /modules, /list, /item/:module/:itemId, /stats, /render
    // ============================================================
    if (req.method === 'GET') {
      if (sub === '/' || sub === '') {
        const stats = await computeAggregateStats();
        return sendJSON(res, 200, {
          service: 'favorites',
          version: meta.version,
          description: meta.description,
          known_modules: KNOWN_MODULES,
          active_modules: Object.keys(stats.modules),
          endpoints: {
            'GET /': 'описание',
            'GET /status': 'health-check',
            'GET /list': 'всё избранное (?module= для фильтра)',
            'GET /item/:module/:itemId': 'один элемент с meta',
            'GET /stats': 'статистика (?module= для модуля)',
            'GET /modules': 'список модулей с избранным',
            'GET /render': 'рендер-конфиг (?module=)',
            'POST /': 'добавить {module, itemId, meta?}',
            'POST /toggle': 'toggle {module, itemId, meta?}',
            'POST /bulk-toggle': 'массовый toggle {module, itemIds}',
            'DELETE /:module/:itemId': 'удалить конкретное',
            'DELETE /:module': 'очистить модуль {confirm: true}',
          },
        }, extra);
      }

      if (sub === '/status') {
        const stats = await computeAggregateStats();
        return sendJSON(res, 200, {
          service: 'favorites',
          status: 'online',
          modules_count: stats.modules_count,
          total_items: stats.total_items,
          favorites_dir: FAVORITES_DIR,
          timestamp: new Date().toISOString(),
        }, extra);
      }

      if (sub === '/modules') {
        const stats = await computeAggregateStats();
        const list = Object.values(stats.modules).sort((a, b) => b.count - a.count);
        return sendJSON(res, 200, {
          success: true,
          modules: list,
          total: list.length,
          known_not_used: KNOWN_MODULES.filter(m => !stats.modules[m]),
        }, extra);
      }

      if (sub === '/list') {
        const moduleFilter = query.module ? sanitizeModule(query.module) : null;

        if (moduleFilter) {
          const { data, source } = await loadModuleFavorites(moduleFilter);
          const items = data.ids.map(id => ({
            module: moduleFilter,
            itemId: id,
            meta: data.meta[id] || null,
          }));

          if (format === 'csv') return sendText(res, 200, toCSV(data.ids, moduleFilter), 'text/csv; charset=utf-8');
          if (format === 'raw') return sendJSON(res, 200, { data, source }, extra);

          return sendJSON(res, 200, {
            success: true,
            module: moduleFilter,
            count: items.length,
            items,
            ids: data.ids,
            meta: data.meta,
            source,
          }, extra);
        }

        // Все модули
        const modules = await listExistingModules();
        const all = {};
        let totalItems = 0;
        for (const m of modules) {
          const { data } = await loadModuleFavorites(m);
          all[m] = { ids: data.ids, meta: data.meta, count: data.ids.length };
          totalItems += data.ids.length;
        }
        return sendJSON(res, 200, {
          success: true,
          total_items: totalItems,
          modules: all,
        }, extra);
      }

      if (sub.startsWith('/item/')) {
        const rest = sub.slice('/item/'.length);
        const slash = rest.indexOf('/');
        if (slash < 0) return sendJSON(res, 400, { success: false, error: 'invalid_path', expected: '/item/:module/:itemId' }, extra);
        const rawModule = decodeURIComponent(rest.slice(0, slash));
        const rawItemId = decodeURIComponent(rest.slice(slash + 1));
        const module = sanitizeModule(rawModule);
        const itemId = sanitizeItemId(rawItemId);
        if (!module) return sendJSON(res, 400, { success: false, error: 'invalid_module', module: rawModule }, extra);
        if (!itemId) return sendJSON(res, 400, { success: false, error: 'invalid_item_id' }, extra);

        const { data } = await loadModuleFavorites(module);
        if (!data.ids.includes(itemId)) {
          return sendJSON(res, 404, { success: false, error: 'not_found', module, itemId }, extra);
        }
        return sendJSON(res, 200, {
          success: true,
          module,
          itemId,
          meta: data.meta[itemId] || null,
        }, extra);
      }

      if (sub === '/stats' || format === 'stats') {
        const moduleFilter = query.module ? sanitizeModule(query.module) : null;
        if (moduleFilter) {
          const { data, source } = await loadModuleFavorites(moduleFilter);
          return sendJSON(res, 200, {
            success: true,
            module: moduleFilter,
            count: data.ids.length,
            has_meta: Object.keys(data.meta).length,
            source,
            created_at: data.created_at,
            updated_at: data.updated_at,
          }, extra);
        }
        const stats = await computeAggregateStats();
        return sendJSON(res, 200, { success: true, stats }, extra);
      }

      if (sub === '/render') {
        const moduleFilter = query.module ? sanitizeModule(query.module) : null;
        if (moduleFilter) {
          const { data } = await loadModuleFavorites(moduleFilter);
          const items = data.ids.map(id => ({ module: moduleFilter, itemId: id, meta: data.meta[id] || null }));
          return sendJSON(res, 200, {
            render: { type: 'list', module: moduleFilter, count: items.length, items },
          }, extra);
        }
        const stats = await computeAggregateStats();
        return sendJSON(res, 200, {
          render: { type: 'dashboard', stats, modules: Object.values(stats.modules) },
        }, extra);
      }

      return sendJSON(res, 404, {
        success: false,
        error: 'endpoint_not_found',
        path: sub,
        available: ['/', '/status', '/list', '/item/:module/:itemId', '/stats', '/modules', '/render'],
      }, extra);
    }

    // ============================================================
    //  POST — add, toggle, bulk-toggle
    // ============================================================
    if (req.method === 'POST') {
      let body;
      try { body = await readBody(req); }
      catch (e) { return sendJSON(res, 400, { success: false, error: 'invalid_body', message: e.message }, extra); }

      if (sub === '/' || sub === '') {
        // add
        const module = sanitizeModule(body.module);
        const itemId = sanitizeItemId(body.itemId);
        if (!module) return sendJSON(res, 400, { success: false, error: 'invalid_module', got: body.module }, extra);
        if (!itemId) return sendJSON(res, 400, { success: false, error: 'invalid_item_id' }, extra);

        const result = await addFavorite(module, itemId, body.meta);
        if (result.error === 'MAX_ITEMS_REACHED') {
          return sendJSON(res, 409, { success: false, error: 'limit_reached', limit: result.limit, module }, extra);
        }
        return sendJSON(res, 200, {
          success: true,
          action: result.action,
          module,
          itemId,
          total: result.data?.ids?.length || 0,
        }, extra);
      }

      if (sub === '/toggle') {
        const module = sanitizeModule(body.module);
        const itemId = sanitizeItemId(body.itemId);
        if (!module) return sendJSON(res, 400, { success: false, error: 'invalid_module', got: body.module }, extra);
        if (!itemId) return sendJSON(res, 400, { success: false, error: 'invalid_item_id' }, extra);

        const result = await toggleFavorite(module, itemId, body.meta);
        return sendJSON(res, 200, {
          success: true,
          action: result.action,
          module,
          itemId,
          total: result.data?.ids?.length || 0,
        }, extra);
      }

      if (sub === '/bulk-toggle') {
        const module = sanitizeModule(body.module);
        if (!module) return sendJSON(res, 400, { success: false, error: 'invalid_module', got: body.module }, extra);
        const itemIds = Array.isArray(body.itemIds) ? body.itemIds.map(sanitizeItemId).filter(Boolean) : [];
        if (itemIds.length === 0) return sendJSON(res, 400, { success: false, error: 'field_required: itemIds[]' }, extra);
        if (itemIds.length > 500) return sendJSON(res, 400, { success: false, error: 'too_many_items', max: 500, got: itemIds.length }, extra);

        const result = await bulkToggle(module, itemIds);
        return sendJSON(res, 200, {
          success: true,
          module,
          processed: itemIds.length,
          ...result,
        }, extra);
      }

      return sendJSON(res, 404, { success: false, error: 'post_endpoint_not_found', path: sub, available: ['/', '/toggle', '/bulk-toggle'] }, extra);
    }

    // ============================================================
    //  DELETE — :module/:itemId или :module (с confirm)
    // ============================================================
    if (req.method === 'DELETE') {
      const parts = sub.replace(/^\/+/, '').split('/').filter(Boolean);
      if (parts.length === 0) return sendJSON(res, 400, { success: false, error: 'invalid_delete_path' }, extra);

      const module = sanitizeModule(parts[0]);
      if (!module) return sendJSON(res, 400, { success: false, error: 'invalid_module', got: parts[0] }, extra);

      if (parts.length === 1) {
        // Очистить весь модуль — требует confirm: true в body
        let body;
        try { body = await readBody(req); }
        catch (e) { body = {}; }
        if (body.confirm !== true) {
          return sendJSON(res, 400, {
            success: false,
            error: 'confirmation_required',
            hint: `send DELETE /api/services/favorites/${module} with body {"confirm": true}`,
            will_remove: (await loadModuleFavorites(module)).data.ids.length,
          }, extra);
        }
        const result = await clearModule(module);
        return sendJSON(res, 200, { success: true, action: 'cleared', module, removed: result.removed }, extra);
      }

      if (parts.length === 2) {
        const itemId = sanitizeItemId(decodeURIComponent(parts[1]));
        if (!itemId) return sendJSON(res, 400, { success: false, error: 'invalid_item_id' }, extra);
        const result = await removeFavorite(module, itemId);
        if (result.action === 'not_found') {
          return sendJSON(res, 404, { success: false, error: 'not_found', module, itemId }, extra);
        }
        return sendJSON(res, 200, {
          success: true,
          action: 'removed',
          module,
          itemId,
          total: result.data?.ids?.length || 0,
        }, extra);
      }

      return sendJSON(res, 400, { success: false, error: 'invalid_delete_path', expected: '/:module или /:module/:itemId' }, extra);
    }

    // Метод не разрешён (сюда не дойдёт, роутер отдаст 405 раньше)
    return sendJSON(res, 405, { success: false, error: 'method_not_allowed', allowed: methods }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    try {
      sendJSON(res, status, {
        success: false,
        error: status === 400 ? (e.message || 'bad_request') : 'handler_error',
        message: e.message,
      }, extra);
    } catch {}
  }
}
