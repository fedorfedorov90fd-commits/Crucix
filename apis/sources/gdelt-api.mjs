/**
 * apis/sources/gdelt-api.mjs — API-МОДУЛЬ: GDELT ГЛОБАЛЬНЫЙ МОНИТОРИНГ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/gdelt-latest.json — { source, lastUpdated, totalEvents, events: [{ title, date, region }] }.
 * Резервный: data/basket/gdelt.json, data/basket/gdelt_news.json.
 * Сборщик: scripts/collectors/collect-gdelt.mjs.
 *
 * GDELT — глобальный мониторинг событий. Новости, конфликты, протесты по регионам.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?region=, ?since=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/gdelt';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#4d6bfe',
  vizType: 'marker',
  source: 'basket/gdelt-latest.json',
  collector: 'collect-gdelt.mjs',
  cache: 300,
  description: 'GDELT — глобальный мониторинг событий и новостей',
  unit: 'events',
};

// Координаты регионов GDELT
const REGION_COORDS = {
  'Middle East': { lat: 29.2985, lng: 42.5510 }, 'Europe': { lat: 54.5260, lng: 15.2551 },
  'Asia': { lat: 34.0479, lng: 100.6197 }, 'Africa': { lat: -8.7832, lng: 34.5085 },
  'North America': { lat: 54.5260, lng: -105.2551 }, 'South America': { lat: -8.7832, lng: -55.4915 },
  'Ukraine': { lat: 48.3794, lng: 31.1656 }, 'Russia': { lat: 61.5240, lng: 105.3188 },
  'China': { lat: 35.8617, lng: 104.1954 }, 'Israel': { lat: 31.0461, lng: 34.8516 },
  'Iran': { lat: 32.4279, lng: 53.6880 }, 'North Korea': { lat: 40.3399, lng: 127.5101 },
  'United States': { lat: 37.0902, lng: -95.7129 }, 'Global': { lat: 0, lng: 0 },
};

const SEVERITY_COLOR = { 'INFO': '#22c55e', 'LOW': '#84cc16', 'MEDIUM': '#eab308', 'HIGH': '#f97316', 'CRITICAL': '#dc2626' };

function coordsFor(region) {
  if (!region) return null;
  for (const [key, val] of Object.entries(REGION_COORDS)) {
    if (region.toLowerCase().includes(key.toLowerCase())) return val;
  }
  return null;
}

async function loadEvents() {
  const candidates = ['gdelt-latest.json', 'gdelt.json', 'gdelt_news.json'];
  let raw = null, fileUsed = null;

  for (const f of candidates) {
    try {
      const content = await fs.readFile(join(BASKET_DIR, f), 'utf8');
      const parsed = JSON.parse(content);
      const arr = Array.isArray(parsed) ? parsed
        : Array.isArray(parsed.events) ? parsed.events
        : Array.isArray(parsed.articles) ? parsed.articles
        : Array.isArray(parsed.data) ? parsed.data
        : null;
      if (arr && arr.length > 0) { raw = arr; fileUsed = f; break; }
    } catch {}
  }

  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-gdelt.mjs'; throw err;
  }

  const clean = raw.map(r => {
    const region = r.region || r.country || 'Global';
    const c = coordsFor(region);
    const lat = Number(r.lat ?? r.latitude ?? c?.lat);
    const lng = Number(r.lng ?? r.lon ?? r.longitude ?? c?.lng);
    return {
      title: r.title || r.name || 'Unknown',
      description: r.description || r.text || null,
      region,
      lat: Number.isFinite(lat) ? lat : 0,
      lng: Number.isFinite(lng) ? lng : 0,
      severity: String(r.severity || 'INFO').toUpperCase(),
      date: String(r.date || r.timestamp || '').slice(0, 10),
      url: r.url || null,
      file: fileUsed,
    };
  });

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.region) { const x = String(query.region).toLowerCase(); r = r.filter(e => e.region.toLowerCase().includes(x)); }
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toUpperCase());
  if (query.since) r = r.filter(x => x.date >= String(query.since).slice(0, 10));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byRegion = {}, bySeverity = {};
  for (const r of rows) {
    byRegion[r.region] = (byRegion[r.region] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }
  const top_regions = Object.entries(byRegion).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([region, count]) => ({ region, count }));
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return { count: rows.length, date_from: dates[0] || null, date_to: dates[dates.length - 1] || null, by_region: byRegion, by_severity: bySeverity, top_regions };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      title: r.title, region: r.region, description: r.description,
      severity: r.severity, date: r.date, url: r.url,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.INFO,
      category: 'news', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: Object.entries(SEVERITY_COLOR).map(([severity, color]) => ({ severity, color })),
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
  const lines = ['title,region,severity,date,lat,lng'];
  for (const r of rows) lines.push(`"${r.title.replace(/"/g, '""')}",${r.region},${r.severity},${r.date},${r.lat},${r.lng}`);
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
    const extra = { 'X-Module': 'gdelt-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
