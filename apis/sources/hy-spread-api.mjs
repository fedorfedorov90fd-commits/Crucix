/**
 * apis/sources/hy-spread-api.mjs — API-МОДУЛЬ: КОРПОРАТИВНЫЕ СПРЕДЫ (HY OAS)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/hy-spread.json — [{ date, value }] ИЛИ { source, lastUpdated, data:[{date,value}] }.
 * Сборщик: scripts/collectors/collect-hy-spread.mjs. FRED BAMLH0A0HYM2 (ICE BofA US High Yield Index Option-Adjusted Spread).
 *
 * Индикатор стресса рынка: высокодоходные спреды (HY OAS). Рост спреда = risk-off.
 * Временной ряд + тренд + tier-классификация (low / normal / elevated / stress / crisis).
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min=, ?max=, ?tier=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /latest /tiers /series /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'hy-spread.json');

export const route  = '/api/layers/hy-spread';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📊',
  color: '#ff4400',
  vizType: 'series',
  source: 'basket/hy-spread.json',
  collector: 'collect-hy-spread.mjs',
  cache: 300,
  description: 'HY OAS — спред высокодоходных облигаций (ICE BofA, FRED)',
  unit: 'percent',
};

// Уровни стресса (проценты HY OAS)
const TIERS = {
  low:      { min: 0,   max: 3.0,  color: '#22c55e', label: 'Комфорт' },
  normal:   { min: 3.0, max: 4.5,  color: '#84cc16', label: 'Норма' },
  elevated: { min: 4.5, max: 6.0,  color: '#eab308', label: 'Повышен' },
  stress:   { min: 6.0, max: 8.0,  color: '#f97316', label: 'Стресс' },
  crisis:   { min: 8.0, max: 999,  color: '#dc2626', label: 'Кризис' },
};

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) {
    if (n >= def.min && n < def.max) return { key: k, color: def.color, label: def.label };
  }
  return { key: 'crisis', color: '#dc2626', label: 'Кризис' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-hy-spread.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractSeries(doc) {
  let arr = null, source = null, meta = null;
  if (Array.isArray(doc)) arr = doc;
  else if (doc && Array.isArray(doc.data)) { arr = doc.data; source = doc.source || null; meta = doc.meta || null; }
  else if (doc && Array.isArray(doc.records)) arr = doc.records;
  if (!arr) return { series: [], source, meta };
  const series = arr.map(r => {
    const v = Number(r.value ?? r.spread ?? r.oas);
    return {
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      value: v,
      tier: tierOf(v),
    };
  }).filter(r => Number.isFinite(r.value));
  series.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return { series, source, meta };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.tier) r = r.filter(x => x.tier.key === String(query.tier));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  if (values.length === 0) return { count: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first) ? Number((last.value - first.value).toFixed(4)) : null;
  const changePct = (last && first && first.value !== 0)
    ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;
  const byTier = {};
  for (const r of rows) byTier[r.tier.key] = (byTier[r.tier.key] || 0) + 1;
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    stddev: Number(stddev.toFixed(4)),
    min: Number(Math.min(...values).toFixed(4)),
    max: Number(Math.max(...values).toFixed(4)),
    last_value: last?.value ?? null,
    last_date: last?.date ?? null,
    last_tier: last?.tier.key ?? null,
    first_value: first?.value ?? null,
    change_abs: changeAbs,
    change_pct: changePct,
    by_tier: byTier,
  };
}

function toFeatureCollection() {
  return { type: 'FeatureCollection', features: [], meta: { note: 'series-only layer (no geo)' } };
}

function toCSV(rows) {
  const lines = ['date,value,tier'];
  for (const r of rows) lines.push(`${r.date || ''},${r.value},${r.tier.key}`);
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/hy-spread/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { series, source, meta: srcMeta } = extractSeries(doc);
    const extra = {
      'X-Module': 'hy-spread-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(series), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: series.length, source, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      return sendJSON(res, 200, { latest: series.slice(-1)[0] || null, source }, extra);
    }
    if (sub === '/tiers') {
      const byTier = {};
      for (const r of series) {
        if (!byTier[r.tier.key]) byTier[r.tier.key] = [];
        byTier[r.tier.key].push({ date: r.date, value: r.value });
      }
      return sendJSON(res, 200, { tiers: byTier, total: Object.keys(byTier).length }, extra);
    }
    if (sub === '/series') {
      const rows = applyFilters(series, query);
      return sendJSON(res, 200, { series: rows, meta: { count: rows.length } }, extra);
    }
    if (sub === '/featurecollection') {
      return sendJSON(res, 200, toFeatureCollection(), extra);
    }

    const rows = applyFilters(series, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows, meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: series.length, returned_records: rows.length,
        upstream_source: source, upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      legend: Object.entries(TIERS).map(([key, def]) => ({ key, min: def.min, max: def.max, color: def.color, label: def.label })),
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
