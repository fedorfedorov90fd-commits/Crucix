/**
 * apis/sources/botnets-api.mjs — API-МОДУЛЬ: БОТНЕТЫ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/botnets.json — массив { id, name, lat, lng, severity, timestamp }.
 * Сборщик: scripts/collectors/collect-botnets.mjs.
 *
 * Ботнеты и C2-инфраструктура. Источник — Feodo Tracker, AbuseIPDB, DShield.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'botnets.json');

export const route  = '/api/layers/botnets';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🤖',
  color: '#ff6600',
  vizType: 'marker',
  source: 'basket/botnets.json',
  collector: 'collect-botnets.mjs',
  cache: 300,
  description: 'Ботнеты и C2-инфраструктура',
  unit: 'bots',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

async function loadBotnets() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-botnets.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) arr = parsed.features;
  else if (parsed && Array.isArray(parsed.records)) arr = parsed.records;
  else if (parsed && Array.isArray(parsed.bots)) arr = parsed.bots;
  else if (parsed && Array.isArray(parsed.data))  arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    if (r && r.type === 'Feature') {
      const coords = r.geometry?.coordinates || [0, 0];
      const p = r.properties || {};
      return {
        id: p.id || r.id || 'unknown',
        name: p.name || 'Unknown',
        ip: p.ip || p.address || null,
        asn: p.asn || null,
        malware: p.malware || p.family || null,
        severity: String(p.severity || 'info').toLowerCase(),
        lat: Number(coords[1]), lng: Number(coords[0]),
        country: p.country || null,
        port: p.port != null ? Number(p.port) : null,
        status: p.status || 'active',
        firstSeen: p.firstSeen || null,
        lastSeen: p.lastSeen || p.timestamp || null,
      };
    }
    return {
      id: r.id || 'unknown',
      name: r.name || 'Unknown',
      ip: r.ip || r.address || null,
      asn: r.asn || null,
      malware: r.malware || r.family || null,
      severity: String(r.severity || 'info').toLowerCase(),
      lat: Number(r.lat ?? r.latitude),
      lng: Number(r.lng ?? r.lon ?? r.longitude),
      country: r.country || null,
      port: r.port != null ? Number(r.port) : null,
      status: r.status || 'active',
      firstSeen: r.firstSeen || null,
      lastSeen: r.lastSeen || r.timestamp || null,
    };
  }).filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  return clean;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.malware) { const m = String(query.malware).toLowerCase(); r = r.filter(x => (x.malware || '').toLowerCase().includes(m)); }
  if (query.country) { const c = String(query.country).toLowerCase(); r = r.filter(x => (x.country || '').toLowerCase().includes(c)); }
  if (query.asn) { const a = String(query.asn).toLowerCase(); r = r.filter(x => (x.asn || '').toLowerCase().includes(a)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q) || (x.ip || '').includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const bySeverity = {}, byMalware = {}, byCountry = {}, byAsn = {};
  for (const r of rows) {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.malware) byMalware[r.malware] = (byMalware[r.malware] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    if (r.asn) byAsn[r.asn] = (byAsn[r.asn] || 0) + 1;
  }
  const top_malware = Object.entries(byMalware).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_countries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_asn = Object.entries(byAsn).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  return { count: rows.length, by_severity: bySeverity, by_malware: byMalware, top_malware, top_countries, top_asn };
}

function toFeatureCollection(rows) {
  const features = rows.map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      id: r.id, name: r.name, ip: r.ip, asn: r.asn, malware: r.malware,
      severity: r.severity, country: r.country, port: r.port, status: r.status,
      firstSeen: r.firstSeen, lastSeen: r.lastSeen,
      color: SEVERITY_COLOR[r.severity] || SEVERITY_COLOR.info,
      category: 'cyber', icon: meta.icon,
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
    total_bots: full.length, returned_bots: filtered.length,
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
  const lines = ['id,name,ip,asn,malware,severity,country,port,status,lat,lng,lastSeen'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.ip || ''},${r.asn || ''},${r.malware || ''},${r.severity},${r.country || ''},${r.port ?? ''},${r.status},${r.lat},${r.lng},${r.lastSeen || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const full = await loadBotnets();
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'botnets-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

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
