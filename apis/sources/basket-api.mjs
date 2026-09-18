/**
 * apis/sources/basket-api.mjs — SERVICE-МОДУЛЬ: УНИВЕРСАЛЬНЫЙ ДОСТУП К КОРЗИНЕ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: читает файлы из data/basket/*.json напрямую (сервис-фасад).
 *
 * ЭНДПОИНТЫ:
 *   GET /                — список файлов в корзине
 *   GET /:name           — содержимое файла (records / raw / FC)
 *   GET /:name/stats     — статистика файла (ключи, размер)
 *   GET /:name/records   — только массив records
 *   GET /:name/raw       — сырое содержимое
 *   GET /:name/schema    — схема верхнего уровня (ключи + типы)
 *
 * ФОРМАТЫ: json, records, raw, schema.
 * ФИЛЬТРЫ (гео): ?lat=&lon=&radius= (км) — фильтр по радиусу.
 * ФИЛЬТРЫ (пагинация): ?limit=&offset=.
 *
 * БЕЗОПАСНОСТЬ: path traversal блокируется (resolve + startsWith).
 */

import { promises as fs } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = resolve(join(PROJECT_ROOT, 'data', 'basket'));

export const route  = '/api/services/basket';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Basket service: universal access to data/basket/*.json (list, records, raw, schema, geo-radius filter, pagination).',
  cache: 60,
  version: '2.0.0',
};

// ============================================================
//  УТИЛИТЫ
// ============================================================

const NAME_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_NAME_LEN = 120;
const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map();

function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > MAX_NAME_LEN) return false;
  if (name.includes('..')) return false;
  if (name.startsWith('/')) return false;
  if (!NAME_RE.test(name)) return false;
  return true;
}

function toJsonName(name) {
  return name.endsWith('.json') ? name : name + '.json';
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) *
            Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function extractRecords(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const key of ['records', 'data', 'articles', 'events', 'items', 'features', 'objects']) {
    if (Array.isArray(raw[key])) return raw[key];
  }
  return [];
}

function schemaOf(raw) {
  if (Array.isArray(raw)) return { type: 'array', length: raw.length, itemKeys: raw[0] ? Object.keys(raw[0]) : [] };
  if (!raw || typeof raw !== 'object') return { type: typeof raw };
  const keys = Object.keys(raw);
  const types = {};
  for (const k of keys) {
    const v = raw[k];
    if (Array.isArray(v)) types[k] = `array[${v.length}]`;
    else types[k] = typeof v;
  }
  return { type: 'object', keys, types };
}

async function loadFile(name) {
  const jsonName = toJsonName(name);
  const now = Date.now();
  const cached = cache.get(jsonName);
  if (cached && cached.expires > now) return cached.data;

  const fullPath = resolve(join(BASKET_DIR, jsonName));
  if (!fullPath.startsWith(BASKET_DIR + '/')) {
    const err = new Error('path_traversal_blocked'); err.statusCode = 403; throw err;
  }

  let raw;
  try { raw = await fs.readFile(fullPath, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('basket_file_not_found'); err.statusCode = 404;
      err.hint = `data/basket/${jsonName}`; throw err;
    }
    throw e;
  }

  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) {
    const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err;
  }

  cache.set(jsonName, { data: parsed, expires: now + CACHE_TTL });
  return parsed;
}

function applyGeoFilter(records, lat, lon, radiusKm) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(radiusKm)) return records;
  return records.filter(r => {
    const rLat = Number(r.lat ?? r.latitude);
    const rLon = Number(r.lng ?? r.lon ?? r.longitude);
    if (!Number.isFinite(rLat) || !Number.isFinite(rLon)) return false;
    return haversineKm(lat, lon, rLat, rLon) <= radiusKm;
  });
}

function applyPagination(records, query) {
  const limit = parseInt(query.limit, 10);
  const offset = parseInt(query.offset, 10);
  const start = Number.isFinite(offset) && offset > 0 ? offset : 0;
  if (Number.isFinite(limit) && limit > 0) return records.slice(start, start + limit);
  return records;
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epList() {
  const files = await fs.readdir(BASKET_DIR).catch(() => []);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  const detailed = await Promise.all(jsonFiles.map(async (f) => {
    try {
      const st = await fs.stat(join(BASKET_DIR, f));
      return { name: f, size: st.size, mtime: st.mtime.toISOString() };
    } catch { return { name: f, size: 0, mtime: null }; }
  }));
  return { service: 'basket', count: detailed.length, files: detailed };
}

async function epFile(name, query) {
  const raw = await loadFile(name);
  const records = extractRecords(raw);
  const lat = Number(query.lat), lon = Number(query.lon), radius = Number(query.radius);
  const geoFiltered = (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radius))
    ? applyGeoFilter(records, lat, lon, radius)
    : records;
  const paginated = applyPagination(geoFiltered, query);
  return {
    name,
    total_records: records.length,
    filtered_records: geoFiltered.length,
    returned_records: paginated.length,
    records: paginated,
    schema: schemaOf(raw),
  };
}

async function epStats(name) {
  const raw = await loadFile(name);
  const records = extractRecords(raw);
  return { name, records: records.length, schema: schemaOf(raw) };
}

async function epRecords(name, query) {
  const raw = await loadFile(name);
  const records = extractRecords(raw);
  const lat = Number(query.lat), lon = Number(query.lon), radius = Number(query.radius);
  const geoFiltered = (Number.isFinite(lat) && Number.isFinite(lon) && Number.isFinite(radius))
    ? applyGeoFilter(records, lat, lon, radius) : records;
  const paginated = applyPagination(geoFiltered, query);
  return { name, count: paginated.length, total: records.length, records: paginated };
}

async function epRaw(name) {
  const raw = await loadFile(name);
  return { name, data: raw };
}

async function epSchema(name) {
  const raw = await loadFile(name);
  return { name, schema: schemaOf(raw) };
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/basket\/?/, '');
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
    'X-Service': 'basket',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (subPath === '' || subPath === '/') {
      return sendJSON(res, 200, { service: 'basket', endpoint: '/', data: await epList() }, extra);
    }

    const segments = subPath.split('/').filter(Boolean);
    const name = segments[0];
    const action = segments[1] || null;

    if (!isValidName(name)) {
      return sendJSON(res, 400, { error: 'invalid_name', name }, extra);
    }

    let data;
    if (action === 'stats')        data = await epStats(name);
    else if (action === 'records') data = await epRecords(name, query);
    else if (action === 'raw')     data = await epRaw(name);
    else if (action === 'schema')  data = await epSchema(name);
    else if (action === null)      data = await epFile(name, query);
    else return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['stats','records','raw','schema'] }, extra);

    return sendJSON(res, 200, { service: 'basket', endpoint: subPath, data }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
