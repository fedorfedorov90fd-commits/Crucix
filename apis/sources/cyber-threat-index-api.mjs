/**
 * apis/sources/cyber-threat-index-api.mjs — API-МОДУЛЬ: ИНДЕКС КИБЕРУГРОЗ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/cyber-threat-index.json — { source, lastUpdated, data: [{ date, value, cisa, darkweb, source? }], meta? } ИЛИ [{ date, value, cisa, darkweb }].
 * Сборщик: scripts/collectors/collect-cyber-threat-index.mjs. Компоненты: CISA + Darkweb.
 *
 * Композитный индекс киберугроз: value = агрегат CISA + Darkweb (0–100).
 * Временной ряд + тренд + вклад компонентов + tier-классификация.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min=, ?max=, ?tier=, ?limit=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats              — агрегированная статистика
 *   GET /status             — health-check
 *   GET /latest             — последнее значение
 *   GET /critical           — значения в tier critical/high
 *   GET /components         — сводка по компонентам (CISA/darkweb)
 *   GET /featurecollection  — GeoJSON (пустой)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'cyber-threat-index.json');

export const route  = '/api/layers/cyber-threat-index';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🛡️',
  color: '#dc2626',
  vizType: 'series',
  source: 'basket/cyber-threat-index.json',
  collector: 'collect-cyber-threat-index.mjs',
  cache: 300,
  description: 'Композитный индекс киберугроз (CISA + Darkweb)',
  unit: 'index',
};

const TIERS = {
  critical: { min: 80, color: '#dc2626', label: 'Критический' },
  high:     { min: 60, color: '#f97316', label: 'Высокий' },
  medium:   { min: 40, color: '#eab308', label: 'Средний' },
  low:      { min: 20, color: '#84cc16', label: 'Низкий' },
  minimal:  { min: 0,  color: '#22c55e', label: 'Минимальный' },
};

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) if (n >= def.min) return { key: k, ...def };
  return { key: 'minimal', ...TIERS.minimal };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-cyber-threat-index.mjs'; throw err;
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
    const v = Number(r.value ?? r.index);
    return {
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      value: v,
      cisa: r.cisa != null ? Number(r.cisa) : null,
      darkweb: r.darkweb != null ? Number(r.darkweb) : null,
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
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const trend = (last && first && first.value !== 0)
    ? Number(((last.value - first.value) / first.value * 100).toFixed(2)) : null;
  const byTier = {};
  for (const r of rows) byTier[r.tier.key] = (byTier[r.tier.key] || 0) + 1;
  const cisaValues = rows.map(r => r.cisa).filter(Number.isFinite);
  const darkwebValues = rows.map(r => r.darkweb).filter(Number.isFinite);
  // Волатильность: стд. отклонение
  const mean = values.reduce((a,b)=>a+b,0)/values.length;
  const variance = values.reduce((a,v)=>a+(v-mean)**2,0)/values.length;
  const stddev = Math.sqrt(variance);

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
    last_tier: last?.tier.key ?? null,
    last_cisa: last?.cisa ?? null,
    last_darkweb: last?.darkweb ?? null,
    trend_pct: trend,
    by_tier: byTier,
    cisa_mean: cisaValues.length ? Number((cisaValues.reduce((a,b)=>a+b,0)/cisaValues.length).toFixed(2)) : null,
    darkweb_mean: darkwebValues.length ? Number((darkwebValues.reduce((a,b)=>a+b,0)/darkwebValues.length).toFixed(2)) : null,
    cisa_last: cisaValues.slice(-1)[0] ?? null,
    darkweb_last: darkwebValues.slice(-1)[0] ?? null,
  };
}

function componentSummary(rows) {
  const cisa = rows.map(r => r.cisa).filter(Number.isFinite);
  const darkweb = rows.map(r => r.darkweb).filter(Number.isFinite);
  const stats = (arr) => {
    if (arr.length === 0) return null;
    return {
      count: arr.length,
      mean: Number((arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(2)),
      min: Number(Math.min(...arr).toFixed(2)),
      max: Number(Math.max(...arr).toFixed(2)),
      last: arr[arr.length - 1],
    };
  };
  return {
    cisa: stats(cisa),
    darkweb: stats(darkweb),
    combined: stats(rows.map(r => r.value)),
  };
}

function toFeatureCollection() {
  return { type: 'FeatureCollection', features: [], meta: { note: 'series-only layer (no geo)' } };
}

function toCSV(rows) {
  const lines = ['date,value,cisa,darkweb,tier'];
  for (const r of rows) lines.push(`${r.date || ''},${r.value},${r.cisa ?? ''},${r.darkweb ?? ''},${r.tier.key}`);
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/cyber-threat-index/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { series, source, meta: srcMeta } = extractSeries(doc);
    const extra = {
      'X-Module': 'cyber-threat-index-api',
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
      const last = series.slice(-1)[0] || null;
      return sendJSON(res, 200, { latest: last, source }, extra);
    }
    if (sub === '/critical') {
      const crit = series.filter(r => r.tier.key === 'critical' || r.tier.key === 'high');
      return sendJSON(res, 200, { critical: crit, total: crit.length }, extra);
    }
    if (sub === '/components') {
      return sendJSON(res, 200, { components: componentSummary(series) }, extra);
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
      legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
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
