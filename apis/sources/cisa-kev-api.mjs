/**
 * apis/sources/cisa-kev-api.mjs — API-МОДУЛЬ: CISA KEV
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/cisa-kev.json — { source, updated, total, recent: [{ cveID, vendorProject, product, vulnerabilityName, dateAdded, shortDescription }] }.
 * Сборщик: scripts/collectors/collect-cisa-kev.mjs.
 *
 * CISA Known Exploited Vulnerabilities — уязвимости, используемые в атаках.
 * Только те, для которых есть подтверждённые эксплойты.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'cisa-kev.json');

export const route  = '/api/layers/cisa-kev';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🛡️',
  color: '#ff0066',
  vizType: 'marker',
  source: 'basket/cisa-kev.json',
  collector: 'collect-cisa-kev.mjs',
  cache: 3600,
  description: 'CISA KEV — уязвимости, используемые в атаках (подтверждённые эксплойты)',
  unit: 'CVEs',
};

async function loadKEV() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-cisa-kev.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.recent)) arr = parsed.recent;
  else if (parsed && Array.isArray(parsed.vulnerabilities)) arr = parsed.vulnerabilities;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => ({
    cveID: r.cveID || r.cveId || r.id || 'unknown',
    vendor: r.vendorProject || r.vendor || null,
    product: r.product || null,
    name: r.vulnerabilityName || r.name || 'Unknown',
    description: r.shortDescription || r.description || '',
    dateAdded: r.dateAdded || r.published || null,
    dueDate: r.dueDate || null,
    action: r.requiredAction || null,
    ransomwareUse: r.knownRansomwareCampaignUse || null,
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
  })).filter(r => r.cveID !== 'unknown');

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''));
  return { kev: clean, rawMeta: { source: parsed.source, updated: parsed.updated, total: parsed.total } };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.vendor) { const v = String(query.vendor).toLowerCase(); r = r.filter(x => (x.vendor || '').toLowerCase().includes(v)); }
  if (query.product) { const p = String(query.product).toLowerCase(); r = r.filter(x => (x.product || '').toLowerCase().includes(p)); }
  if (query.ransomware) r = r.filter(x => (x.ransomwareUse || '').toLowerCase() === 'known');
  if (query.since) r = r.filter(x => (x.dateAdded || '') >= String(query.since));
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.cveID.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byVendor = {}, byProduct = {};
  let ransomwareCount = 0;
  for (const r of rows) {
    if (r.vendor) byVendor[r.vendor] = (byVendor[r.vendor] || 0) + 1;
    if (r.product) byProduct[r.product] = (byProduct[r.product] || 0) + 1;
    if ((r.ransomwareUse || '').toLowerCase() === 'known') ransomwareCount++;
  }
  const top_vendors = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const dates = rows.map(r => r.dateAdded).filter(Boolean).sort();
  return {
    count: rows.length,
    with_ransomware: ransomwareCount,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    by_vendor: byVendor,
    top_vendors,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
    properties: {
      cveID: r.cveID, vendor: r.vendor, product: r.product, name: r.name,
      description: r.description, dateAdded: r.dateAdded, dueDate: r.dueDate,
      ransomwareUse: r.ransomwareUse, action: r.action,
      color: (r.ransomwareUse || '').toLowerCase() === 'known' ? '#7f1d1d' : '#ff0066',
      category: 'cyber', icon: meta.icon,
    },
  }));
  return {
    type: 'FeatureCollection',
    legend: [
      { level: 'ransomware_known', label: 'Ransomware Known', color: '#7f1d1d' },
      { level: 'regular',          label: 'KEV',              color: '#ff0066' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, rawMeta) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_source: rawMeta.source,
    basket_updated: rawMeta.updated,
    basket_total: rawMeta.total,
    total_kev: full.length, returned_kev: filtered.length,
    with_coords: filtered.filter(r => r.lat !== 0 || r.lng !== 0).length,
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
  const lines = ['cveID,vendor,product,name,dateAdded,ransomware'];
  for (const r of rows) lines.push(`${r.cveID},"${(r.vendor || '').replace(/"/g, '""')}","${(r.product || '').replace(/"/g, '""')}","${r.name.replace(/"/g, '""')}",${r.dateAdded || ''},${r.ransomwareUse || ''}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadKEV();
    const rows = applyFilters(loaded.kev, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'cisa-kev-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.kev, rows, loaded.rawMeta) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.kev, rows, loaded.rawMeta) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.kev, rows, loaded.rawMeta),
      legend: fc.legend,
      features: fc.features,
      kev: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
