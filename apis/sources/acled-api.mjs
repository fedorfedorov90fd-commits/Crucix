/**
 * apis/sources/acled-api.mjs — API-МОДУЛЬ: КОНФЛИКТЫ ACLED
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/acled.json — { events: [{ id, event_type, actor1, actor2, country, lat, lon, fatalities, event_date }] }.
 * Сборщик: scripts/collectors/collect-acled.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?type=, ?country=, ?min_fatalities=, ?since=, ?until=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'acled.json');

export const route  = '/api/layers/acled';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '⚔️',
  color: '#dc2626',
  vizType: 'marker',
  source: 'basket/acled.json',
  collector: 'collect-acled.mjs',
  cache: 300,
  description: 'События конфликтов ACLED (Battles, Protests, Riots, Explosions)',
  unit: 'events',
};

// Типы событий ACLED
const EVENT_TYPES = {
  'Battles':              { color: '#dc2626', label: 'Боевые действия' },
  'Explosions/Remote violence': { color: '#f97316', label: 'Взрывы/дистанционное насилие' },
  'Violence against civilians': { color: '#a21caf', label: 'Насилие против мирных' },
  'Protests':             { color: '#eab308', label: 'Протесты' },
  'Riots':                { color: '#ef4444', label: 'Беспорядки' },
  'Strategic developments':{ color: '#3b82f6', label: 'Стратегические события' },
};

async function loadEvents() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-acled.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.events)) arr = parsed.events;
  else if (parsed && Array.isArray(parsed.data))   arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format: ожидалось { events: [...] } или массив'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    id: String(r.id || ''),
    event_type: r.event_type || r.type || 'Unknown',
    actor1: r.actor1 || '',
    actor2: r.actor2 || '',
    country: r.country || '',
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lon ?? r.lng ?? r.longitude),
    fatalities: Number(r.fatalities ?? r.deaths ?? 0),
    date: String(r.event_date || r.date || '').slice(0, 10),
    source: r.source || null,
    notes: r.notes || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.type)            r = r.filter(x => x.event_type.toLowerCase().includes(String(query.type).toLowerCase()));
  if (query.country)         r = r.filter(x => x.country.toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.actor)           r = r.filter(x => (x.actor1 + ' ' + x.actor2).toLowerCase().includes(String(query.actor).toLowerCase()));
  if (query.min_fatalities != null) {
    const n = parseInt(query.min_fatalities, 10);
    if (Number.isFinite(n)) r = r.filter(x => x.fatalities >= n);
  }
  if (query.since)           r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.until)           r = r.filter(x => x.date <= String(query.until).slice(0, 10));
  if (query.limit)           { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byType = {}, byCountry = {};
  let totalFatalities = 0;
  for (const r of rows) {
    byType[r.event_type] = (byType[r.event_type] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    totalFatalities += r.fatalities;
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10)
    .map(([name, count]) => ({ name, count }));
  return {
    count: rows.length,
    total_fatalities: totalFatalities,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_type: byType,
    top_countries,
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const def = EVENT_TYPES[r.event_type] || { color: '#64748b', label: r.event_type };
    const fat = r.fatalities;
    const sev = fat >= 10 ? 'critical' : fat >= 3 ? 'high' : fat >= 1 ? 'medium' : 'low';
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        eventType: r.event_type,
        eventLabel: def.label,
        actor1: r.actor1, actor2: r.actor2,
        country: r.country,
        fatalities: r.fatalities,
        date: r.date,
        severity: sev,
        color: def.color,
        category: 'geopolitical',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    legend: Object.entries(EVENT_TYPES).map(([k, v]) => ({ type: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_events: full.length, returned_events: filtered.length,
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
function toCSVBody(rows) {
  const lines = ['id,event_type,country,actor1,actor2,lat,lng,fatalities,date'];
  for (const r of rows) lines.push(`${r.id},${r.event_type},${r.country},${r.actor1},${r.actor2},${r.lat},${r.lng},${r.fatalities},${r.date}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadEvents();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'acled-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      legend: fc.legend,
      features: fc.features,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
