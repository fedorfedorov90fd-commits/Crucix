/**
 * apis/sources/preset-api.mjs — SERVICE-МОДУЛЬ: ПРЕСЕТЫ КАРТ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE). Мультиметодный CRUD.
 * ИСТОЧНИК: data/persist/presets/presets.json — массив [{ id, name, description, icon, theme{...}, layers[], modules[], panels[], camera{...}, render{...}, metadata{created,modified,version,isBuiltin} }].
 * ДВИЖОК: core/preset-engine.mjs (PresetEngine, Preset, THEMES, PRESET_IDS, buildDefaultPresets).
 *
 * ЭНДПОИНТЫ (внутренние, маппятся от route):
 *   GET    /                — корень: список эндпоинтов + все пресеты (кратко)
 *   GET    /list            — краткий список всех пресетов
 *   GET    /stats           — статистика движка
 *   GET    /get/:id         — полный пресет
 *   GET    /:id/render      — render-конфиг пресета
 *   POST   /:id/apply       — применить пресет к карте (body: { mapId })
 *   POST   /save-as         — сохранить состояние как новый пресет (body: { name, layers, modules, panels, theme, camera, render })
 *   POST   /:id/clear-map   — очистить карту от пресета (body: { mapId })
 *   POST   /:id/rename      — переименовать (body: { name })
 *   POST   /:id/clone       — клонировать (body: { name })
 *   POST   /:id/reset       — сброс к дефолту (только для builtin)
 *   DELETE /:id             — удалить пользовательский пресет
 *
 * ФОРМАТ ОТВЕТА: JSON (CRUD — не таблица, CSV не имеет смысла).
 */

import { PresetEngine, THEMES, PRESET_IDS } from '../../core/preset-engine.mjs';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const PERSIST_DIR = join(PROJECT_ROOT, 'data', 'persist', 'presets');

// ============================================================
//  КОНТРАКТ
// ============================================================

export const route  = '/api/services/preset';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Preset CRUD service: list/get/apply/save-as/rename/clone/reset/delete. Manages map demonstration presets (builtin + user-defined).',
  cache: 0,
  version: '2.0.0',
};

// ============================================================
//  ДВИЖОК (ленивая инициализация)
// ============================================================

let _engine = null;
function getEngine() {
  if (!_engine) _engine = new PresetEngine(PERSIST_DIR);
  return _engine;
}

// ============================================================
//  ОБРАБОТКА ТЕЛА ЗАПРОСА
// ============================================================

function readBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    let buf = '';
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('body_too_large')); return; }
      buf += c;
    });
    req.on('end', () => {
      if (!buf) return resolve({});
      try { resolve(JSON.parse(buf)); }
      catch (e) { reject(new Error('invalid_json_body: ' + e.message)); }
    });
    req.on('error', reject);
  });
}

// ============================================================
//  ВАЛИДАЦИЯ
// ============================================================

function requireString(body, field) {
  if (typeof body[field] !== 'string' || body[field].trim().length === 0) {
    const e = new Error(`field_required: ${field}`); e.statusCode = 400; throw e;
  }
  return body[field].trim();
}

function requireMapId(body) {
  const mapId = body.mapId;
  if (mapId === undefined || mapId === null || mapId === '') {
    const e = new Error('field_required: mapId'); e.statusCode = 400; throw e;
  }
  return mapId;
}

function validatePresetInput(body) {
  if (body.layers !== undefined && !Array.isArray(body.layers)) { const e = new Error('field_invalid: layers must be array'); e.statusCode = 400; throw e; }
  if (body.modules !== undefined && !Array.isArray(body.modules)) { const e = new Error('field_invalid: modules must be array'); e.statusCode = 400; throw e; }
  if (body.panels !== undefined && !Array.isArray(body.panels)) { const e = new Error('field_invalid: panels must be array'); e.statusCode = 400; throw e; }
  if (body.theme !== undefined && (typeof body.theme !== 'object' || Array.isArray(body.theme))) { const e = new Error('field_invalid: theme must be object'); e.statusCode = 400; throw e; }
  if (body.camera !== undefined && (typeof body.camera !== 'object' || Array.isArray(body.camera))) { const e = new Error('field_invalid: camera must be object'); e.statusCode = 400; throw e; }
  if (body.render !== undefined && (typeof body.render !== 'object' || Array.isArray(body.render))) { const e = new Error('field_invalid: render must be object'); e.statusCode = 400; throw e; }
}

// ============================================================
//  ФОРМАТ ОТВЕТА
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

function sendError(res, status, code, message, extra = {}) {
  sendJSON(res, status, { error: code, message, ...extra });
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epRoot() {
  const engine = getEngine();
  return {
    version: meta.version,
    endpoints: [
      'GET    /list',
      'GET    /stats',
      'GET    /get/:id',
      'GET    /:id/render',
      'POST   /:id/apply',
      'POST   /save-as',
      'POST   /:id/clear-map',
      'POST   /:id/rename',
      'POST   /:id/clone',
      'POST   /:id/reset',
      'DELETE /:id',
    ],
    themes: Object.keys(THEMES),
    builtinIds: Object.values(PRESET_IDS),
    presets: engine.list(),
  };
}

async function epList() {
  const engine = getEngine();
  const all = engine.getAll();
  return { total: all.length, presets: engine.list() };
}

async function epStats() {
  return getEngine().getStats();
}

async function epGet(id) {
  const preset = getEngine().get(id);
  if (!preset) { const e = new Error('preset_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return preset.toJSON();
}

async function epRender(id) {
  const cfg = getEngine().getRenderConfig(id);
  if (!cfg) { const e = new Error('preset_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return cfg;
}

async function epApply(id, body) {
  const mapId = requireMapId(body);
  const snapshot = getEngine().applyToMap(mapId, id);
  if (!snapshot) { const e = new Error('preset_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return { applied: true, id, mapId, snapshot };
}

async function epSaveAs(body) {
  const name = requireString(body, 'name');
  validatePresetInput(body);
  const saved = getEngine().saveAsPreset({
    layers:   body.layers   || [],
    modules:  body.modules  || [],
    panels:   body.panels   || [],
    theme:    body.theme    || null,
    camera:   body.camera   || null,
    render:   body.render   || null,
  }, name);
  if (!saved) { const e = new Error('save_failed'); e.statusCode = 500; throw e; }
  return saved;
}

async function epClearMap(id, body) {
  const mapId = requireMapId(body);
  const snapshot = getEngine().clearMap(mapId);
  return { cleared: true, mapId, presetId: id, snapshot };
}

async function epRename(id, body) {
  const name = requireString(body, 'name');
  const ok = getEngine().rename(id, name);
  if (!ok) { const e = new Error('preset_not_found_or_invalid_name'); e.statusCode = 404; e.id = id; throw e; }
  return { renamed: true, id, name };
}

async function epClone(id, body) {
  const cloned = getEngine().clone(id, body.name);
  if (!cloned) { const e = new Error('preset_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return cloned;
}

async function epReset(id) {
  const ok = getEngine().reset(id);
  if (!ok) { const e = new Error('preset_not_builtin_or_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return { reset: true, id };
}

async function epDelete(id) {
  const ok = getEngine().delete(id);
  if (!ok) { const e = new Error('preset_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return { deleted: true, id };
}

// ============================================================
//  МАРШРУТИЗАЦИЯ ПО ПОДПУТЯМ
// ============================================================

function parseSegments(path) {
  return path.split('/').filter(Boolean);
}

async function dispatch(method, subPath, body) {
  const segments = parseSegments(subPath);

  // GET /list, /stats
  if (method === 'GET' && segments.length === 0) return { kind: 'root', data: await epRoot() };
  if (method === 'GET' && segments[0] === 'list' && segments.length === 1) return { kind: 'json', data: await epList() };
  if (method === 'GET' && segments[0] === 'stats' && segments.length === 1) return { kind: 'json', data: await epStats() };

  // GET /get/:id
  if (method === 'GET' && segments[0] === 'get' && segments.length === 2) {
    return { kind: 'json', data: await epGet(decodeURIComponent(segments[1])) };
  }

  // GET /:id/render
  if (method === 'GET' && segments.length === 2 && segments[1] === 'render') {
    return { kind: 'json', data: await epRender(decodeURIComponent(segments[0])) };
  }

  // POST /save-as
  if (method === 'POST' && segments.length === 1 && segments[0] === 'save-as') {
    return { kind: 'json', data: await epSaveAs(body), status: 201 };
  }

  // POST /:id/apply, /:id/clear-map, /:id/rename, /:id/clone, /:id/reset
  if (method === 'POST' && segments.length === 2) {
    const id = decodeURIComponent(segments[0]);
    const action = segments[1];
    if (action === 'apply')     return { kind: 'json', data: await epApply(id, body) };
    if (action === 'clear-map') return { kind: 'json', data: await epClearMap(id, body) };
    if (action === 'rename')    return { kind: 'json', data: await epRename(id, body) };
    if (action === 'clone')     return { kind: 'json', data: await epClone(id, body), status: 201 };
    if (action === 'reset')     return { kind: 'json', data: await epReset(id) };
  }

  // DELETE /:id
  if (method === 'DELETE' && segments.length === 1) {
    return { kind: 'json', data: await epDelete(decodeURIComponent(segments[0])) };
  }

  const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e;
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/preset/, '') || '';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'preset',
    'X-Service-Version': meta.version,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  };

  try {
    let body = {};
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
      try { body = await readBody(req); }
      catch (e) { return sendError(res, 400, 'invalid_body', e.message, extra); }
    }

    const result = await dispatch(req.method, subPath, body);
    return sendJSON(res, result.status || 200, {
      service: 'preset',
      endpoint: subPath || '/',
      generated_at: new Date().toISOString(),
      data: result.data,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    return sendError(res, status, e.message || 'service_error', e.message, {
      ...extra,
      ...(e.id ? { id: e.id } : {}),
    });
  }
}
