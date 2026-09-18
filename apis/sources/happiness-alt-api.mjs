/**
 * apis/sources/happiness-alt-api.mjs — API-МОДУЛЬ: ИНДЕКС СЧАСТЬЯ (АЛЬТЕРНАТИВНЫЙ)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/happiness-alt.json — { type:'FeatureCollection', features:[{ type:'Feature', properties:{ name, value, label:'score', unit:'' } }] } ИЛИ [{ country, value }].
 * Сборщик: scripts/collectors/collect-happiness-alt.mjs.
 *
 * Альтернативный индекс счастья по странам (шкала 0–10, выше — лучше).
 * Геокоординаты — по стране из встроенного справочника.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?min=, ?max=, ?tier=, ?q=, ?limit=, ?top=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /stats              — агрегированная статистика
 *   GET /status             — health-check
 *   GET /top                — топ-10 по счастью
 *   GET /bottom             — антитоп-10
 *   GET /tiers              — группировка по tier
 *   GET /featurecollection  — GeoJSON
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'happiness-alt.json');

export const route  = '/api/layers/happiness-alt';
export const method = 'GET';

export const meta = {
  category: 'esg',
  icon: '😊',
  color: '#88ff44',
  vizType: 'choropleth',
  source: 'basket/happiness-alt.json',
  collector: 'collect-happiness-alt.mjs',
  cache: 300,
  description: 'Альтернативный индекс счастья по странам (0–10)',
  unit: 'score',
};

// ============================================================
//  СПРАВОЧНИК КООРДИНАТ СТРАН
// ============================================================

const COUNTRY_COORDS = {
  'США': [39.7, -98.8], 'USA': [39.7, -98.8],
  'Россия': [61.5, 105], 'Russia': [61.5, 105],
  'Китай': [34.9, 105.2], 'China': [34.9, 105.2],
  'Индия': [20.8, 78.5], 'India': [20.8, 78.5],
  'Бразилия': [-13.8, -51.9], 'Brazil': [-13.8, -51.9],
  'Великобритания': [55.3, -3.2], 'UK': [55.3, -3.2],
  'Германия': [50.6, 10.4], 'Germany': [50.6, 10.4],
  'Франция': [46.5, 2.3], 'France': [46.5, 2.3],
  'Япония': [36.3, 138.7], 'Japan': [36.3, 138.7],
  'Украина': [48.4, 31.2], 'Ukraine': [48.4, 31.2],
  'Канада': [55.9, -106.5], 'Canada': [55.9, -106.5],
  'Австралия': [-25.5, 133.8], 'Australia': [-25.5, 133.8],
  'Финляндия': [61.9, 25.7], 'Finland': [61.9, 25.7],
  'Дания': [56.3, 9.5], 'Denmark': [56.3, 9.5],
  'Норвегия': [60.5, 8.5], 'Norway': [60.5, 8.5],
  'Швеция': [60.1, 18.6], 'Sweden': [60.1, 18.6],
  'Нидерланды': [52.1, 5.3], 'Netherlands': [52.1, 5.3],
  'Швейцария': [46.8, 8.2], 'Switzerland': [46.8, 8.2],
  'Италия': [41.9, 12.6], 'Italy': [41.9, 12.6],
  'Испания': [40.5, -3.7], 'Spain': [40.5, -3.7],
  'Мексика': [23.6, -102.6], 'Mexico': [23.6, -102.6],
  'Индонезия': [-0.8, 113.9], 'Indonesia': [-0.8, 113.9],
  'Турция': [38.9, 35.2], 'Turkey': [38.9, 35.2],
  'Южная Корея': [35.9, 127.8], 'South Korea': [35.9, 127.8],
  'Израиль': [31.0, 34.9], 'Israel': [31.0, 34.9],
  'Египет': [26.8, 30.8], 'Egypt': [26.8, 30.8],
  'ЮАР': [-30.6, 22.9], 'South Africa': [-30.6, 22.9],
  'Аргентина': [-38.4, -63.6], 'Argentina': [-38.4, -63.6],
  'Польша': [51.9, 19.1], 'Poland': [51.9, 19.1],
  'Португалия': [39.4, -8.2], 'Portugal': [39.4, -8.2],
};

const TIERS = {
  very_high: { min: 7.5, color: '#22c55e', label: 'Очень высокий' },
  high:      { min: 6.5, color: '#84cc16', label: 'Высокий' },
  medium:    { min: 5.5, color: '#eab308', label: 'Средний' },
  low:       { min: 4.0, color: '#f97316', label: 'Низкий' },
  very_low:  { min: 0,   color: '#dc2626', label: 'Очень низкий' },
};

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) if (n >= def.min) return { key: k, ...def };
  return { key: 'very_low', ...TIERS.very_low };
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
      err.hint = 'run scripts/collectors/collect-happiness-alt.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractRows(doc) {
  if (Array.isArray(doc)) {
    return doc.map(r => ({ name: r.country || r.name, value: Number(r.value ?? r.score), date: r.date || null }))
      .filter(r => r.name && Number.isFinite(r.value));
  }
  if (doc && Array.isArray(doc.features)) {
    return doc.features.map(f => {
      const p = f.properties || {};
      return {
        name: p.name || p.country,
        value: Number(p.value ?? p.score),
        date: p.date || null,
        unit: p.unit || '',
        label: p.label || 'score',
      };
    }).filter(r => r.name && Number.isFinite(r.value));
  }
  if (doc && Array.isArray(doc.data)) return extractRows(doc.data);
  return [];
}

function normalizeRows(rows) {
  return rows.map(r => {
    const coords = COUNTRY_COORDS[r.name] || null;
    const t = tierOf(r.value);
    return {
      country: r.name,
      value: r.value,
      date: r.date,
      unit: r.unit || '',
      label: r.label || 'score',
      tier: t.key,
      tierLabel: t.label,
      color: t.color,
      lat: coords ? coords[0] : null,
      lng: coords ? coords[1] : null,
      category: 'esg',
      icon: meta.icon,
    };
  });
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => String(x.country).toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.q)       r = r.filter(x => String(x.country).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.tier)    r = r.filter(x => x.tier === String(query.tier));
  const sortKey = query.sort || 'value-desc';
  if (sortKey === 'value-desc') r.sort((a, b) => b.value - a.value);
  else if (sortKey === 'value-asc') r.sort((a, b) => a.value - b.value);
  else if (sortKey === 'country')   r.sort((a, b) => a.country.localeCompare(b.country));
  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

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
  const byTier = {};
  for (const r of rows) byTier[r.tier] = (byTier[r.tier] || 0) + 1;
  const sortedByVal = rows.slice().sort((a, b) => b.value - a.value);
  return {
    count: rows.length,
    mean: Number(mean.toFixed(2)),
    median: Number(median.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    min: Number(Math.min(...values).toFixed(2)),
    max: Number(Math.max(...values).toFixed(2)),
    highest: sortedByVal[0] ? { country: sortedByVal[0].country, value: sortedByVal[0].value } : null,
    lowest: sortedByVal[sortedByVal.length-1] ? { country: sortedByVal[sortedByVal.length-1].country, value: sortedByVal[sortedByVal.length-1].value } : null,
    by_tier: byTier,
  };
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        country: r.country, value: r.value, date: r.date, unit: r.unit, label: r.label,
        tier: r.tier, tierLabel: r.tierLabel, color: r.color,
        category: r.category, icon: r.icon,
      },
    }));
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length, unmapped: rows.length - features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ country: r.country, value: r.value, date: r.date, tier: r.tier })); }

function toCSV(rows) {
  const lines = ['country,value,date,tier,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) lines.push([r.country, r.value, r.date, r.tier, r.lat, r.lng].map(esc).join(','));
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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/happiness-alt/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = normalizeRows(extractRows(doc));
    const extra = {
      'X-Module': 'happiness-alt-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length, generated_at: new Date().toISOString() }, extra);
    }
    if (sub === '/top') {
      const top = all.slice().sort((a, b) => b.value - a.value).slice(0, 10);
      return sendJSON(res, 200, { top, count: top.length }, extra);
    }
    if (sub === '/bottom') {
      const bottom = all.slice().sort((a, b) => a.value - b.value).slice(0, 10);
      return sendJSON(res, 200, { bottom, count: bottom.length }, extra);
    }
    if (sub === '/tiers') {
      const byTier = {};
      for (const r of all) {
        if (!byTier[r.tier]) byTier[r.tier] = [];
        byTier[r.tier].push({ country: r.country, value: r.value });
      }
      return sendJSON(res, 200, { tiers: byTier, total: Object.keys(byTier).length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: doc }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
