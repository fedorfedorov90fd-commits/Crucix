/**
 * apis/actions/action-api.mjs — SERVICE-МОДУЛЬ: СЛОЙ ДЕЙСТВИЙ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE, мультиметодный).
 * РЕЕСТР: apis/actions/_registry.mjs (ActionsRegistry).
 * РЕАЛИЗАЦИИ: action-alert.mjs, action-report.mjs, action-watchlist.mjs.
 *
 * Слой действий превращает дашборд в операционную систему:
 * не только показывает, но и действует (алерты, отчёты, watchlist).
 *
 * ЭНДПОИНТЫ:
 *   GET    /                — корень: список действий + статистика
 *   GET    /list            — список всех действий (фильтр по категории)
 *   GET    /stats           — статистика реестра
 *   GET    /categories      — категории действий
 *   GET    /actions/:id     — определение действия
 *   POST   /execute/:id     — выполнить действие (body: args)
 *   POST   /execute         — выполнить (body: { actionId, args })
 *   POST   /watchlist/add   — добавить в watchlist
 *   POST   /watchlist/remove— удалить из watchlist
 *   GET    /watchlist       — список watchlist (фильтры: ?priority=&tag=&limit=)
 *   GET    /watchlist/stats — статистика watchlist
 *   POST   /report          — сгенерировать отчёт (body: { title, format, categories })
 *   POST   /alert           — отправить алерт (body: { title, message, severity, channels })
 *
 * ФОРМАТ ОТВЕТА: JSON.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getActionsRegistry, ACTION_CATEGORIES } from './_registry.mjs';
import { registerAlertAction } from './action-alert.mjs';
import { registerReportAction } from './action-report.mjs';
import { registerWatchlistActions, listItems as watchlistList, stats as watchlistStats } from './action-watchlist.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

export const route  = '/api/services/actions';
export const method = 'GET';
export const methods = ['GET', 'POST'];

export const meta = {
  service: true,
  description: 'Слой действий: alert, report, watchlist (notification/document/state)',
  cache: 0,
  version: '1.0.0',
};

// ============================================================
//  ИНИЦИАЛИЗАЦИЯ РЕЕСТРА
// ============================================================

let _initialized = false;

function initRegistry() {
  if (_initialized) return getActionsRegistry();
  const reg = getActionsRegistry();
  registerAlertAction(reg);
  registerReportAction(reg);
  registerWatchlistActions(reg);
  _initialized = true;
  return reg;
}

// ============================================================
//  УТИЛИТЫ ОТВЕТА
// ============================================================

function sendJson(res, payload, status = 200) {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(body);
}

function sendError(res, err, status = 500) {
  sendJson(res, { error: err.message || String(err) }, status);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    const LIMIT = 100 * 1024; // 100 KB
    req.on('data', chunk => {
      size += chunk.length;
      if (size > LIMIT) { reject(new Error('body_too_large')); return; }
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); }
      catch (e) { reject(new Error('invalid_json')); }
    });
    req.on('error', reject);
  });
}

// ============================================================
//  ГЛАВНЫЙ ОБРАБОТЧИК
// ============================================================

export async function handler(req, res) {
  const reg = initRegistry();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname.replace(/\/+$/, '');
  const method = (req.method || 'GET').toUpperCase();

  // --- GET / ---
  if (pathname === route || pathname === route + '') {
    return sendJson(res, {
      service: 'actions',
      version: '1.0.0',
      endpoints: [
        'GET    ' + route + '/list',
        'GET    ' + route + '/stats',
        'GET    ' + route + '/categories',
        'GET    ' + route + '/actions/:id',
        'POST   ' + route + '/execute/:id',
        'POST   ' + route + '/execute',
        'POST   ' + route + '/watchlist/add',
        'POST   ' + route + '/watchlist/remove',
        'GET    ' + route + '/watchlist',
        'GET    ' + route + '/watchlist/stats',
        'POST   ' + route + '/report',
        'POST   ' + route + '/alert',
      ],
      stats: reg.stats(),
      categories: Object.values(ACTION_CATEGORIES),
    });
  }

  // --- GET /list ---
  if (pathname === route + '/list' && method === 'GET') {
    const category = url.searchParams.get('category') || null;
    return sendJson(res, { actions: reg.list(category), total: reg.list(category).length });
  }

  // --- GET /stats ---
  if (pathname === route + '/stats' && method === 'GET') {
    return sendJson(res, reg.stats());
  }

  // --- GET /categories ---
  if (pathname === route + '/categories' && method === 'GET') {
    return sendJson(res, { categories: Object.values(ACTION_CATEGORIES) });
  }

  // --- GET /actions/:id ---
  const actionMatch = pathname.match(/\/actions\/([a-z_][a-z0-9_]*)$/i);
  if (actionMatch && method === 'GET') {
    const id = actionMatch[1];
    const def = reg.get(id);
    if (!def) return sendError(res, new Error('action_not_found'), 404);
    return sendJson(res, {
      id: def.id,
      category: def.category,
      description: def.description,
      argsSchema: def.argsSchema,
      requiredArgs: def.requiredArgs,
      cache: def.cache,
      idempotent: def.idempotent,
    });
  }

  // --- POST /execute/:id ---
  const execMatch = pathname.match(/\/execute\/([a-z_][a-z0-9_]*)$/i);
  if (execMatch && method === 'POST') {
    const id = execMatch[1];
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendError(res, e, 400); }
    const result = await reg.execute(id, body || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- POST /execute ---
  if (pathname === route + '/execute' && method === 'POST') {
    let body;
    try { body = await readBody(req); }
    catch (e) { return sendError(res, e, 400); }
    if (!body || !body.actionId) return sendError(res, new Error('actionId required'), 400);
    const result = await reg.execute(body.actionId, body.args || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- POST /watchlist/add ---
  if (pathname === route + '/watchlist/add' && method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendError(res, e, 400); }
    const result = await reg.execute('watchlist_add', body || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- POST /watchlist/remove ---
  if (pathname === route + '/watchlist/remove' && method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendError(res, e, 400); }
    const result = await reg.execute('watchlist_remove', body || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- GET /watchlist ---
  if (pathname === route + '/watchlist' && method === 'GET') {
    const priority = url.searchParams.get('priority') || undefined;
    const tag = url.searchParams.get('tag') || undefined;
    const limitRaw = url.searchParams.get('limit');
    const limit = limitRaw ? Math.max(1, Math.min(parseInt(limitRaw, 10) || 50, 1000)) : undefined;
    const items = await watchlistList({ priority, tag, limit });
    return sendJson(res, { items, total: items.length });
  }

  // --- GET /watchlist/stats ---
  if (pathname === route + '/watchlist/stats' && method === 'GET') {
    return sendJson(res, await watchlistStats());
  }

  // --- POST /report ---
  if (pathname === route + '/report' && method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendError(res, e, 400); }
    const result = await reg.execute('generate_report', body || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- POST /alert ---
  if (pathname === route + '/alert' && method === 'POST') {
    let body;
    try { body = await readBody(req); } catch (e) { return sendError(res, e, 400); }
    const result = await reg.execute('send_alert', body || {}, { req: true });
    return sendJson(res, result, result.ok ? 200 : 400);
  }

  // --- 404 ---
  return sendJson(res, {
    error: 'endpoint_not_found',
    route,
    available: [
      route,
      route + '/list',
      route + '/stats',
      route + '/categories',
      route + '/actions/:id',
      route + '/execute/:id',
      route + '/execute',
      route + '/watchlist',
      route + '/watchlist/add',
      route + '/watchlist/remove',
      route + '/watchlist/stats',
      route + '/report',
      route + '/alert',
    ],
  }, 404);
}
