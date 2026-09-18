/**
 * apis/sources/social-briefing-engine-api.mjs — API-МОДУЛЬ: ТЕКСТОВЫЙ БРИФИНГ-ДВИЖОК
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/forecast/social-briefing.json — { _meta, data:{ brief:{ text, metadata, items?, top? } } }.
 * Анализатор: scripts/analyzers/social-briefing-engine.mjs.
 *
 * Текстовый брифинг-движок: генерирует читаемый текстовый отчёт (Ollama).
 * Дополняет основной слой /api/layers/social-briefing (структурированные данные).
 * Ниша: текстовая сводка, /brief, /text, /metadata, /items.
 *
 * ФОРМАТЫ: json (FC + items + stats), csv, series, stats, raw, text.
 * ФИЛЬТРЫ: ?q=, ?type=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET / /stats /text /brief /metadata /items /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'forecast', 'social-briefing.json');

export const route  = '/api/layers/social-briefing-engine';
export const method = 'GET';

export const meta = {
  category: 'forecast',
  icon: '📣',
  color: '#ec4899',
  vizType: 'marker',
  source: 'analytics/forecast/social-briefing.json',
  collector: 'scripts/analyzers/social-briefing-engine.mjs',
  cache: 120,
  description: 'Текстовый брифинг-движок (Ollama): читаемый текст + items + metadata',
  unit: 'brief',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/social-briefing-engine.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json: ' + e.message); err.statusCode = 500; throw err; }
  if (!parsed || !parsed.data) { const err = new Error('invalid_shape: missing data'); err.statusCode = 500; throw err; }
  return parsed;
}

function extractItems(doc) {
  const brief = doc.data?.brief || {};
  const arr = Array.isArray(brief.items) ? brief.items
    : Array.isArray(brief.top) ? brief.top
    : Array.isArray(doc.data?.items) ? doc.data.items
    : Array.isArray(doc.data?.top) ? doc.data.top : [];
  return arr.map((it, i) => ({
    id: it.id || `brief-${i}`,
    name: it.name || it.title || it.label || `Item ${i}`,
    type: it.type || it.kind || null,
    value: it.value != null ? Number(it.value) : (it.score != null ? Number(it.score) : null),
    description: it.description || it.summary || null,
  }));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)     r = r.filter(x => (x.name + ' ' + (x.description || '')).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.type)  r = r.filter(x => String(x.type || '').toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows, doc) {
  const byType = {};
  for (const r of rows) if (r.type) byType[r.type] = (byType[r.type] || 0) + 1;
  const brief = doc.data?.brief || {};
  return {
    count: rows.length,
    by_type: byType,
    has_text: !!brief.text,
    text_length: brief.text ? brief.text.length : 0,
    word_count: brief.text ? brief.text.split(/\s+/).filter(Boolean).length : 0,
    metadata: brief.metadata || null,
    meta: doc._meta?.stats || null,
    generated_at: doc._meta?.updated_at || null,
  };
}

function toCSV(rows) {
  const lines = ['id,name,type,value'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.value].map(esc).join(','));
  return lines.join('\n') + '\n';
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
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/social-briefing-engine/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractItems(doc);
    const extra = {
      'X-Module': 'social-briefing-engine-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/text' || format === 'text') {
      const text = doc.data?.brief?.text || '';
      return sendText(res, 200, text, 'text/plain; charset=utf-8');
    }
    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all, doc), meta: doc._meta || null }, extra);
    }
    if (sub === '/brief')    return sendJSON(res, 200, doc, extra);
    if (sub === '/metadata') return sendJSON(res, 200, { metadata: doc.data?.brief?.metadata || null, meta: doc._meta || null }, extra);
    if (sub === '/items')    return sendJSON(res, 200, { items: applyFilters(all, query), total: all.length }, extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_items: all.length, returned_items: rows.length,
        generated_at: new Date().toISOString(), source_updated_at: doc._meta?.updated_at || null,
      },
      items: rows,
      brief: doc.data?.brief || null,
      stats: computeStats(rows, doc),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
