/**
 * apis/sources/ofac-sdn-api.mjs — API-МОДУЛЬ: САНКЦИОННЫЙ СПИСОК OFAC SDN
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/ofac-sdn.json — массив { id, name, type, aliases[], addresses[], cryptoAddresses[], imo, mmsi, programs[], sanctions }.
 * Сборщик: scripts/collectors/collect-ofac-sdn.mjs.
 *
 * Санкционный список США OFAC SDN. Поиск, проверка, статистика.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?q=, ?type=, ?program=, ?country=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'ofac-sdn.json');

export const route  = '/api/layers/ofac-sdn';
export const method = 'GET';

export const meta = {
  category: 'geopolitical',
  icon: '🚫',
  color: '#dc2626',
  vizType: 'marker',
  source: 'basket/ofac-sdn.json',
  collector: 'scripts/collectors/collect-ofac-sdn.mjs',
  cache: 300,
  description: 'Санкционный список OFAC SDN: лица, организации, суда',
  unit: 'entries',
};

const TYPE_COLORS = {
  individual:    '#dc2626',
  entity:        '#f97316',
  vessel:        '#0ea5e9',
  aircraft:      '#a855f7',
  organization:  '#eab308',
  unknown:       '#64748b',
};

function typeColor(t) {
  return TYPE_COLORS[String(t || '').toLowerCase()] || TYPE_COLORS.unknown;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-ofac-sdn.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.entries)) return parsed.entries;
  if (parsed && Array.isArray(parsed.data)) return parsed.data;
  const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err;
}

function normalize(entry, i) {
  const addresses = Array.isArray(entry.addresses) ? entry.addresses : [];
  const cryptoAddresses = Array.isArray(entry.cryptoAddresses) ? entry.cryptoAddresses : [];
  const programs = Array.isArray(entry.programs) ? entry.programs : (entry.program ? [entry.program] : []);
  const country = addresses[0]?.country || entry.country || null;
  const lat = Number(entry.lat ?? entry.latitude);
  const lng = Number(entry.lng ?? entry.lon ?? entry.longitude);
  return {
    id: entry.id || entry.uid || `ofac-${i}`,
    name: entry.name || 'Unknown',
    type: String(entry.type || entry.entityType || 'unknown').toLowerCase(),
    color: typeColor(entry.type || entry.entityType),
    aliases: Array.isArray(entry.aliases) ? entry.aliases : [],
    addresses,
    cryptoAddresses,
    imo: entry.imo || null,
    mmsi: entry.mmsi || null,
    programs,
    sanctions: entry.sanctions || null,
    country,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
  };
}

function matches(entry, q) {
  if (!q) return true;
  const s = String(q).toLowerCase();
  if (entry.name.toLowerCase().includes(s)) return true;
  if (entry.aliases.some(a => String(a).toLowerCase().includes(s))) return true;
  if (entry.addresses.some(a => (a.address || '').toLowerCase().includes(s) || (a.country || '').toLowerCase().includes(s))) return true;
  if (entry.cryptoAddresses.some(c => String(c.address || '').toLowerCase().includes(s))) return true;
  if (entry.imo && String(entry.imo) === q) return true;
  if (entry.mmsi && String(entry.mmsi) === q) return true;
  if (entry.programs.some(p => String(p).toLowerCase().includes(s))) return true;
  return false;
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.q)       r = r.filter(x => matches(x, query.q));
  if (query.type)    r = r.filter(x => x.type === String(query.type).toLowerCase());
  if (query.program) r = r.filter(x => x.programs.some(p => String(p).toLowerCase().includes(String(query.program).toLowerCase())));
  if (query.country) r = r.filter(x => String(x.country || '').toLowerCase().includes(String(query.country).toLowerCase()));
  if (query.limit)   { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  const byType = {};
  const byCountry = {};
  const byProgram = {};
  let cryptoCount = 0;
  for (const r of rows) {
    byType[r.type] = (byType[r.type] || 0) + 1;
    if (r.country) byCountry[r.country] = (byCountry[r.country] || 0) + 1;
    for (const p of r.programs) byProgram[p] = (byProgram[p] || 0) + 1;
    if (r.cryptoAddresses.length > 0) cryptoCount++;
  }
  return { count: rows.length, by_type: byType, by_country: byCountry, by_program: byProgram, with_crypto: cryptoCount };
}

function toFeatureCollection(rows) {
  const features = rows
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, type: r.type, country: r.country, programs: r.programs,
        color: r.color, category: meta.category, icon: meta.icon,
      },
    }));
  return { type: 'FeatureCollection', features, meta: { total: rows.length, mapped: features.length } };
}

function toSeries(rows) {
  return rows.map(r => ({ id: r.id, name: r.name, type: r.type, country: r.country, programs: r.programs }));
}

function toCSV(rows) {
  const lines = ['id,name,type,country,imo,mmsi,programs'];
  const esc = (v) => {
    if (v == null) return '';
    const s = Array.isArray(v) ? v.join('|') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  for (const r of rows) lines.push([r.id, r.name, r.type, r.country, r.imo, r.mmsi, r.programs].map(esc).join(','));
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
    const sub = urlObj.pathname.replace(/^\/api\/layers\/ofac-sdn/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const raw = await loadData();
    const all = raw.map(normalize);
    const extra = {
      'X-Module': 'ofac-sdn-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/search') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, { query: query.q || null, results: rows, total: rows.length }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(all, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, meta: { total: all.length } }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        total_entries: all.length,
        returned_entries: rows.length,
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
