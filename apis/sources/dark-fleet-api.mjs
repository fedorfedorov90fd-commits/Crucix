/**
 * apis/sources/dark-fleet-api.mjs — API-МОДУЛЬ: ТЁМНЫЙ ФЛОТ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/dark-fleet.json — { source, lastUpdated, data: [{ date, count, destination, flag, source }] }.
 * Сборщик: scripts/collectors/collect-dark-fleet.mjs.
 *
 * Временной ряд + геопривязка портов назначения для отображения точек на карте.
 *
 * ФОРМАТЫ: json, csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?destination=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'dark-fleet.json');

export const route  = '/api/layers/dark-fleet';
export const method = 'GET';

export const meta = {
  category: 'other',
  icon: '🚢',
  color: '#ff2200',
  vizType: 'marker',
  source: 'basket/dark-fleet.json',
  collector: 'collect-dark-fleet.mjs',
  cache: 600,
  description: 'Тёмный флот — суда без AIS, идущие в Россию (по портам назначения)',
  unit: 'ships',
};

// Координаты портов назначения
const PORT_COORDS = {
  'Novorossiysk':   { lat: 44.7239, lng: 37.7686 },
  'Kaliningrad':    { lat: 54.7104, lng: 20.4522 },
  'Murmansk':       { lat: 68.9585, lng: 33.0827 },
  'Vladivostok':    { lat: 43.1332, lng: 131.9113 },
  'St. Petersburg': { lat: 59.9311, lng: 30.3609 },
  'Unknown':        { lat: 60.0,    lng: 30.0    },
};

const FLAG_COLOR = {
  'Unknown':      '#64748b',
  'Camouflage':   '#a21caf',
  'Fake Panama':  '#f97316',
  'Fake Liberia': '#eab308',
  'No Flag':      '#dc2626',
};

async function loadSeries() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-dark-fleet.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    date: String(r.date || '').slice(0, 10),
    count: Number(r.count ?? r.value ?? 0),
    destination: r.destination || 'Unknown',
    flag: r.flag || 'Unknown',
    source: r.source || null,
  })).filter(r => r.date && Number.isFinite(r.count));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => a.date.localeCompare(b.date));
  return clean;
}

function applyFilters(series, query) {
  let r = series.slice();
  if (query.since)  r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until)  r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.destination) { const d = String(query.destination).toLowerCase(); r = r.filter(x => x.destination.toLowerCase().includes(d)); }
  if (query.limit)  { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(series) {
  if (series.length === 0) return { count: 0 };
  const c = series.map(r => r.count);
  const min = Math.min(...c), max = Math.max(...c);
  const avg = c.reduce((a, b) => a + b, 0) / c.length;
  const total = c.reduce((a, b) => a + b, 0);
  const first = c[0], last = c[c.length - 1];
  const byDest = {}, byFlag = {};
  for (const r of series) {
    byDest[r.destination] = (byDest[r.destination] || 0) + r.count;
    byFlag[r.flag] = (byFlag[r.flag] || 0) + r.count;
  }
  return {
    count: series.length,
    date_from: series[0].date,
    date_to: series[series.length - 1].date,
    min, max, avg: +avg.toFixed(1), total,
    first, last,
    trend: last > first ? 'up' : last < first ? 'down' : 'flat',
    by_destination: byDest,
    by_flag: byFlag,
  };
}

function toFeatureCollection(series) {
  // Агрегируем по портам — карта показывает, сколько всего судов прошло через каждый порт
  const aggregate = new Map();
  for (const r of series) {
    const key = r.destination;
    const p = PORT_COORDS[key] || PORT_COORDS['Unknown'];
    const cur = aggregate.get(key) || { name: key, lat: p.lat, lng: p.lng, total: 0, flags: {}, last_date: null };
    cur.total += r.count;
    cur.flags[r.flag] = (cur.flags[r.flag] || 0) + r.count;
    if (!cur.last_date || r.date > cur.last_date) cur.last_date = r.date;
    aggregate.set(key, cur);
  }
  const features = [...aggregate.values()].map(p => {
    const sev = p.total >= 200 ? 'critical' : p.total >= 100 ? 'high' : p.total >= 50 ? 'medium' : 'low';
    const color = sev === 'critical' ? '#7f1d1d' : sev === 'high' ? '#dc2626' : sev === 'medium' ? '#f97316' : '#eab308';
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: {
        name: p.name,
        totalShips: p.total,
        flags: p.flags,
        lastDate: p.last_date,
        severity: sev,
        color,
        category: 'other',
        icon: meta.icon,
      },
    };
  });
  return { type: 'FeatureCollection', features };
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
  const lines = ['date,count,destination,flag,source'];
  for (const r of series) lines.push(`${r.date},${r.count},${r.destination},${r.flag},${r.source || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const fullSeries = await loadSeries();
    const series = applyFilters(fullSeries, query);
    const stats = computeStats(series);
    const extra = { 'X-Module': 'dark-fleet-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(series), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series, stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(fullSeries, series) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: series, meta: envelopeMeta(fullSeries, series) }, extra);

    const fc = toFeatureCollection(series);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(fullSeries, series),
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
