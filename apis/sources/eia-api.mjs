/**
 * apis/sources/eia-api.mjs — API-МОДУЛЬ: ЭНЕРГЕТИКА EIA
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/eia.json — массив { country, energy, oil, lat, lng, region, timestamp }.
 * Сборщик: scripts/collectors/collect-eia-real.mjs.
 *
 * Данные US EIA: производство энергии и нефти по странам.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?min_energy=, ?min_oil=, ?country=, ?sort=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'eia.json');

export const route  = '/api/layers/eia';
export const method = 'GET';

export const meta = {
  category: 'energy',
  icon: '⛽',
  color: '#ff6600',
  vizType: 'marker',
  source: 'basket/eia.json',
  collector: 'collect-eia-real.mjs',
  cache: 3600,
  description: 'Энергетические данные EIA — производство энергии и нефти',
  unit: 'index',
};

function energyBand(value) {
  if (value >= 100) return { level: 'giant',    color: '#7f1d1d', label: 'Гигант' };
  if (value >= 70)  return { level: 'major',    color: '#dc2626', label: 'Крупный' };
  if (value >= 40)  return { level: 'moderate', color: '#f97316', label: 'Средний' };
  if (value >= 15)  return { level: 'small',    color: '#eab308', label: 'Малый' };
  return                   { level: 'minor',    color: '#22c55e', label: 'Незначительный' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-eia-real.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  else if (parsed && Array.isArray(parsed.prices)) arr = parsed.prices;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    country: r.country || r.name || 'Unknown',
    energy: Number(r.energy ?? r.production ?? 0),
    oil: Number(r.oil ?? r.oil_production ?? 0),
    lat: Number(r.lat ?? r.latitude),
    lng: Number(r.lng ?? r.lon ?? r.longitude),
    region: r.region || null,
    timestamp: r.timestamp || null,
  })).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.min_energy != null) { const n = parseFloat(query.min_energy); if (Number.isFinite(n)) r = r.filter(x => x.energy >= n); }
  if (query.min_oil != null)    { const n = parseFloat(query.min_oil);    if (Number.isFinite(n)) r = r.filter(x => x.oil >= n); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => x.country.toLowerCase().includes(c)); }
  if (query.region)  { const g = String(query.region).toLowerCase();  r = r.filter(x => (x.region || '').toLowerCase().includes(g)); }
  if (query.sort === 'energy') r.sort((a, b) => b.energy - a.energy);
  if (query.sort === 'oil')    r.sort((a, b) => b.oil - a.oil);
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const e = rows.map(r => r.energy);
  const o = rows.map(r => r.oil);
  const totalEnergy = e.reduce((a, b) => a + b, 0);
  const totalOil = o.reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = energyBand(r.energy).level; byBand[b] = (byBand[b] || 0) + 1; }
  const top_energy = rows.slice().sort((a, b) => b.energy - a.energy).slice(0, 5).map(r => ({ country: r.country, energy: r.energy }));
  const top_oil    = rows.slice().sort((a, b) => b.oil - a.oil).slice(0, 5).map(r => ({ country: r.country, oil: r.oil }));
  return { count: rows.length, total_energy: totalEnergy, total_oil: +totalOil.toFixed(2), avg_energy: +(totalEnergy / rows.length).toFixed(2), by_band: byBand, top_energy, top_oil };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => {
    const b = energyBand(r.energy);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        country: r.country,
        energy: r.energy,
        oil: r.oil,
        region: r.region,
        band: b.level,
        bandLabel: b.label,
        color: b.color,
        category: 'energy',
        icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'giant',    label: 'Гигант (100+)',       color: '#7f1d1d' },
      { level: 'major',    label: 'Крупный (70+)',       color: '#dc2626' },
      { level: 'moderate', label: 'Средний (40+)',       color: '#f97316' },
      { level: 'small',    label: 'Малый (15+)',         color: '#eab308' },
      { level: 'minor',    label: 'Незначительный',      color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    total_countries: full.length, returned_countries: filtered.length,
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
  const lines = ['country,energy,oil,region,lat,lng,band'];
  for (const r of rows) { const b = energyBand(r.energy); lines.push(`${r.country},${r.energy},${r.oil},${r.region || ''},${r.lat},${r.lng},${b.level}`); }
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadData();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'eia-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(full, rows),
      bands: fc.bands,
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
