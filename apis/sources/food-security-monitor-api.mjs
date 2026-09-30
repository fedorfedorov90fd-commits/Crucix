/**
 * apis/sources/food-security-monitor-api.mjs — API-МОДУЛЬ: МОНИТОР ПРОДОВОЛЬСТВЕННОЙ БЕЗОПАСНОСТИ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/specialist/food-security-monitor.json.
 * Анализатор: scripts/analyzers/food-security-monitor.mjs.
 *
 * Продовольственная безопасность стран. Источник — FAO, WFP, IPC.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'specialist', 'food-security-monitor.json');

export const route  = '/api/layers/food-security-monitor';
export const method = 'GET';

export const meta = {
  category: 'specialist',
  icon: '🌾',
  color: '#ff8800',
  vizType: 'marker',
  source: 'analytics/specialist/food-security-monitor.json',
  collector: 'analyzer:food-security-monitor',
  cache: 3600,
  description: 'Монитор продовольственной безопасности (FAO, WFP, IPC)',
  unit: 'index',
};

const IPC_LEVELS = {
  'minimal':    { level: 'minimal',    color: '#22c55e', label: 'Минимальный' },
  'stressed':   { level: 'stressed',   color: '#eab308', label: 'Стресс' },
  'crisis':     { level: 'crisis',     color: '#f97316', label: 'Кризис' },
  'emergency':  { level: 'emergency',  color: '#dc2626', label: 'Чрезвычайный' },
  'famine':     { level: 'famine',     color: '#7f1d1d', label: 'Голод' },
};

function ipcBand(levelOrScore) {
  const s = String(levelOrScore || '').toLowerCase();
  if (IPC_LEVELS[s]) return IPC_LEVELS[s];
  const n = Number(levelOrScore);
  if (Number.isFinite(n)) {
    if (n >= 5) return IPC_LEVELS.famine;
    if (n >= 4) return IPC_LEVELS.emergency;
    if (n >= 3) return IPC_LEVELS.crisis;
    if (n >= 2) return IPC_LEVELS.stressed;
    return IPC_LEVELS.minimal;
  }
  return IPC_LEVELS.minimal;
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/food-security-monitor.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (data.data && Array.isArray(data.data.top))   return data.data.top;
  if (data.data && Array.isArray(data.data.countries)) return data.data.countries;
  if (Array.isArray(data.countries)) return data.countries;
  if (Array.isArray(data.items)) return data.items;
  return [];
}

function normalizeItem(r) {
  return {
    id: r.id || r.iso || 'unknown',
    name: r.name || r.country || 'Unknown',
    iso: r.iso || r.code || null,
    ipcLevel: r.ipcLevel || r.ipc || r.level || 'minimal',
    score: Number(r.score ?? r.index ?? r.value ?? 0),
    population: r.population != null ? Number(r.population) : null,
    severity: String(r.severity || 'info').toLowerCase(),
    lat: Number(r.lat ?? r.latitude ?? 0),
    lng: Number(r.lng ?? r.lon ?? r.longitude ?? 0),
    date: r.date || r.timestamp || null,
    description: r.description || r.summary || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.ipc) r = r.filter(x => String(x.ipcLevel).toLowerCase() === String(query.ipc).toLowerCase());
  if (query.severity) r = r.filter(x => x.severity === String(query.severity).toLowerCase());
  if (query.min_score != null) { const n = parseFloat(query.min_score); if (Number.isFinite(n)) r = r.filter(x => x.score >= n); }
  if (query.iso) r = r.filter(x => (x.iso || '').toLowerCase() === String(query.iso).toLowerCase());
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const byIPC = {}, bySeverity = {};
  let totalPop = 0;
  for (const r of rows) {
    const b = ipcBand(r.ipcLevel).level;
    byIPC[b] = (byIPC[b] || 0) + 1;
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
    if (r.population) totalPop += r.population;
  }
  const critical = rows.filter(r => ['crisis', 'emergency', 'famine'].includes(ipcBand(r.ipcLevel).level));
  return {
    count: rows.length,
    total_population_affected: totalPop,
    critical_count: critical.length,
    by_ipc: byIPC,
    by_severity: bySeverity,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = ipcBand(r.ipcLevel);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, iso: r.iso,
        ipcLevel: r.ipcLevel, ipcLabel: b.label,
        score: r.score, population: r.population, severity: r.severity,
        description: r.description, date: r.date,
        color: b.color,
        category: 'specialist', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    ipc_levels: Object.values(IPC_LEVELS),
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_countries: full.length, returned_countries: filtered.length,
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
  const lines = ['iso,name,ipcLevel,score,population,severity'];
  for (const r of rows) lines.push(`${r.iso || ''},"${r.name.replace(/"/g, '""')}",${r.ipcLevel},${r.score},${r.population ?? ''},${r.severity}`);
  return lines.join('\n') + '\n';
}

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const data = await loadData();
    const rawItems = extractItems(data);
    const full = rawItems.map(normalizeItem);
    const rows = applyFilters(full, query);
    const stats = computeStats(rows);
    const extra = { 'X-Module': 'food-security-monitor-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      ipc_levels: fc.ipc_levels,
      features: fc.features,
      items: rows,
      stats,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
