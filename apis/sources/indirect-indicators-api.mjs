/**
 * apis/sources/indirect-indicators-api.mjs — API-МОДУЛЬ: КОСВЕННЫЕ ИНДИКАТОРЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/indirect-indicators.json — { source, lastUpdated, data:[{ date, pentagonPizza, langleyTaxis, source }], meta? }.
 * Сборщик: scripts/collectors/collect-indirect-indicators.mjs. Источники: Google Maps / Yelp / Uber / Lyft.
 *
 * Косвенные индикаторы скрытой активности:
 *   - «Пицца Пентагона» (pentagonPizza) — прокси кризисной активности госструктур.
 *   - «Такси в Лэнгли» (langleyTaxis) — прокси активности разведсообщества.
 * Временной ряд + композитный индекс + тренд по обоим.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?indicator=, ?since=, ?until=, ?min=, ?max=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /latest /indicators /pizza /langley /composite /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'indirect-indicators.json');

export const route  = '/api/layers/indirect-indicators';
export const method = 'GET';

export const meta = {
  category: 'intelligence',
  icon: '🍕',
  color: '#dc2626',
  vizType: 'series',
  source: 'basket/indirect-indicators.json',
  collector: 'collect-indirect-indicators.mjs',
  cache: 300,
  description: 'Косвенные индикаторы скрытой активности (Пицца Пентагона / Такси в Лэнгли)',
  unit: 'index',
};

const INDICATOR_META = {
  pentagonPizza: { label: 'Пицца Пентагона', color: '#dc2626', description: 'Косвенный индикатор кризисной активности госструктур (Google Maps / Yelp)' },
  langleyTaxis:  { label: 'Такси в Лэнгли',  color: '#0891b2', description: 'Косвенный индикатор активности разведсообщества (Uber / Lyft)' },
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-indirect-indicators.mjs'; throw err;
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
    const pizza = Number(r.pentagonPizza ?? r.pizza);
    const langley = Number(r.langleyTaxis ?? r.langley ?? r.taxi);
    const composite = (Number.isFinite(pizza) && Number.isFinite(langley))
      ? Number(((pizza + langley) / 2).toFixed(4))
      : (Number.isFinite(pizza) ? pizza : (Number.isFinite(langley) ? langley : null));
    return {
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      pentagonPizza: Number.isFinite(pizza) ? pizza : null,
      langleyTaxis: Number.isFinite(langley) ? langley : null,
      composite,
      source: r.source || null,
    };
  }).filter(r => r.date && (r.pentagonPizza != null || r.langleyTaxis != null));
  series.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return { series, source, meta };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => (x.composite ?? 0) >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => (x.composite ?? 0) <= n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function statsFor(rows, key) {
  const values = rows.map(r => r[key]).filter(Number.isFinite);
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / values.length;
  return {
    count: values.length,
    mean: Number(mean.toFixed(4)),
    median: Number(median.toFixed(4)),
    stddev: Number(Math.sqrt(variance).toFixed(4)),
    min: Number(Math.min(...values).toFixed(4)),
    max: Number(Math.max(...values).toFixed(4)),
    last: values[values.length - 1],
    first: values[0],
    change_pct: values[0] !== 0 ? Number(((values[values.length-1] - values[0]) / values[0] * 100).toFixed(2)) : null,
  };
}

function computeStats(rows) {
  const pizza = statsFor(rows, 'pentagonPizza');
  const langley = statsFor(rows, 'langleyTaxis');
  const composite = statsFor(rows, 'composite');
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    pentagon_pizza: pizza,
    langley_taxis: langley,
    composite,
  };
}

function toFeatureCollection() {
  return { type: 'FeatureCollection', features: [], meta: { note: 'series-only layer (no geo)' } };
}

function toCSV(rows) {
  const lines = ['date,pentagonPizza,langleyTaxis,composite'];
  for (const r of rows) lines.push(`${r.date || ''},${r.pentagonPizza ?? ''},${r.langleyTaxis ?? ''},${r.composite ?? ''}`);
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/indirect-indicators/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { series, source, meta: srcMeta } = extractSeries(doc);
    const extra = {
      'X-Module': 'indirect-indicators-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(series), source, src_meta: srcMeta, indicators: INDICATOR_META }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: series.length, source, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/latest') {
      return sendJSON(res, 200, { latest: series.slice(-1)[0] || null, source }, extra);
    }
    if (sub === '/indicators') {
      return sendJSON(res, 200, { indicators: INDICATOR_META }, extra);
    }
    if (sub === '/pizza') {
      const rows = series.map(r => ({ date: r.date, value: r.pentagonPizza })).filter(r => r.value != null);
      return sendJSON(res, 200, { indicator: 'pentagonPizza', label: INDICATOR_META.pentagonPizza.label, series: rows, stats: statsFor(series, 'pentagonPizza') }, extra);
    }
    if (sub === '/langley') {
      const rows = series.map(r => ({ date: r.date, value: r.langleyTaxis })).filter(r => r.value != null);
      return sendJSON(res, 200, { indicator: 'langleyTaxis', label: INDICATOR_META.langleyTaxis.label, series: rows, stats: statsFor(series, 'langleyTaxis') }, extra);
    }
    if (sub === '/composite') {
      const rows = series.map(r => ({ date: r.date, value: r.composite })).filter(r => r.value != null);
      return sendJSON(res, 200, { indicator: 'composite', series: rows, stats: statsFor(series, 'composite') }, extra);
    }
    if (sub === '/featurecollection') {
      return sendJSON(res, 200, toFeatureCollection(), extra);
    }

    const rows = applyFilters(series, query);
    let filtered = rows;
    if (query.indicator === 'pizza')    filtered = rows.filter(r => r.pentagonPizza != null);
    else if (query.indicator === 'langley') filtered = rows.filter(r => r.langleyTaxis != null);

    if (format === 'csv')    return sendText(res, 200, toCSV(filtered), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: filtered, meta: { count: filtered.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: series.length, returned_records: filtered.length,
        upstream_source: source, upstream_meta: srcMeta,
        generated_at: new Date().toISOString(),
      },
      indicators: INDICATOR_META,
      series: filtered,
      stats: computeStats(filtered),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
