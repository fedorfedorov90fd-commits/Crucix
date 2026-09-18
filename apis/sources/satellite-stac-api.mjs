/**
 * apis/sources/satellite-stac-api.mjs — API-МОДУЛЬ: SPATIOTEMPORAL ASSET CATALOG (STAC)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/satellite-stac.json — { collections:[{ id, title, description, keywords[], license, providers[] }], items:[{ id, collection, bbox:[w,s,e,n], datetime, cloud_cover, platform, instruments[], assets:{}, properties:{} }] } ИЛИ { data:[...] } ИЛИ массив items.
 * Сборщик: scripts/collectors/collect-satellite-stac.mjs.
 *
 * STAC (SpatioTemporal Asset Catalog) — стандарт описания спутниковых снимков.
 * Реестр коллекций (Sentinel-2, Landsat-8, MODIS) и их снимков (items) с bbox,
 * datetime, облачностью, платформой, инструментами.
 *
 * ФОРМАТЫ: json (FC + items + stats), csv, series, stats, raw, geojson.
 * ФИЛЬТРЫ: ?collection=, ?platform=, ?min_cloud=, ?max_cloud=, ?since=, ?until=, ?bbox=, ?q=, ?limit=, ?top=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                    — корень (список эндпоинтов)
 *   GET /stats               — агрегированная статистика
 *   GET /status              — health-check
 *   GET /collections         — список STAC-коллекций
 *   GET /items               — список items (снимков)
 *   GET /items/:id           — конкретный item
 *   GET /platforms           — группировка по платформам
 *   GET /cloud               — распределение по облачности
 *   GET /timeline            — динамика по датам
 *   GET /footprints          — bbox-фигуры для отображения
 *   GET /low-cloud           — снимки с облачностью < 10%
 *   GET /featurecollection   — GeoJSON (центроиды bbox)
 *   GET /render              — рендер-конфиг (bbox + centroids)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'satellite-stac.json');

export const route  = '/api/layers/satellite-stac';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🛰️',
  color: '#0891b2',
  vizType: 'marker',
  source: 'basket/satellite-stac.json',
  collector: 'collect-satellite-stac.mjs',
  cache: 300,
  description: 'STAC-каталог: коллекции спутниковых снимков (Sentinel-2, Landsat-8, MODIS)',
  unit: 'items',
};

// Известные коллекции STAC (fallback-описания)
const KNOWN_COLLECTIONS = {
  'sentinel-2': { title: 'Sentinel-2', color: '#22c55e', platform: 'Sentinel-2A/B', instruments: ['MSI'], resolution_m: 10, provider: 'ESA' },
  'landsat-8':  { title: 'Landsat-8',  color: '#0891b2', platform: 'Landsat-8',    instruments: ['OLI', 'TIRS'], resolution_m: 30, provider: 'USGS/NASA' },
  'landsat-9':  { title: 'Landsat-9',  color: '#06b6d4', platform: 'Landsat-9',    instruments: ['OLI-2', 'TIRS-2'], resolution_m: 30, provider: 'USGS/NASA' },
  'modis':      { title: 'MODIS',      color: '#eab308', platform: 'Terra/Aqua',   instruments: ['MODIS'], resolution_m: 250, provider: 'NASA' },
  'sentinel-1': { title: 'Sentinel-1', color: '#a855f7', platform: 'Sentinel-1A/B', instruments: ['C-SAR'], resolution_m: 20, provider: 'ESA' },
  'viirs':      { title: 'VIIRS',      color: '#f97316', platform: 'Suomi NPP/NOAA-20', instruments: ['VIIRS'], resolution_m: 750, provider: 'NOAA/NASA' },
};

const CLOUD_TIERS = {
  clear:    { min: 0,  max: 10, color: '#22c55e', label: 'Ясно' },
  light:    { min: 10, max: 30, color: '#84cc16', label: 'Малооблачно' },
  moderate: { min: 30, max: 60, color: '#eab308', label: 'Облачно' },
  heavy:    { min: 60, max: 80, color: '#f97316', label: 'Сильная облачность' },
  overcast: { min: 80, max: 101, color: '#dc2626', label: 'Сплошной покров' },
};

function cloudTier(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(CLOUD_TIERS)) {
    if (n >= def.min && n < def.max) return { key: k, color: def.color, label: def.label };
  }
  return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
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
      err.hint = 'run scripts/collectors/collect-satellite-stac.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractDoc(doc) {
  let collections = [];
  let items = [];
  let source = null;
  let meta = null;

  if (Array.isArray(doc)) items = doc;
  else if (doc && typeof doc === 'object') {
    if (Array.isArray(doc.collections)) collections = doc.collections;
    if (Array.isArray(doc.items)) items = doc.items;
    if (Array.isArray(doc.data)) items = doc.data;
    source = doc.source || null;
    meta = doc.meta || null;
  }
  return { collections, items, source, meta };
}

// ============================================================
//  НОРМАЛИЗАЦИЯ
// ============================================================

function normalizeCollection(c, i) {
  const id = String(c.id || `collection-${i}`).toLowerCase();
  const known = KNOWN_COLLECTIONS[id] || {};
  return {
    id,
    title: c.title || known.title || id,
    description: c.description || null,
    keywords: Array.isArray(c.keywords) ? c.keywords : [],
    license: c.license || null,
    providers: Array.isArray(c.providers) ? c.providers : (known.provider ? [known.provider] : []),
    platform: known.platform || null,
    instruments: known.instruments || [],
    resolution_m: known.resolution_m || null,
    color: known.color || '#64748b',
    items_count: 0,
  };
}

function bboxCentroid(bbox) {
  if (!Array.isArray(bbox) || bbox.length < 4) return { lat: null, lng: null };
  const [w, s, e, n] = bbox.map(Number);
  if (![w, s, e, n].every(Number.isFinite)) return { lat: null, lng: null };
  return { lat: (s + n) / 2, lng: (w + e) / 2 };
}

function normalizeItem(it, i) {
  const id = String(it.id || `item-${i}`);
  const collection = String(it.collection || '').toLowerCase() || null;
  const bbox = Array.isArray(it.bbox) ? it.bbox.map(Number) : null;
  const centroid = bboxCentroid(bbox);
  const cloud = it.cloud_cover != null ? Number(it.cloud_cover)
    : (it.properties?.eo?.cloud_cover != null ? Number(it.properties.eo.cloud_cover) : null);
  const ct = cloudTier(cloud);
  const known = KNOWN_COLLECTIONS[collection] || {};
  const platform = it.platform || it.properties?.platform || known.platform || null;
  const datetime = String(it.datetime || it.properties?.datetime || it.date || '').slice(0, 19) || null;
  const dateShort = datetime ? datetime.slice(0, 10) : null;

  return {
    id,
    collection,
    collectionTitle: known.title || collection || 'Unknown',
    collectionColor: known.color || '#64748b',
    bbox,
    lat: centroid.lat,
    lng: centroid.lng,
    datetime,
    date: dateShort,
    cloud_cover: Number.isFinite(cloud) ? Number(cloud.toFixed(2)) : null,
    cloudTier: ct.key,
    cloudTierLabel: ct.label,
    cloudColor: ct.color,
    platform,
    instruments: Array.isArray(it.instruments) ? it.instruments
      : (Array.isArray(it.properties?.instruments) ? it.properties.instruments : (known.instruments || [])),
    resolution_m: known.resolution_m || null,
    provider: it.provider || known.provider || null,
    assets_count: it.assets && typeof it.assets === 'object' ? Object.keys(it.assets).length : 0,
    asset_keys: it.assets ? Object.keys(it.assets) : [],
    properties: it.properties || null,
    category: 'space',
    icon: meta.icon,
  };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.collection) r = r.filter(x => String(x.collection).toLowerCase() === String(query.collection).toLowerCase());
  if (query.platform)   r = r.filter(x => String(x.platform || '').toLowerCase().includes(String(query.platform).toLowerCase()));
  if (query.instrument) r = r.filter(x => x.instruments.some(i => String(i).toLowerCase().includes(String(query.instrument).toLowerCase())));
  if (query.provider)   r = r.filter(x => String(x.provider || '').toLowerCase().includes(String(query.provider).toLowerCase()));
  if (query.q) {
    const q = String(query.q).toLowerCase();
    r = r.filter(x => (x.id + ' ' + x.collection + ' ' + (x.platform || '')).toLowerCase().includes(q));
  }
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min_cloud != null) { const n = Number(query.min_cloud); if (Number.isFinite(n)) r = r.filter(x => x.cloud_cover != null && x.cloud_cover >= n); }
  if (query.max_cloud != null) { const n = Number(query.max_cloud); if (Number.isFinite(n)) r = r.filter(x => x.cloud_cover != null && x.cloud_cover <= n); }
  if (query.cloud_tier) r = r.filter(x => x.cloudTier === String(query.cloud_tier));

  // bbox: ?bbox=w,s,e,n — пересечение
  if (query.bbox) {
    const [w, s, e, n] = String(query.bbox).split(',').map(Number);
    if ([w, s, e, n].every(Number.isFinite)) {
      r = r.filter(x => {
        if (!x.bbox || x.bbox.length < 4) return false;
        const [xw, xs, xe, xn] = x.bbox;
        return !(xe < w || xw > e || xn < s || xs > n);
      });
    }
  }

  const sortKey = query.sort;
  if (sortKey === 'cloud-asc')   r.sort((a, b) => (a.cloud_cover ?? 999) - (b.cloud_cover ?? 999));
  else if (sortKey === 'cloud-desc') r.sort((a, b) => (b.cloud_cover ?? -1) - (a.cloud_cover ?? -1));
  else if (sortKey === 'date-desc')  r.sort((a, b) => String(b.datetime || '').localeCompare(String(a.datetime || '')));
  else if (sortKey === 'date-asc')   r.sort((a, b) => String(a.datetime || '').localeCompare(String(b.datetime || '')));
  else if (sortKey === 'id')         r.sort((a, b) => a.id.localeCompare(b.id));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows, collections) {
  const byCollection = {};
  const byPlatform = {};
  const byCloudTier = {};
  const clouds = [];
  const dates = [];

  for (const r of rows) {
    if (r.collection) byCollection[r.collection] = (byCollection[r.collection] || 0) + 1;
    if (r.platform) byPlatform[r.platform] = (byPlatform[r.platform] || 0) + 1;
    byCloudTier[r.cloudTier] = (byCloudTier[r.cloudTier] || 0) + 1;
    if (r.cloud_cover != null) clouds.push(r.cloud_cover);
    if (r.date) dates.push(r.date);
  }

  const top = (obj, n = 15) => Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));

  return {
    items_count: rows.length,
    collections_count: collections.length,
    with_bbox: rows.filter(r => Array.isArray(r.bbox) && r.bbox.length === 4).length,
    with_cloud: clouds.length,
    by_collection: byCollection,
    by_platform: byPlatform,
    by_cloud_tier: byCloudTier,
    top_platforms: top(byPlatform, 15),
    top_collections: top(byCollection, 15),
    cloud: clouds.length ? {
      mean: Number((clouds.reduce((a, b) => a + b, 0) / clouds.length).toFixed(2)),
      min: Number(Math.min(...clouds).toFixed(2)),
      max: Number(Math.max(...clouds).toFixed(2)),
    } : null,
    date_from: dates.sort()[0] || null,
    date_to: dates.sort().slice(-1)[0] || null,
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function computeCloudDistribution(rows, step = 20) {
  const buckets = [];
  for (let i = 0; i < 100; i += step) {
    const key = `${i}-${Math.min(100, i + step)}`;
    const items = rows.filter(r => r.cloud_cover != null && r.cloud_cover >= i && r.cloud_cover < Math.min(100, i + step));
    buckets.push({
      range: [i, Math.min(100, i + step)],
      count: items.length,
      tier: cloudTier(i + step / 2).key,
      color: cloudTier(i + step / 2).color,
    });
  }
  return buckets;
}

function computeTimeline(rows) {
  const byDate = {};
  for (const r of rows) {
    if (!r.date) continue;
    if (!byDate[r.date]) byDate[r.date] = { date: r.date, count: 0, by_collection: {} };
    byDate[r.date].count++;
    if (r.collection) byDate[r.date].by_collection[r.collection] = (byDate[r.date].by_collection[r.collection] || 0) + 1;
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

function extractFootprints(rows) {
  return rows
    .filter(r => Array.isArray(r.bbox) && r.bbox.length === 4)
    .map(r => ({
      id: r.id,
      collection: r.collection,
      bbox: r.bbox,
      polygon: [
        [r.bbox[0], r.bbox[1]],
        [r.bbox[2], r.bbox[1]],
        [r.bbox[2], r.bbox[3]],
        [r.bbox[0], r.bbox[3]],
        [r.bbox[0], r.bbox[1]],
      ],
      centroid: [r.lng, r.lat],
      cloud_cover: r.cloud_cover,
      color: r.collectionColor,
      datetime: r.datetime,
    }));
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = [];
  for (const r of rows) {
    if (!Array.isArray(r.bbox) || r.bbox.length !== 4) continue;
    const [w, s, e, n] = r.bbox;
    // Polygon bbox
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[w, s], [e, s], [e, n], [w, n], [w, s]]],
      },
      properties: {
        id: r.id, kind: 'bbox', collection: r.collection,
        platform: r.platform, cloud_cover: r.cloud_cover,
        datetime: r.datetime, color: r.collectionColor,
        category: 'space', icon: meta.icon,
      },
    });
    // Centroid
    if (r.lat != null && r.lng != null) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
        properties: {
          id: `${r.id}-centroid`, kind: 'centroid', collection: r.collection,
          platform: r.platform, cloud_cover: r.cloud_cover,
          datetime: r.datetime, color: r.collectionColor,
          category: 'space', icon: meta.icon,
        },
      });
    }
  }
  return {
    type: 'FeatureCollection',
    features,
    legend: {
      collections: Object.entries(KNOWN_COLLECTIONS).map(([key, def]) => ({ key, ...def })),
      clouds: Object.entries(CLOUD_TIERS).map(([key, def]) => ({ key, ...def })),
    },
    meta: { total: rows.length, features: features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    id: r.id, collection: r.collection, platform: r.platform,
    datetime: r.datetime, cloud_cover: r.cloud_cover,
    lat: r.lat, lng: r.lng, resolution_m: r.resolution_m,
  }));
}

function toCSV(rows) {
  const lines = ['id,collection,platform,datetime,cloud_cover,lat,lng,resolution_m,assets'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    lines.push([r.id, r.collection, r.platform, r.datetime, r.cloud_cover, r.lat, r.lng, r.resolution_m, r.assets_count].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toGeoJSON(rows) {
  return JSON.stringify(toFeatureCollection(rows));
}

function toRenderConfig(rows) {
  const footprints = extractFootprints(rows);
  const byCollection = {};
  for (const f of footprints) byCollection[f.collection] = (byCollection[f.collection] || 0) + 1;
  return {
    footprints,
    by_collection: byCollection,
    collections: Object.entries(KNOWN_COLLECTIONS).map(([key, def]) => ({ key, ...def })),
    filterable: ['collection', 'platform', 'cloud_cover', 'date'],
    totals: { footprints: footprints.length },
  };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/satellite-stac/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { collections: rawColls, items: rawItems, source, meta: srcMeta } = extractDoc(doc);
    const collections = rawColls.map(normalizeCollection);
    const items = rawItems.map(normalizeItem);

    // Заполним items_count у коллекций
    for (const c of collections) {
      c.items_count = items.filter(it => it.collection === c.id).length;
    }

    const extra = {
      'X-Module': 'satellite-stac-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(items, collections), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online',
        collections: collections.length,
        items: items.length,
        source,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/collections') {
      return sendJSON(res, 200, { collections, total: collections.length }, extra);
    }
    if (sub === '/items') {
      const rows = applyFilters(items, query);
      return sendJSON(res, 200, { items: rows, total: rows.length, all: items.length }, extra);
    }
    if (sub.startsWith('/items/')) {
      const id = decodeURIComponent(sub.slice('/items/'.length));
      const item = items.find(x => x.id === id);
      if (!item) { const e = new Error('item_not_found'); e.statusCode = 404; e.id = id; throw e; }
      return sendJSON(res, 200, { item }, extra);
    }
    if (sub === '/platforms') {
      const byPlatform = {};
      for (const r of items) {
        const p = r.platform || 'unknown';
        if (!byPlatform[p]) byPlatform[p] = { platform: p, count: 0, collections: {}, instruments: new Set() };
        byPlatform[p].count++;
        if (r.collection) byPlatform[p].collections[r.collection] = (byPlatform[p].collections[r.collection] || 0) + 1;
        for (const i of r.instruments) byPlatform[p].instruments.add(i);
      }
      const result = Object.values(byPlatform).map(x => ({
        platform: x.platform, count: x.count, collections: x.collections,
        instruments: [...x.instruments],
      })).sort((a, b) => b.count - a.count);
      return sendJSON(res, 200, { platforms: result, total: result.length }, extra);
    }
    if (sub === '/cloud') {
      const step = parseInt(query.step, 10) || 20;
      return sendJSON(res, 200, { distribution: computeCloudDistribution(items, step) }, extra);
    }
    if (sub === '/timeline') {
      const timeline = computeTimeline(items);
      return sendJSON(res, 200, { timeline, days: timeline.length }, extra);
    }
    if (sub === '/footprints') {
      const rows = applyFilters(items, query);
      return sendJSON(res, 200, { footprints: extractFootprints(rows), total: rows.length }, extra);
    }
    if (sub === '/low-cloud') {
      const threshold = Number(query.max_cloud) || 10;
      const rows = items.filter(r => r.cloud_cover != null && r.cloud_cover <= threshold);
      return sendJSON(res, 200, { items: rows, threshold, count: rows.length }, extra);
    }
    if (sub === '/featurecollection' || format === 'geojson') {
      const rows = applyFilters(items, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(items, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(items, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, collections, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        upstream_source: source,
        upstream_meta: srcMeta,
        total_items: items.length,
        returned_items: rows.length,
        total_collections: collections.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      collections,
      series: toSeries(rows),
      stats: computeStats(rows, collections),
      cloud_distribution: computeCloudDistribution(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    if (e.id)   payload.id = e.id;
    try { sendJSON(res, status, payload); } catch {}
  }
}
