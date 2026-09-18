/**
 * apis/sources/vulnerabilities-api.mjs — API-МОДУЛЬ: УЯЗВИМОСТИ CVE
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/vulnerabilities.json — массив { cveId, name, description, severity, cvss, source, published }.
 * Резервный: data/basket/cve.json.
 * Сборщик: scripts/collectors/collect-cve.mjs.
 *
 * Уязвимости CVE по критичности. CVSS: 0-10.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');

export const route  = '/api/layers/vulnerabilities';
export const method = 'GET';

export const meta = {
  category: 'cyber',
  icon: '🔓',
  color: '#ffcc00',
  vizType: 'marker',
  source: 'basket/vulnerabilities.json',
  collector: 'collect-cve.mjs',
  cache: 300,
  description: 'Уязвимости CVE по критичности (CVSS 0-10)',
  unit: 'CVEs',
};

const SEVERITY_COLOR = { 'info': '#22c55e', 'low': '#84cc16', 'medium': '#eab308', 'high': '#f97316', 'critical': '#dc2626' };

function cvssBand(score) {
  if (score >= 9) return { level: 'critical', color: '#7f1d1d', label: 'Критическая' };
  if (score >= 7) return { level: 'high',     color: '#dc2626', label: 'Высокая' };
  if (score >= 4) return { level: 'medium',   color: '#f97316', label: 'Средняя' };
  if (score > 0)  return { level: 'low',      color: '#eab308', label: 'Низкая' };
  return                { level: 'info',     color: '#22c55e', label: 'Информационная' };
}

async function loadVulnerabilities() {
  let raw = null, fileUsed = null, parsed = null;
  for (const f of ['vulnerabilities.json', 'cve.json', 'cve_events.json']) {
    try { raw = await fs.readFile(join(BASKET_DIR, f), 'utf8'); parsed = JSON.parse(raw); fileUsed = f; break; } catch (e) { if (e.code !== 'ENOENT') throw e; }
  }
  if (!raw) {
    const err = new Error('no_data'); err.statusCode = 503;
    err.hint = 'run scripts/collectors/collect-cve.mjs'; throw err;
  }

  let arr = null;
  if (Array.isArray(parsed)) arr = parsed;
  else if (parsed && Array.isArray(parsed.vulnerabilities)) arr = parsed.vulnerabilities;
  else if (parsed && Array.isArray(parsed.cves)) arr = parsed.cves;
  else if (parsed && Array.isArray(parsed.data)) arr = parsed.data;
  if (!arr) { const err = new Error('unrecognized_basket_format'); err.statusCode = 500; throw err; }

  const clean = arr.map(r => {
    const cvss = Number(r.cvss ?? r.cvss_score ?? r.score ?? 0);
    const band = cvssBand(cvss);
    return {
      id: r.cveId || r.id || r.cve || 'unknown',
      name: r.name || r.title || r.cveId || 'Unknown',
      description: r.description || r.summary || '',
      severity: String(r.severity || band.level).toLowerCase(),
      cvss,
      source: r.source || null,
      vendor: r.vendor || null,
      product: r.product || null,
      published: r.published || r.date || null,
      lat: Number(r.lat ?? r.latitude ?? 0),
      lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    };
  }).filter(r => r.id !== 'unknown');

  if (clean.length === 0) { const err = new Error('empty_after_normalize'); err.statusCode = 500; throw err; }
  clean.sort((a, b) => b.cvss - a.cvss);
  return { vulnerabilities: clean, fileUsed };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_cvss != null) { const n = parseFloat(query.min_cvss); if (Number.isFinite(n)) r = r.filter(x => x.cvss >= n); }
  if (query.max_cvss != null) { const n = parseFloat(query.max_cvss); if (Number.isFinite(n)) r = r.filter(x => x.cvss <= n); }
  if (query.vendor) { const v = String(query.vendor).toLowerCase(); r = r.filter(x => (x.vendor || '').toLowerCase().includes(v)); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.id.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byBand = {}, byVendor = {};
  let totalCvss = 0;
  for (const r of rows) {
    const b = cvssBand(r.cvss).level;
    byBand[b] = (byBand[b] || 0) + 1;
    if (r.vendor) byVendor[r.vendor] = (byVendor[r.vendor] || 0) + 1;
    totalCvss += r.cvss;
  }
  const top_vendors = Object.entries(byVendor).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const top_cves = rows.slice(0, 5).map(r => ({ id: r.id, cvss: r.cvss, name: r.name }));
  return {
    count: rows.length,
    max_cvss: Math.max(...rows.map(r => r.cvss)),
    avg_cvss: +(totalCvss / rows.length).toFixed(2),
    by_band: byBand,
    by_vendor: byVendor,
    top_vendors,
    top_cves,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = cvssBand(r.cvss);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, description: r.description, cvss: r.cvss,
        severity: r.severity, band: b.level, bandLabel: b.label,
        vendor: r.vendor, product: r.product, source: r.source, published: r.published,
        color: b.color,
        category: 'cyber', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'critical', label: 'Критическая (9+)', color: '#7f1d1d' },
      { level: 'high',     label: 'Высокая (7+)',    color: '#dc2626' },
      { level: 'medium',   label: 'Средняя (4+)',    color: '#f97316' },
      { level: 'low',      label: 'Низкая (>0)',     color: '#eab308' },
      { level: 'info',     label: 'Информационная',  color: '#22c55e' },
    ],
    features,
  };
}

function envelopeMeta(full, filtered, fileUsed) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    basket_file: fileUsed,
    total_cves: full.length, returned_cves: filtered.length,
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
  const lines = ['id,name,cvss,severity,vendor,product,published,lat,lng'];
  for (const r of rows) lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.cvss},${r.severity},${r.vendor || ''},${r.product || ''},${r.published || ''},${r.lat},${r.lng}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const loaded = await loadVulnerabilities();
    const rows = applyFilters(loaded.vulnerabilities, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'vulnerabilities-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(loaded.vulnerabilities, rows, loaded.fileUsed) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(loaded.vulnerabilities, rows, loaded.fileUsed) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(loaded.vulnerabilities, rows, loaded.fileUsed),
      bands: fc.bands,
      features: fc.features,
      vulnerabilities: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
