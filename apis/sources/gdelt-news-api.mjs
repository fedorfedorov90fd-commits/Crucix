/**
 * apis/sources/gdelt-news-api.mjs — API-МОДУЛЬ: НОВОСТИ GDELT
 *
 * КОНТРАКТ CRUCIX v2.
 * ВЕРСИЯ 3.0.0 (18.09.2026). Переведён на basket-loader v2.0.0.
 *
 * ИСТОЧНИК: data/basket/gdelt.json (v1) или gdelt_news.json (legacy).
 * Сборщик: scripts/collectors/collect-gdelt.mjs.
 *
 * Читает через loadWithFallback: возвращает {data (v1), legacy (оригинал)}.
 * Для v1-формата — берёт points из data.points. Для legacy — из старого массива.
 *
 * ФОРМАТЫ: json (FeatureCollection + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?country=, ?source=, ?q=, ?since=, ?limit=, ?format=.
 */

import { loadWithFallback } from './lib/basket-loader.mjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR   = join(PROJECT_ROOT, 'data', 'basket');
const PRIMARY      = join(BASKET_DIR, 'gdelt.json');
const FALLBACK     = join(BASKET_DIR, 'gdelt_news.json');

export const route  = '/api/layers/gdelt-news';
export const method = 'GET';

export const meta = {
  category: 'news',
  icon: '📰',
  color: '#ec4899',
  vizType: 'marker',
  source: 'basket/gdelt.json',
  collector: 'scripts/collectors/collect-gdelt.mjs',
  cache: 300,
  description: 'Новости GDELT с геопривязкой',
  unit: 'articles',
};

const CACHE_TTL = 5 * 60 * 1000;
let cache = null, cacheTime = 0, cacheSource = null;

function normalizePoint(p, i) {
  if (!p || typeof p !== 'object') return null;
  const lat = Number(p.lat);
  const lng = Number(p.lon ?? p.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const extra = p.extra || {};
  const src = extra.domain || extra.source || extra.publisher || 'GDELT';
  return {
    id: extra.id || p.id || `gdelt-${i}`,
    title: p.label || extra.title || extra.name || 'News',
    description: extra.description || extra.summary || '',
    url: extra.url || null,
    source: src,
    country: p.region || extra.sourcecountry || null,
    lat, lng,
    date: p.timestamp ? String(p.timestamp).slice(0, 10) : (extra.seendate ? String(extra.seendate).slice(0, 10) : null),
    category: meta.category,
    icon: meta.icon,
    color: meta.color,
  };
}

function normalizeLegacyRecord(rec, i) {
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

  let loaded = await loadWithFallback({
    basketFile: PRIMARY,
    fallbackData: null,
    hint: 'run scripts/collectors/collect-gdelt.mjs'
  });

  if (loaded.source === 'fallback' || loaded.source === 'error') {
    loaded = await loadWithFallback({
      basketFile: FALLBACK,
      fallbackData: null,
      hint: 'run scripts/collectors/collect-gdelt.mjs'
    });
  }

  if (loaded.source === 'error' || (loaded.source === 'fallback' && !loaded.data)) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-gdelt.mjs'; throw err;
  }

  let list = [];
  const isV1 = loaded.source === 'basket-v1' && loaded.data && loaded.data.schema === 'crucix.basket.v1';

  if (isV1) {
    // Из v1 берём points. У GDELT-статей координат нет — они не попадут в points.
    // Поэтому если points пуст — используем legacy-массив (если он есть) как fallback.
    const v1Points = Array.isArray(loaded.data.points) ? loaded.data.points : [];
    if (v1Points.length > 0) {
      list = v1Points.map(normalizePoint).filter(Boolean);
    } else if (loaded.legacy && Array.isArray(loaded.legacy)) {
      list = loaded.legacy.map(normalizeLegacyRecord).filter(Boolean);
    } else if (loaded.legacy && typeof loaded.legacy === 'object') {
      const lr = loaded.legacy;
      const arr = Array.isArray(lr) ? lr
        : Array.isArray(lr.records) ? lr.records
        : Array.isArray(lr.data) ? lr.data
        : Array.isArray(lr.articles) ? lr.articles
        : [];
      list = arr.map(normalizeLegacyRecord).filter(Boolean);
    }
  } else {
    // Legacy-массив напрямую.
    const legacy = loaded.legacy ?? loaded.data;
    let arr = [];
    if (Array.isArray(legacy)) arr = legacy;
    else if (legacy && typeof legacy === 'object') {
      arr = Array.isArray(legacy.records) ? legacy.records
        : Array.isArray(legacy.data) ? legacy.data
        : Array.isArray(legacy.articles) ? legacy.articles
        : Array.isArray(legacy.features) ? legacy.features.map(f => ({ ...f.properties, lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0] }))
        : [];
    }
    list = arr.map(normalizeLegacyRecord).filter(Boolean);
  }

  cache = list;
  cacheTime = now;
  cacheSource = loaded.source;
  return cache;
}

export function __resetCache() { cache = null; cacheTime = 0; cacheSource = null; }
export function __getCacheSource() { return cacheSource; }

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
    top_countries: Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))
  };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, title: r.title, description: r.description, url: r.url,
      source: r.source, country: r.country, date: r.date,
      category: r.category, icon: r.icon, color: r.color
    }
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
    ...extra
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
      'X-Module-Version': '3.0.0',
      'X-Basket-Source': cacheSource || 'unknown',
      'Cache-Control': `public, max-age=${meta.cache}`
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
        generated_at: new Date().toISOString()
      },
      features: fc.features,
      series: toSeries(rows),
      stats: computeStats(rows)
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
