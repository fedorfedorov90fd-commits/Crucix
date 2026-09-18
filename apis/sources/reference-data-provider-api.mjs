/**
 * apis/sources/reference-data-provider-api.mjs — SERVICE-МОДУЛЬ: REFERENCE DATA
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: data/analytics/specialist/reference-data-provider.json — { _meta: { id, category, version, calculator, updated_at, duration_ms, checksum, stats }, data: { items: [...], extra: {...} } }.
 * НАЗНАЧЕНИЕ: справочные данные (reference data) — статические показатели стран, регионов, классификаторы.
 *
 * ЭНДПОИНТЫ:
 *   GET /             — полный документ
 *   GET /stats        — _meta + extra
 *   GET /items        — список справочных записей
 *   GET /items/:id    — одна запись
 *   GET /extra        — блок extra
 *   GET /lookup?id=   — быстрый поиск записи по id (alias)
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'reference-data-provider.json');

export const route  = '/api/services/reference-data-provider';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Reference data provider service: static country/region indicators, classifiers. Data from data/analytics/specialist/reference-data-provider.json.',
  cache: 3600,
  version: '2.0.0',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') { const err = new Error('not_generated'); err.statusCode = 503; err.hint = 'run scripts/analyzers/reference-data-provider.mjs'; throw err; }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || !parsed.data) { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  return parsed;
}

async function epRoot(doc) { return doc; }
async function epStats(doc) { return { ...(doc._meta || {}), extra: doc.data.extra || null }; }
async function epItems(doc) {
  const items = doc.data.items || [];
  return { items, total: items.length };
}
async function epItem(doc, id) {
  const items = doc.data.items || [];
  const item = items.find(x => String(x.id) === String(id));
  if (!item) { const e = new Error('item_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return item;
}
async function epExtra(doc) { return { extra: doc.data.extra || {} }; }
async function epLookup(doc, id) {
  if (!id) { const e = new Error('field_required: id'); e.statusCode = 400; throw e; }
  return epItem(doc, id);
}

function toCSV(doc) {
  const items = doc?.data?.items;
  if (!Array.isArray(items) || items.length === 0) return items ? '' : null;
  const keys = new Set();
  for (const r of items) Object.keys(r || {}).forEach(k => keys.add(k));
  const cols = [...keys];
  const esc = (v) => { if (v == null) return ''; const s = typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  return cols.join(',') + '\n' + items.map(row => cols.map(c => esc(row[c])).join(',')).join('\n') + '\n';
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

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/reference-data-provider/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  if (req.method === 'OPTIONS') {
    res.writeHead(200, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    res.end();
    return;
  }

  const extra = {
    'X-Service': 'reference-data-provider',
    'X-Service-Version': meta.version,
    'Cache-Control': `public, max-age=${meta.cache}`,
    'Access-Control-Allow-Origin': '*',
  };

  try {
    const doc = await loadData();

    if (format === 'csv') {
      const csv = toCSV(doc);
      if (csv === null) return sendJSON(res, 400, { error: 'csv_not_supported' }, extra);
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }

    const segs = subPath.split('/').filter(Boolean);
    let result;
    if (segs.length === 0) result = await epRoot(doc);
    else if (segs[0] === 'stats') result = await epStats(doc);
    else if (segs[0] === 'items' && segs.length === 1) result = await epItems(doc);
    else if (segs[0] === 'items' && segs.length === 2) result = await epItem(doc, decodeURIComponent(segs[1]));
    else if (segs[0] === 'extra') result = await epExtra(doc);
    else if (segs[0] === 'lookup') result = await epLookup(doc, query.id);
    else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }

    if (format === 'stats') return sendJSON(res, 200, { stats: doc._meta || {} }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: result }, extra);

    return sendJSON(res, 200, {
      service: 'reference-data-provider',
      endpoint: subPath,
      meta: { version: doc._meta?.version || meta.version, updated_at: doc._meta?.updated_at || null, checksum: doc._meta?.checksum || null },
      data: result,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    if (e.id) payload.id = e.id;
    try { sendJSON(res, status, payload); } catch {}
  }
}
