/**
 * apis/sources/gdelt-news-api.mjs — API-МОДУЛЬ: НОВОСТИ GDELT
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/gdelt_news.json (основной) + data/basket/gdelt.json (fallback).
 * Сборщик: scripts/collectors/collect-gdelt.mjs.
 *
 * Новости GDELT с геопривязкой. Каждая новость — точка на карте.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?source=, ?q=, ?since=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');
const PRIMARY      = join(BASKET_DIR, 'gdelt_news.json');
const FALLBACK     = join(BASKET_DIR, 'gdelt.json');

export const route  = '/api/layers/gdelt-news';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#ec4899',
  vizType: 'marker',
  source: 'basket/gdelt_news.json',
  collector: 'scripts/collectors/collect-gdelt.mjs',
  cache: 300,
  description: 'Новости GDELT с геопривязкой',
  unit: 'articles',
};

const CACHE_TTL = 5 * 60 * 1000;
let cache = null, cacheTime = 0;

function normalize(rec, i) {
  if (!rec || typeof rec !== 'object') return null;
  const lat = Number(rec.lat ?? rec.latitude);
  const lng = Number(rec.lng ?? rec.lon ?? rec.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: rec.id || `gdelt-${i}`,
    title: rec.title || rec.name || 'News',
    description: rec.description || rec.summary || '',
    url: rec.url || null,
    source: rec.source || rec.publisher || 'GDELT',
    country: rec.country || null,
    lat, lng,
    date: String(rec.timestamp || rec.date || '').slice(0, 10) || null,
    category: meta.category,
    icon: meta.icon,
    color: meta.color,
  };
}

async function loadData() {
  const now = Date.now();
  if (cache && (now - cacheTime) < CACHE_TTL) return cache;

  let raw = null;
  for (const p of [PRIMARY, FALLBACK]) {
    try { raw = JSON.parse(await fs.readFile(p, 'utf8')); break; }
    catch { /* следующий */ }
  }

  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-gdelt.mjs'; throw err;
  }

  let list = [];
  if (Array.isArray(raw)) list = raw;
  else if (Array.isArray(raw.records)) list = raw.records;
  else if (Array.isArray(raw.data)) list = raw.data;
  else if (Array.isArray(raw.articles)) list = raw.articles;
  else if (Array.isArray(raw.features)) list = raw.features.map(f => ({
    ...f.properties,
    lat: f.geometry?.coordinates?.[1],
    lng: f.geometry?.coordinates?.[0],
  }));

  cache = list.map(normalize).filter(Boolean);
  cacheTime = now;
  return cache;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.country) r = r.filter(x => (x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.source)  r = r.filter(x => (x.source || '').toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.q)       r = r.filter(x => (x.title + ' ' + x.description).toLowerCase().includes(String(query.q).toLowerCase()));
  if (query.since)   r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const bySource = {};
  const byCountry = {};
  for (const r of rows) {
    bySource[r.source] = (bySource[r.source] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
  }
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    top_sources: Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
    top_countries: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count })),
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, title: r.title, description: r.description, url: r.url,
      source: r.source, country: r.country, date: r.date,
      category: r.category, icon: r.icon, color: r.color,
    },
  }));
  return { type: 'FeatureCollection', features, meta: { total: rows.length } };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, title: r.title, source: r.source, country: r.country, date: r.date }));
}

function toCSV(rows) {
  const lines = ['id,title,source,country,date,lat,lng,url'];
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.title, r.source, r.country, r.date, r.lat, r.lng, r.url].map(esc).join(','));
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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/gdelt-news/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const extra = {
      'X-Module': 'gdelt-news-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(rows), meta: { total: full.length, returned: rows.length } }, extra);
    }
    if (sub === '/featurecollection') return sendJSON(res, 200, toFeatureCollection(rows), extra);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: full.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_articles: full.length,
        returned_articles: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
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
