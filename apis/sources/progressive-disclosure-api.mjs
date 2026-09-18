/**
 * apis/sources/progressive-disclosure-api.mjs — SERVICE-МОДУЛЬ: PROGRESSIVE DISCLOSURE
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: data/analytics/specialist/progressive-disclosure.json — { _meta: { id, category, version, calculator, updated_at, duration_ms, checksum, stats }, data: { items: [{ id, levels: [{ level: 'summary'|'medium'|'full', sizeEstimate }] }], issues?, tools?, commands?, health?, dashboard?, results? } }.
 * НАЗНАЧЕНИЕ: раскрытие досье/отчёта по уровням детализации (summary/medium/full).
 *
 * ЭНДПОИНТЫ:
 *   GET /             — полный документ
 *   GET /stats        — _meta
 *   GET /items        — список всех items с уровнями
 *   GET /items/:id    — один item
 *   GET /item/:id     — алиас /items/:id
 *   GET /levels       — карта уровней по всем items
 *   GET /issues       — данные issues (если есть)
 *   GET /tools        — данные tools (если есть)
 *   GET /commands     — данные commands (если есть)
 *   GET /health       — данные health (если есть)
 *   GET /dashboard    — данные dashboard (если есть)
 *   GET /run          — данные results (если есть)
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'progressive-disclosure.json');

export const route  = '/api/services/progressive-disclosure';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Progressive disclosure service: exposes dossier/report at summary/medium/full detail levels per entity. Data from data/analytics/specialist/progressive-disclosure.json.',
  cache: 300,
  version: '2.0.0',
};

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('not_generated');
      err.statusCode = 503;
      err.hint = 'run scripts/analyzers/progressive-disclosure.mjs';
      throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || typeof parsed !== 'object') { const err = new Error('invalid_shape'); err.statusCode = 500; throw err; }
  if (!parsed.data) { const err = new Error('missing_data_field'); err.statusCode = 500; throw err; }
  return parsed;
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epRoot(doc) {
  return doc;
}

async function epStats(doc) {
  return doc._meta || {};
}

async function epItems(doc) {
  return { items: doc.data.items || [], total: (doc.data.items || []).length };
}

async function epItem(doc, id) {
  const items = doc.data.items || [];
  const item = items.find(x => String(x.id) === String(id));
  if (!item) { const e = new Error('item_not_found'); e.statusCode = 404; e.id = id; throw e; }
  return item;
}

async function epLevels(doc) {
  const items = doc.data.items || [];
  const byLevel = { summary: [], medium: [], full: [] };
  for (const it of items) {
    for (const lvl of (it.levels || [])) {
      if (byLevel[lvl.level]) byLevel[lvl.level].push({ id: it.id, sizeEstimate: lvl.sizeEstimate });
    }
  }
  return { byLevel, total: items.length };
}

async function epSubField(doc, field) {
  const v = doc.data[field];
  if (v === undefined) { const e = new Error('field_absent'); e.statusCode = 404; e.field = field; throw e; }
  return { [field]: v };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toCSV(doc) {
  const items = doc?.data?.items;
  if (!Array.isArray(items)) return null;
  if (items.length === 0) return '';
  const rows = [];
  for (const it of items) {
    for (const lvl of (it.levels || [])) {
      rows.push({ id: it.id, level: lvl.level, sizeEstimate: lvl.sizeEstimate });
    }
  }
  if (rows.length === 0) return '';
  const cols = ['id', 'level', 'sizeEstimate'];
  const esc = (v) => v == null ? '' : String(v).includes(',') ? `"${String(v).replace(/"/g, '""')}"` : String(v);
  return cols.join(',') + '\n' + rows.map(r => cols.map(c => esc(r[c])).join(',')).join('\n') + '\n';
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

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subPath = url.pathname.replace(/^\/api\/services\/progressive-disclosure/, '') || '/';
  const query = Object.fromEntries(url.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

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
    'X-Service': 'progressive-disclosure',
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

    let result;
    const segs = subPath.split('/').filter(Boolean);

    if (segs.length === 0) result = await epRoot(doc);
    else if (segs[0] === 'stats') result = await epStats(doc);
    else if (segs[0] === 'items' && segs.length === 1) result = await epItems(doc);
    else if ((segs[0] === 'items' || segs[0] === 'item') && segs.length === 2) result = await epItem(doc, decodeURIComponent(segs[1]));
    else if (segs[0] === 'levels') result = await epLevels(doc);
    else if (['issues', 'tools', 'commands', 'health', 'dashboard', 'run'].includes(segs[0])) result = await epSubField(doc, segs[0]);
    else { const e = new Error('endpoint_not_found'); e.statusCode = 404; throw e; }

    if (format === 'stats') return sendJSON(res, 200, { stats: doc._meta || {} }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: result }, extra);

    return sendJSON(res, 200, {
      service: 'progressive-disclosure',
      endpoint: subPath,
      meta: {
        version: doc._meta?.version || meta.version,
        updated_at: doc._meta?.updated_at || null,
        checksum: doc._meta?.checksum || null,
      },
      data: result,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'service_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    if (e.id) payload.id = e.id;
    if (e.field) payload.field = e.field;
    try { sendJSON(res, status, payload); } catch {}
  }
}
