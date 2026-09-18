/**
 * apis/sources/consumer-confidence-api.mjs — API-МОДУЛЬ: ПОТРЕБИТЕЛЬСКОЕ ДОВЕРИЕ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/consumer-confidence.json — { type:'FeatureCollection', features:[{ type:'Feature', properties:{ name, value, label:'index', unit:'' } }] }.
 * Сборщик: scripts/collectors/collect-consumer-confidence.mjs.
 *
 * Индекс потребительского доверия по странам (0–100+). Геокоординаты — встроенный справочник.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?min=, ?max=, ?q=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'consumer-confidence.json');

export const route  = '/api/layers/consumer-confidence';
export const method = 'GET';

export const meta = {
  category: 'economics',
  icon: '📈',
  color: '#44ccff',
  vizType: 'choropleth',
  source: 'basket/consumer-confidence.json',
  collector: 'collect-consumer-confidence.mjs',
  cache: 300,
  description: 'Индекс потребительского доверия по странам',
  unit: 'index',
};

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
  'Канада': [55.9, -106.5], 'Canada': [55.9, -106.5],
  'Австралия': [-25.5, 133.8], 'Australia': [-25.5, 133.8],
};

const TIERS = {
  elite:   { min: 100, color: '#22c55e', label: 'Очень высокий' },
  high:    { min: 80,  color: '#84cc16', label: 'Высокий' },
  medium:  { min: 60,  color: '#eab308', label: 'Средний' },
  low:     { min: 40,  color: '#f97316', label: 'Низкий' },
  critical:{ min: 0,   color: '#dc2626', label: 'Критически низкий' },
};

function tierOf(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(TIERS)) if (n >= def.min) return { key: k, ...def };
  return { key: 'critical', ...TIERS.critical };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-consumer-confidence.mjs'; throw err;
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
    return doc.map(r => ({ name: r.country || r.name, value: Number(r.value ?? r.index), date: r.date || null }))
      .filter(r => r.name && Number.isFinite(r.value));
  }
  if (doc && Array.isArray(doc.features)) {
    return doc.features.map(f => {
      const p = f.properties || {};
      return {
        name: p.name || p.country,
        value: Number(p.value ?? p.index),
        date: p.date || null,
        unit: p.unit || '',
        label: p.label || 'index',
      };
    }).filter(r => r.name && Number.isFinite(r.value));
  }
  return [];
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => String(x.name || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.q)       r = r.filter(x => String(x.name || '').toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.min != null) { const n = Number(query.min); if (Number.isFinite(n)) r = r.filter(x => x.value >= n); }
  if (query.max != null) { const n = Number(query.max); if (Number.isFinite(n)) r = r.filter(x => x.value <= n); }
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const values = rows.map(r => r.value).filter(Number.isFinite);
  const sorted = [...values].sort((a, b) => a - b);
  const median = sorted.length === 0 ? null
    : sorted.length % 2 === 0 ? (sorted[sorted.length/2-1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];
  const byTier = {};
  for (const r of rows) { const t = tierOf(r.value); byTier[t.key] = (byTier[t.key] || 0) + 1; }
  return {
    count: rows.length,
    mean: values.length ? Number((values.reduce((a,b)=>a+b,0)/values.length).toFixed(2)) : null,
    median: median != null ? Number(median.toFixed(2)) : null,
    min: values.length ? Number(Math.min(...values).toFixed(2)) : null,
    max: values.length ? Number(Math.max(...values).toFixed(2)) : null,
    by_tier: byTier,
    highest: rows.slice().sort((a,b)=>b.value-a.value)[0] || null,
    lowest: rows.slice().sort((a,b)=>a.value-b.value)[0] || null,
  };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => r.name && COUNTRY_COORDS[r.name])
    .map(r => {
      const [lat, lng] = COUNTRY_COORDS[r.name];
      const t = tierOf(r.value);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [lng, lat] },
        properties: {
          name: r.name, value: r.value, unit: r.unit || '', label: r.label || 'index', date: r.date,
          tier: t.key, tierLabel: t.label, color: t.color,
          category: meta.category, icon: meta.icon,
        },
      };
    });
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length },
  };
}

function toSeries(rows) { return rows.map(r => ({ name: r.name, value: r.value, date: r.date, tier: tierOf(r.value).key })); }

function toCSV(rows) {
  const lines = ['name,value,unit,date,tier,lat,lng'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s; };
  for (const r of rows) {
    const c = COUNTRY_COORDS[r.name] || [null, null];
    lines.push([r.name, r.value, r.unit || '', r.date, tierOf(r.value).key, c[0], c[1]].map(esc).join(','));
  }
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/consumer-confidence/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const all = extractRows(doc);
    const extra = {
      'X-Module': 'consumer-confidence-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(all), extra);
    if (sub === '/status') {
      return sendJSON(res, 200, { status: 'online', count: all.length }, extra);
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
