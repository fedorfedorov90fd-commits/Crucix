/**
 * apis/sources/gold-silver-api.mjs — API-МОДУЛЬ: ЗОЛОТО/СЕРЕБРО
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/gold-silver.json — временной ряд { date, ratio }.
 * Дополнительно: data/basket/gold.json — точки бирж { label, value, country, lat, lng }.
 * Сборщик: scripts/collectors/collect-gold-silver.mjs.
 *
 * Соотношение золото/серебро — индикатор рыночного стресса.
 * Ratio > 80: инвесторы ищут безопасность в золоте (кризисный сигнал).
 * Ratio < 50: оптимизм, риск-он настроения.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?min_ratio=, ?max_ratio=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE   = join(PROJECT_ROOT, 'data', 'basket', 'gold-silver.json');
const BASKET_GOLD   = join(PROJECT_ROOT, 'data', 'basket', 'gold.json');

export const route  = '/api/layers/gold-silver';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📈',
  color: '#ffcc44',
  vizType: 'marker',
  source: 'basket/gold-silver.json',
  collector: 'collect-gold-silver.mjs',
  cache: 300,
  description: 'Соотношение золото/серебро — индикатор рыночного стресса',
  unit: 'ratio',
};

function ratioLevel(ratio) {
  if (ratio >= 100) return { level: 'extreme_stress', color: '#7f1d1d', label: 'Экстремальный стресс' };
  if (ratio >= 80)  return { level: 'high_stress',    color: '#dc2626', label: 'Высокий стресс' };
  if (ratio >= 65)  return { level: 'elevated',       color: '#f97316', label: 'Повышенный' };
  if (ratio >= 50)  return { level: 'normal',         color: '#eab308', label: 'Норма' };
  return                   { level: 'risk_on',        color: '#22c55e', label: 'Риск-он' };
}

async function loadSeries() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-gold-silver.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.series)) arr = parsed.series;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const date = r.date || r.timestamp;
    const value = Number(r.ratio ?? r.value ?? r.close);
    return (date && Number.isFinite(value)) ? { date: String(date).slice(0, 10), value } : null;
  }).filter(Boolean);

  if (clean.length === 0) { const err = new Error('empty_series_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

async function loadGoldPrices() {
  try {
    const raw = await fs.readFile(BASKET_GOLD, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return [];
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.min_ratio != null) { const n = parseFloat(query.min_ratio); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max_ratio != null) { const n = parseFloat(query.max_ratio); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.days)  { const n = parseInt(query.days, 10);  if (n > 0) r = r.slice(-n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const v = series.map(r => r.value);
  const min = Math.min(...v), max = Math.max(...v);
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  const first = v[0], last = v[v.length - 1];
  const change = last - first;
  const changePct = first !== 0 ? (change / first) * 100 : 0;
  const current = ratioLevel(last);
  const byLevel = {};
  for (const val of v) { const lvl = ratioLevel(val).level; byLevel[lvl] = (byLevel[lvl] || 0) + 1; }
  return {
    count: series.length,
    date_from: series[0].date, date_to: series[series.length - 1].date,
    min: +min.toFixed(2), max: +max.toFixed(2), avg: +avg.toFixed(2),
    first: +first.toFixed(2), last: +last.toFixed(2),
    change: +change.toFixed(2), changePct: +changePct.toFixed(2),
    trend: change > 0.5 ? 'up' : change < -0.5 ? 'down' : 'flat',
    current_level: current.level, current_label: current.label, current_color: current.color,
    by_level: byLevel,
  };
}

function toFeatureCollection(series, stats, goldPrices) {
  // Точки на карте: биржи, где котируется золото. Каждой присваиваем текущее значение ratio.
  const latest = series[series.length - 1];
  const prev   = series[series.length - 2] || latest;
  const delta  = latest.value - prev.value;
  const lvl = ratioLevel(latest.value);

  const coords = goldPrices.length > 0 ? goldPrices.map(g => ({
    name: g.label || 'Unknown',
    country: g.country || null,
    lat: Number(g.lat), lng: Number(g.lng),
    goldPrice: Number(g.value),
  })) : [
    { name: 'COMEX',    country: 'United States', lat: 40.7128, lng:  -74.0060 },
    { name: 'LBMA',     country: 'United Kingdom', lat: 51.5074, lng:  -0.1278 },
    { name: 'Shanghai', country: 'China',         lat: 39.9042, lng: 116.4074 },
    { name: 'Dubai',    country: 'UAE',           lat: 25.2048, lng:  55.2708 },
  ];

  const features = coords
    .filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lng))
    .map(c => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
      properties: {
        name: c.name, country: c.country,
        goldPrice: c.goldPrice || null,
        ratio: latest.value, ratioPrev: prev.value,
        delta: +delta.toFixed(2),
        direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
        level: lvl.level, levelLabel: lvl.label, color: lvl.color,
        date: latest.date,
        category: 'finance', icon: meta.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    levels: [
      { level: 'extreme_stress', label: 'Экстремальный стресс (100+)', color: '#7f1d1d' },
      { level: 'high_stress',    label: 'Высокий стресс (80+)',        color: '#dc2626' },
      { level: 'elevated',       label: 'Повышенный (65+)',            color: '#f97316' },
      { level: 'normal',         label: 'Норма (50+)',                 color: '#eab308' },
      { level: 'risk_on',        label: 'Риск-он (<50)',               color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_points: full.length, returned_points: filtered.length,
    date_from: filtered[0]?.date || null,
    date_to: filtered[filtered.length - 1]?.date || null,
  };
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
function toCSVBody(series) {
  const lines = ['date,ratio,level'];
  for (const r of series) { const l = ratioLevel(r.value); lines.push(`${r.date},${r.value},${l.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const fullSeries = await loadSeries();
    const series = applyFilters(fullSeries, query);
    const stats  = computeStats(series);
    const goldPrices = await loadGoldPrices();
    const extra = { 'X-Module': 'gold-silver-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extra);

    const fc = toFeatureCollection(series, stats, goldPrices);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
      levels: fc.levels,
      features: fc.features,
      series,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
