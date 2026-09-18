/**
 * apis/sources/basket-reader-api.mjs — SERVICE-МОДУЛЬ: ЧТЕНИЕ КОРЗИНЫ
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: файлы data/basket/*.json напрямую.
 *
 * Прямой доступ к файлам корзины по имени файла. Дополняет basket-service
 * специализированным чтением по имени файла (basket-api читает по id).
 *
 * ЭНДПОИНТЫ (внутренние, маппятся от route):
 *   GET /               — список файлов
 *   GET /:file.json     — сырое содержимое
 *   GET /:file/stats    — статистика
 *   GET /:file/records  — массив records (если применимо)
 *
 * ФОРМАТЫ: json, raw, records, stats.
 */

import { promises as fs } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = resolve(join(PROJECT_ROOT, 'data', 'basket'));

export const route  = '/api/services/basket-reader';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Basket reader service: direct file access to data/basket/*.json by filename. Complements basket-api.',
  cache: 60,
  version: '2.0.0',
};

const NAME_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_NAME_LEN = 120;

function isValidName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > MAX_NAME_LEN) return false;
  if (name.includes('..')) return false;
  if (name.startsWith('/')) return false;
  if (!NAME_RE.test(name)) return false;
  return true;
}

function toJsonName(name) { return name.endsWith('.json') ? name : name + '.json'; }

function extractRecords(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'object') return [];
  for (const k of ['records', 'data', 'articles', 'events', 'items', 'features']) {
    if (Array.isArray(raw[k])) return raw[k];
  }
  return [];
}

function schemaOf(raw) {
  if (Array.isArray(raw)) return { type: 'array', length: raw.length, itemKeys: raw[0] ? Object.keys(raw[0]) : [] };
  if (!raw || typeof raw !== 'object') return { type: typeof raw };
  const types = {};
  for (const k of Object.keys(raw)) {
    const v = raw[k];
    types[k] = Array.isArray(v) ? `array[${v.length}]` : typeof v;
  }
  return { type: 'object', keys: Object.keys(raw), types };
}

async function loadRaw(name) {
  const jsonName = toJsonName(name);
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
  try { return { name: jsonName, parsed: JSON.parse(raw) }; }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': String(Buffer.byteLength(body)), ...extra });
  res.end(body);
}

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/basket-reader\/?/, '');
  const query = Object.fromEntries(url.searchParams.entries());

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'basket-reader',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    if (subPath === '' || subPath === '/') {
      const files = await fs.readdir(BASKET_DIR).catch(() => []);
      const jsonFiles = files.filter(f => f.endsWith('.json'));
      return sendJSON(res, 200, { service: 'basket-reader', endpoint: '/', count: jsonFiles.length, files: jsonFiles }, extra);
    }

    const segments = subPath.split('/').filter(Boolean);
    const name = segments[0];
    const action = segments[1] || null;

    if (!isValidName(name)) {
      return sendJSON(res, 400, { error: 'invalid_name', name }, extra);
    }

    const { name: resolved, parsed } = await loadRaw(name);

    if (action === 'raw' || query.format === 'raw') {
      return sendJSON(res, 200, { name: resolved, data: parsed }, extra);
    }
    if (action === 'stats') {
      const records = extractRecords(parsed);
      return sendJSON(res, 200, { name: resolved, records: records.length, schema: schemaOf(parsed) }, extra);
    }
    if (action === 'records') {
      const records = extractRecords(parsed);
      return sendJSON(res, 200, { name: resolved, count: records.length, records }, extra);
    }
    if (action === 'schema') {
      return sendJSON(res, 200, { name: resolved, schema: schemaOf(parsed) }, extra);
    }
    if (action === null) {
      const records = extractRecords(parsed);
      return sendJSON(res, 200, { name: resolved, records: records.length, data: parsed, schema: schemaOf(parsed) }, extra);
    }

    return sendJSON(res, 404, { error: 'endpoint_not_found', path: subPath, available: ['raw','stats','records','schema'] }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload, extra); } catch {}
  }
}
