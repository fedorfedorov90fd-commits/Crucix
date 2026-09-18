/**
 * apis/sources/education-api.mjs — API-МОДУЛЬ: ИНДЕКС ОБРАЗОВАНИЯ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/education.json — [{ country, value, date }].
 * Сборщик: scripts/collectors/collect-education.mjs.
 *
 * Индекс образования по странам (0–100, выше — лучше).
 * Точки — центроиды стран из встроенного справочника координат.
 *
 * ФОРМАТЫ: json (FeatureCollection + legend + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?min=, ?max=, ?since=, ?limit=, ?search=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'education.json');

export const route  = '/api/layers/education';
export const method = 'GET';

export const meta = {
  category: 'social',
  icon: '🎓',
  color: '#8b5cf6',
  vizType: 'choropleth',
  source: 'basket/education.json',
  collector: 'scripts/collectors/collect-education.mjs',
  cache: 300,
  description: 'Индекс образования по странам (0–100)',
  unit: 'index',
};

// ============================================================
//  СПРАВОЧНИК КООРДИНАТ (центроиды стран)
// ============================================================

const COUNTRY_COORDS = {
  'США': [39.7, -98.8], 'USA': [39.7, -98.8],
  'Россия': [61.5, 105], 'Russia': [61.5, 105],
  'Китай': [34.9, 105.2], 'China': [34.9, 105.2],
  'Индия': [20.8, 78.5], 'India': [20.8, 78.5],
  'Бразилия': [-13.8, -51.9], 'Brazil': [-13.8, -51.9],
  'Великобритания': [55.3, -3.2], 'UK': [55.3, -3.2], 'United Kingdom': [55.3, -3.2],
  'Германия': [50.6, 10.4], 'Germany': [50.6, 10.4],
  'Франция': [46.5, 2.3], 'France': [46.5, 2.3],
  'Япония': [36.3, 138.7], 'Japan': [36.3, 138.7],
  'Украина': [48.4, 31.2], 'Ukraine': [48.4, 31.2],
  'Канада': [55.9, -106.5], 'Canada': [55.9, -106.5],
  'Австралия': [-25.5, 133.8], 'Australia': [-25.5, 133.8],
  'Италия': [41.9, 12.6], 'Italy': [41.9, 12.6],
  'Испания': [40.5, -3.7], 'Spain': [40.5, -3.7],
  'Южная Корея': [35.9, 127.8], 'South Korea': [35.9, 127.8],
  'Мексика': [23.6, -102.6], 'Mexico': [23.6, -102.6],
  'Индонезия': [-0.8, 113.9], 'Indonesia': [-0.8, 113.9],
  'Турция': [38.9, 35.2], 'Turkey': [38.9, 35.2],
  'Польша': [51.9, 19.1], 'Poland': [51.9, 19.1],
  'Нидерланды': [52.1, 5.3], 'Netherlands': [52.1, 5.3],
  'Швеция': [60.1, 18.6], 'Sweden': [60.1, 18.6],
  'Швейцария': [46.8, 8.2], 'Switzerland': [46.8, 8.2],
  'Норвегия': [60.5, 8.5], 'Norway': [60.5, 8.5],
  'Финляндия': [61.9, 25.7], 'Finland': [61.9, 25.7],
  'Израиль': [31.0, 34.9], 'Israel': [31.0, 34.9],
  'Египет': [26.8, 30.8], 'Egypt': [26.8, 30.8],
  'ЮАР': [-30.6, 22.9], 'South Africa': [-30.6, 22.9],
  'Аргентина': [-38.4, -63.6], 'Argentina': [-38.4, -63.6],
};

const TIERS = {
  elite:    { min: 80, color: '#22c55e', label: 'Очень высокий' },
  high:     { min: 65, color: '#84cc16', label: 'Высокий' },
  medium:   { min: 50, color: '#eab308', label: 'Средний' },
  low:      { min: 35, color: '#f97316', label: 'Низкий' },
  critical: { min: 0,  color: '#dc2626', label: 'Критически низкий' },
};

function tierOf(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [key, def] of Object.entries(TIERS)) {
    if (v >= def.min) return { key, ...def };
  }
  return { key: 'critical', ...TIERS.critical };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-education.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.records)) arr = parsed.records;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const country = String(r.country || r.name || '').trim();
    const value = Number(r.value ?? r.index ?? r.score);
    const coords = COUNTRY_COORDS[country] || null;
    return {
      country,
      value,
      date: String(r.date || r.event_date || '').slice(0, 10) || null,
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null,
      tier: tierOf(value),
    };
  }).filter(r => r.country && Number.isFinite(r.value));

  clean.sort((a, b) => b.value - a.value);
  return clean;
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => x.country.toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.search)  r = r.filter(x => x.country.toLowerCase().includes(String(query.search).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.tier) r = r.filter(x => x.tier.key === String(query.tier));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const values = rows.map(r => r.value);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const byTier = {};
  for (const r of rows) byTier[r.tier.key] = (byTier[r.tier.key] || 0) + 1;
  return {
    count: rows.length,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    top_country: rows[0]?.country || null,
    bottom_country: rows[rows.length - 1]?.country || null,
    by_tier: byTier,
  };
}

// ============================================================
//  ФОРМАТЫ ОТВЕТА
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        country: r.country,
        value: r.value,
        date: r.date,
        tier: r.tier.key,
        tierLabel: r.tier.label,
        color: r.tier.color,
        category: meta.category,
        icon: meta.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({ country: r.country, value: r.value, date: r.date, tier: r.tier.key }));
}

function toCSV(rows) {
  const lines = ['country,value,date,tier,lat,lng'];
  for (const r of rows) lines.push(`${r.country},${r.value},${r.date || ''},${r.tier.key},${r.lat ?? ''},${r.lng ?? ''}`);
  return lines.join('\n') + '\n';
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
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();
    const sub = urlObj.pathname.replace(/^\/api\/layers\/education/, '') || '/';

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = {
      'X-Module': 'education-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    // /api/layers/education/featurecollection — shortcut
    if (sub === '/featurecollection') {
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'stats')  return sendJSON(res, 200, { stats, meta: { source: meta.source, unit: meta.unit } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { count: rows.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_records: full.length,
        returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      legend: fc.legend,
      features: fc.features,
      series: toSeries(rows),
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
