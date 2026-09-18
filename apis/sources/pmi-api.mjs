/**
 * apis/sources/pmi-api.mjs — API-МОДУЛЬ: PMI (ИНДЕКС ДЕЛОВОЙ АКТИВНОСТИ)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/pmi.json — [{ date, value }] ИЛИ { source, lastUpdated, data:[{date,value}] }.
 * Сборщик: scripts/collectors/collect-pmi.mjs.
 *
 * PMI (Purchasing Managers' Index) — индекс менеджеров по закупкам.
 * Порог 50: выше — расширение экономики, ниже — спад.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min=, ?max=, ?regime=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats /status /latest /regimes /trend /phase /featurecollection
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'pmi.json');

export const route  = '/api/layers/pmi';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '📊',
  color: '#ff8800',
  vizType: 'series',
  source: 'basket/pmi.json',
  collector: 'collect-pmi.mjs',
  cache: 300,
  description: 'PMI — индекс менеджеров по закупкам (порог 50)',
  unit: 'index',
};

// Порог 50 — ключевая граница PMI. Обычно 42-50 — замедление, <42 — рецессия.
const REGIMES = {
  boom:        { min: 55, color: '#22c55e', label: 'Бум' },
  expansion:   { min: 50, color: '#84cc16', label: 'Рост' },
  contraction: { min: 45, color: '#eab308', label: 'Спад' },
  slowdown:    { min: 42, color: '#f97316', label: 'Замедление' },
  recession:   { min: 0,  color: '#dc2626', label: 'Рецессия' },
};

function regimeOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(REGIMES)) if (n >= def.min) return { key: k, ...def };
  return { key: 'recession', ...REGIMES.recession };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-pmi.mjs'; throw err;
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
    const v = Number(r.value ?? r.pmi ?? r.index);
    return {
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      value: v,
      regime: regimeOf(v),
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
  if (query.regime) r = r.filter(x => x.regime.key === String(query.regime));
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
  const changePct = (last && first && first.value !== 0) ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;
  const byRegime = {};
  for (const r of rows) byRegime[r.regime.key] = (byRegime[r.regime.key] || 0) + 1;

  // Месяцев выше/ниже порога 50
  const above50 = values.filter(v => v >= 50).length;
  const below50 = values.filter(v => v < 50).length;

  const tail = rows.slice(-7).map(r => r.value);
  const prev = rows.slice(-14, -7).map(r => r.value);
  let trend7 = null;
  if (tail.length && prev.length) {
    const tMean = tail.reduce((a,b)=>a+b,0)/tail.length;
    const pMean = prev.reduce((a,b)=>a+b,0)/prev.length;
    trend7 = pMean !== 0 ? Number(((tMean - pMean) / pMean * 100).toFixed(2)) : null;
  }

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    last_value: last?.value ?? null,
    last_date: last?.date ?? null,
    last_regime: last?.regime.key ?? null,
    last_regimeLabel: last?.regime.label ?? null,
    first_value: first?.value ?? null,
    change_abs: changeAbs,
    change_pct: changePct,
    trend_7v7_pct: trend7,
    above_50: above50,
    below_50: below50,
    by_regime: byRegime,
  };
}

function computePhase(rows) {
  // Фаза: последнее значение относительно порога 50
  const last = rows.slice(-1)[0];
  if (!last) return null;
  const v = last.value;
  let phase, description;
  if (v >= 55) { phase = 'strong_expansion'; description = 'Уверенный рост деловой активности'; }
  else if (v >= 50) { phase = 'expansion'; description = 'Рост, но неуверенный'; }
  else if (v >= 45) { phase = 'contraction'; description = 'Спад деловой активности'; }
  else if (v >= 42) { phase = 'slowdown'; description = 'Замедление, близко к рецессии'; }
  else { phase = 'recession'; description = 'Рецессия'; }
  return { phase, description, value: v, date: last.date, regime: last.regime.key };
}

function toFeatureCollection() {
  return { type: 'FeatureCollection', features: [], meta: { note: 'series-only layer (no geo)' } };
}

function toCSV(rows) {
  const lines = ['date,value,regime'];
  for (const r of rows) lines.push(`${r.date || ''},${r.value},${r.regime.key}`);
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/pmi/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { series, source, meta: srcMeta } = extractSeries(doc);
    const extra = {
      'X-Module': 'pmi-api',
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
    if (sub === '/regimes') {
      const byRegime = {};
      for (const r of series) {
        if (!byRegime[r.regime.key]) byRegime[r.regime.key] = [];
        byRegime[r.regime.key].push({ date: r.date, value: r.value });
      }
      return sendJSON(res, 200, { regimes: byRegime, total: Object.keys(byRegime).length }, extra);
    }
    if (sub === '/trend') {
      const tail = series.slice(-7);
      const prev = series.slice(-14, -7);
      const tMean = tail.length ? tail.reduce((s,x)=>s+x.value,0)/tail.length : null;
      const pMean = prev.length ? prev.reduce((s,x)=>s+x.value,0)/prev.length : null;
      const delta = (tMean != null && pMean != null && pMean !== 0) ? Number(((tMean - pMean) / pMean * 100).toFixed(2)) : null;
      return sendJSON(res, 200, { last7_mean: tMean ? Number(tMean.toFixed(2)) : null, prev7_mean: pMean ? Number(pMean.toFixed(2)) : null, trend_pct: delta, count: tail.length }, extra);
    }
    if (sub === '/phase') {
      return sendJSON(res, 200, { phase: computePhase(series) }, extra);
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
      legend: Object.entries(REGIMES).map(([key, def]) => ({ key, ...def })),
      series: rows,
      stats: computeStats(rows),
      phase: computePhase(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
