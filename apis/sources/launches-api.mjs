/**
 * apis/sources/launches-api.mjs — API-МОДУЛЬ: КОСМИЧЕСКИЕ ЗАПУСКИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/launches-upcoming.json — { source, updated, count, launches: [{ id, name, net, status }] }.
 * Резервный: data/basket/space-track-latest.json — { objects: [...] }.
 * Сборщик: scripts/collectors/collect-launches.mjs.
 *
 * Предстоящие космические запуски по данным LaunchLibrary2.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/launches';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🚀',
  color: '#ff44aa',
  vizType: 'marker',
  source: 'basket/launches-upcoming.json',
  collector: 'collect-launches.mjs',
  cache: 600,
  description: 'Предстоящие космические запуски (LaunchLibrary2)',
  unit: 'launches',
};

const LAUNCH_SITES = {
  'Cape Canaveral':   { lat: 28.3922, lng: -80.6077, country: 'USA' },
  'Kennedy':          { lat: 28.5729, lng: -80.6490, country: 'USA' },
  'Vandenberg':       { lat: 34.7420, lng: -120.5724, country: 'USA' },
  'Starbase':         { lat: 25.9970, lng: -97.1552, country: 'USA' },
  'Baikonur':         { lat: 45.9650, lng: 63.3050, country: 'Kazakhstan' },
  'Plesetsk':         { lat: 62.9256, lng: 40.5775, country: 'Russia' },
  'Vostochny':        { lat: 51.8840, lng: 128.3340, country: 'Russia' },
  'Kourou':           { lat: 5.2322, lng: -52.7695, country: 'French Guiana' },
  'Wenchang':         { lat: 19.6144, lng: 110.9510, country: 'China' },
  'Jiuquan':          { lat: 40.9606, lng: 100.2983, country: 'China' },
  'Xichang':          { lat: 28.2460, lng: 102.0260, country: 'China' },
  'Tanegashima':      { lat: 30.4000, lng: 130.9700, country: 'Japan' },
  'Sriharikota':      { lat: 13.7200, lng: 80.2300, country: 'India' },
  'Mahia':            { lat: -39.2600, lng: 177.8600, country: 'New Zealand' },
  'Unknown':          { lat: 28.3922, lng: -80.6077, country: 'Unknown' },
};

function detectSite(name) {
  if (!name) return LAUNCH_SITES.Unknown;
  for (const [key, coords] of Object.entries(LAUNCH_SITES)) {
    if (key === 'Unknown') continue;
    if (name.toLowerCase().includes(key.toLowerCase())) return coords;
  }
  return LAUNCH_SITES.Unknown;
}

async function loadLaunches() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['launches-upcoming.json', 'space-track-latest.json']) {
    try {
      raw = await fs.readFile(join(BASKET_DIR, f), 'utf8');
      parsed = JSON.parse(raw);
      fileUsed = f;
      break;
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
    }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-launches.mjs'; throw err;
  }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.launches)) arr = parsed.launches;
  else if (parsed && Array.isArray(parsed.objects))  arr = parsed.objects;
  else if (parsed && Array.isArray(parsed.data))     arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const name = r.name || 'Unknown launch';
    const site = detectSite(name);
    return {
      id: r.id || 'unknown',
      name,
      net: r.net || r.date || null,
      status: r.status || 'Unknown',
      rocket: r.rocket || null,
      provider: r.provider || r.launch_service_provider || null,
      country: r.country || site.country,
      lat: Number(r.lat ?? site.lat),
      lng: Number(r.lng ?? r.lon ?? site.lng),
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return { launches: clean, fileUsed, parsedMeta: { source: parsed.source, updated: parsed.updated } };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.status) r = r.filter(x => x.status.toLowerCase() === String(query.status).toLowerCase());
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.provider) { const p = String(query.provider).toLowerCase(); r = r.filter(x => (x.provider || '').toLowerCase().includes(p)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.since) r = r.filter(x => (x.net || '') >= String(query.since));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byStatus = {}, byCountry = {}, byProvider = {};
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.provider) byProvider[r.provider] = (byProvider[r.provider] || 0) + 1;
  }
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_status: byStatus, by_country: byCountry, top_countries };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, net: r.net, status: r.status, rocket: r.rocket, provider: r.provider,
      country: r.country,
      color: r.status === 'Go' ? '#22c55e' : r.status === 'TBD' ? '#eab308' : '#dc2626',
      category: 'space', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    sites: Object.entries(LAUNCH_SITES).filter(([k]) => k !== 'Unknown').map(([k, v]) => ({ name: k, ...v })),
    features,
  };
}

function envelopeMeta(full, filtered, parsedMeta) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_source: parsedMeta.source,
    basket_updated: parsedMeta.updated,
    total_launches: full.length, returned_launches: filtered.length,
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
  const lines = ['id,name,net,status,rocket,provider,country,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.net || ''},${r.status},${r.rocket || ''},${r.provider || ''},${r.country || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadLaunches();
    const rows = applyFilters(loaded.launches, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'launches-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.launches, rows, loaded.parsedMeta) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.launches, rows, loaded.parsedMeta) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.launches, rows, loaded.parsedMeta),
      sites: fc.sites,
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
