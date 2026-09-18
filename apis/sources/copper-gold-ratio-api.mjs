/**
 * apis/sources/copper-gold-ratio-api.mjs — API-МОДУЛЬ: МЕДЬ/ЗОЛОТО (СПРЕД-ИНДИКАТОР)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/copper-gold.json — { type:'FeatureCollection' } ИЛИ [{ date, value }] ИЛИ { _meta, data }.
 * Сборщик: scripts/collectors/collect-copper-gold-ratio.mjs.
 *
 * Отношение меди к золоту — классический опережающий индикатор экономики.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?limit=, ?min=, ?max=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'copper-gold.json');

export const route  = '/api/layers/copper-gold-ratio';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '🟠',
  color: '#c2410c',
  vizType: 'series',
  source: 'basket/copper-gold.json',
  collector: 'collect-copper-gold-ratio.mjs',
  cache: 300,
  description: 'Отношение меди к золоту (опережающий индикатор экономики)',
  unit: 'ratio',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-copper-gold-ratio.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractSeries(doc) {
  if (Array.isArray(doc)) {
    return doc.map(r => ({
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      value: Number(r.value ?? r.ratio ?? r.price),
      copper: r.copper != null ? Number(r.copper) : null,
      gold: r.gold != null ? Number(r.gold) : null,
    })).filter(r => Number.isFinite(r.value));
  }
  if (doc && Array.isArray(doc.features)) {
    return doc.features.map(f => {
      const p = f.properties || {};
      return { date: String(p.date || '').slice(0, 10) || null, value: Number(p.value ?? p.ratio), copper: null, gold: null };
    }).filter(r => Number.isFinite(r.value));
  }
  if (doc && Array.isArray(doc.data)) return extractSeries(doc.data);
  return [];
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); } // последние N
  return r;
}

function computeStats(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null
    : sorted.length % 2 === 0 ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const trend = (last && first && Number.isFinite(last.value) && Number.isFinite(first.value) && first.value !== 0)
    ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    mean: values.length ? Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(4)) : null,
    median: median != null ? Number(median.toFixed(4)) : null,
    min: values.length ? Number(Math.min(...values).toFixed(4)) : null,
    max: values.length ? Number(Math.max(...values).toFixed(4)) : null,
    last_value: last?.value ?? null,
    last_date: last?.date ?? null,
    trend_pct: trend,
  };
}

function toFeatureCollection(rows) {
  // Временной ряд без гео — пустой FC со сводкой.
  return { type: 'FeatureCollection', features: [], meta: { count: rows.length } };
}

function toCSV(rows) {
  const lines = ['date,value,copper,gold'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.date, r.value, r.copper, r.gold].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/copper-gold-ratio/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractSeries(doc);
    const extra = {
      'X-Module': 'copper-gold-ratio-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length }, extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows, meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      series: rows,
      stats: computeStats(rows),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
