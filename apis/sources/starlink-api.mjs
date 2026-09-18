/**
 * apis/sources/starlink-api.mjs — API-МОДУЛЬ: STARLINK / ONEWEB
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/starlink.json — { success, data: { features: [...] } }.
 * Резервный: data/basket/oneweb.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-starlink.mjs.
 *
 * Спутниковые группировки Starlink (SpaceX) и OneWeb (Eutelsat). Ключ к глобальному интернету.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/starlink';
export const method = 'GET';

export const meta = {
  category: 'space',
  icon: '🛰️',
  color: '#00cc00',
  vizType: 'marker',
  source: 'basket/starlink.json',
  collector: 'collect-starlink.mjs',
  cache: 600,
  description: 'Спутниковые группировки Starlink (SpaceX) и OneWeb (Eutelsat)',
  unit: 'satellites',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadSatellites() {
  const files = ['starlink.json', 'oneweb.json'];
  const all = [];
  for (const f of files) {
    try {
      const raw = await fs.readFile(join(BASKET_DIR, f), 'utf8');
      const parsed = JSON.parse(raw);
      let arr = null;
      if (Array.isArray(parsed)) arr = parsed;
      else if (parsed && parsed.data && parsed.data.type === 'FeatureCollection' && Array.isArray(parsed.data.features)) arr = parsed.data.features;
      else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
      else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
      if (!arr) continue;
      const constellation = f === 'starlink.json' ? 'starlink' : 'oneweb';
      for (const r of arr) {
        if (r && r.type === 'Feature') {
          const coords = r.geometry?.coordinates || [0, 0];
          const p = r.properties || {};
          all.push({
            name: p.name || p.id || 'Unknown',
            constellation,
            status: p.status || 'active',
            severity: String(p.severity || 'info').toLowerCase(),
            lat: Number(coords[1]), lng: Number(coords[0]),
            orbit: p.orbit || null,
            timestamp: p.timestamp || null,
          });
        } else if (r) {
          all.push({
            name: r.name || r.id || 'Unknown',
            constellation,
            status: r.status || 'active',
            severity: String(r.severity || 'info').toLowerCase(),
            lat: Number(r.lat ?? r.latitude),
            lng: Number(r.lng ?? r.lon ?? r.longitude),
            orbit: r.orbit || null,
            timestamp: r.timestamp || null,
          });
        }
      }
    } catch (e) {
      if (e.code !== 'ENOENT') continue;
    }
  }

  const clean = all.filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
  if (clean.length === 0) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-starlink.mjs'; throw err;
  }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.constellation) r = r.filter(x => x.constellation === String(query.constellation).toLowerCase());
  if (query.status) r = r.filter(x => x.status.toLowerCase() === String(query.status).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byConstellation = {}, byStatus = {}, bySeverity = {};
  for (const r of rows) {
    byConstellation[r.constellation] = (byConstellation[r.constellation] || 0) + 1;
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  }
  return { count: rows.length, by_constellation: byConstellation, by_status: byStatus, by_severity: bySeverity };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      name: r.name, constellation: r.constellation, status: r.status, severity: r.severity,
      orbit: r.orbit, timestamp: r.timestamp,
      color: r.constellation === 'starlink' ? '#00cc00' : '#0066ff',
      icon: meta.icon,
      category: 'space',
    },
  }));
  return {
    type: 'FeatureCollection',
    constellations: [
      { id: 'starlink', label: 'Starlink (SpaceX)', color: '#00cc00' },
      { id: 'oneweb',   label: 'OneWeb (Eutelsat)', color: '#0066ff' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_satellites: full.length, returned_satellites: filtered.length,
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
  const lines = ['name,constellation,status,severity,orbit,lat,lng'];
  for (const r of rows) lines.push(`"${r.name.replace(/"/g, '""')}",${r.constellation},${r.status},${r.severity},${r.orbit || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadSatellites();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'starlink-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      constellations: fc.constellations,
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
