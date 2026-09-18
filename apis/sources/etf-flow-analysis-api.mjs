/**
 * apis/sources/etf-flow-analysis-api.mjs — API-МОДУЛЬ: АНАЛИЗ ПОТОКОВ ETF
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/analytics/market/etf-flow-analysis.json.
 * Анализатор: scripts/analyzers/etf-flow-analysis.mjs.
 *
 * Анализ потоков ETF (SP500, Gold, Oil, VIX). Показывает, куда идут деньги.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const ANALYTICS_FILE = join(PROJECT_ROOT, 'data', 'analytics', 'market', 'etf-flow-analysis.json');

export const route  = '/api/layers/etf-flow-analysis';
export const method = 'GET';

export const meta = {
  category: 'market',
  icon: '💸',
  color: '#22c55e',
  vizType: 'marker',
  source: 'analytics/market/etf-flow-analysis.json',
  collector: 'analyzer:etf-flow-analysis',
  cache: 300,
  description: 'Анализ потоков ETF (SP500, Gold, Oil, VIX)',
  unit: 'flows',
};

const ETF_LOCATIONS = {
  'sp500': { lat: 40.7580, lng: -73.9855, name: 'S&P 500 (NYSE)' },
  'gold':  { lat: 40.7128, lng:  -74.0060, name: 'Gold ETF (COMEX)' },
  'oil':   { lat: 29.7604, lng:  -95.3698, name: 'Oil ETF (Houston)' },
  'vix':   { lat: 41.8781, lng:  -87.6298, name: 'VIX ETF (CBOE)' },
  'bond':  { lat: 40.7069, lng:  -74.0113, name: 'Bond ETF (NY)' },
};

function flowBand(value) {
  if (value >= 1000) return { level: 'inflow_huge',    color: '#0d9488', label: 'Огромный приток' };
  if (value >= 100)  return { level: 'inflow_strong',  color: '#22c55e', label: 'Сильный приток' };
  if (value >= 0)    return { level: 'inflow_small',   color: '#84cc16', label: 'Небольшой приток' };
  if (value >= -100) return { level: 'outflow_small',  color: '#eab308', label: 'Небольшой отток' };
  if (value >= -1000) return { level: 'outflow_strong', color: '#f97316', label: 'Сильный отток' };
  return                    { level: 'outflow_huge',   color: '#dc2626', label: 'Огромный отток' };
}

async function loadData() {
  let raw;
  try { raw = await fs.readFile(ANALYTICS_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/analyzers/etf-flow-analysis.mjs'; throw err;
    }
    throw e;
  }
  try { return JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_analytics: ' + e.message); err.statusCode = 500; throw err; }
}

function extractItems(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data && Array.isArray(data.data.flows)) return data.data.flows;
  if (data.data && Array.isArray(data.data.items)) return data.data.items;
  if (Array.isArray(data.flows)) return data.flows;
  if (Array.isArray(data.items)) return data.items;
  if (data.data && typeof data.data === 'object') {
    return Object.entries(data.data).map(([key, val]) => {
      if (val && typeof val === 'object') return { name: key, ...val };
      return { name: key, flow: val };
    });
  }
  return [];
}

function normalizeItem(r) {
  const key = String(r.name || r.etf || r.ticker || 'unknown').toLowerCase();
  const loc = ETF_LOCATIONS[key] || null;
  return {
    id: r.id || key,
    name: r.name || loc?.name || key,
    ticker: r.ticker || key,
    flow: Number(r.flow ?? r.value ?? r.change ?? 0),
    aum: r.aum != null ? Number(r.aum) : null,
    previous: r.previous != null ? Number(r.previous) : null,
    severity: String(r.severity || r.level || 'info').toLowerCase(),
    lat: Number(r.lat ?? loc?.lat ?? 0),
    lng: Number(r.lng ?? r.lon ?? loc?.lng ?? 0),
    date: r.date || r.timestamp || null,
  };
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.ticker) { const t = String(query.ticker).toLowerCase(); r = r.filter(x => x.ticker.toLowerCase().includes(t)); }
  if (query.direction) {
    const d = String(query.direction).toLowerCase();
    if (d === 'inflow')  r = r.filter(x => x.flow > 0);
    if (d === 'outflow') r = r.filter(x => x.flow < 0);
  }
  if (query.min_abs_flow != null) { const n = parseFloat(query.min_abs_flow); if (Number.isFinite(n)) r = r.filter(x => Math.abs(x.flow) >= n); }
  if (query.q) { const q = String(query.q).toLowerCase(); r = r.filter(x => x.name.toLowerCase().includes(q)); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(0, n); }
  return r;
}

function computeStats(rows) {
  if (rows.length === 0) return { count: 0 };
  const flows = rows.map(r => r.flow);
  const totalIn = flows.filter(f => f > 0).reduce((a, b) => a + b, 0);
  const totalOut = flows.filter(f => f < 0).reduce((a, b) => a + b, 0);
  const byBand = {};
  for (const r of rows) { const b = flowBand(r.flow).level; byBand[b] = (byBand[b] || 0) + 1; }
  return {
    count: rows.length,
    total_inflow: totalIn,
    total_outflow: totalOut,
    net: totalIn + totalOut,
    by_band: byBand,
  };
}

function toFeatureCollection(rows) {
  const features = rows.filter(r => r.lat !== 0 || r.lng !== 0).map(r => {
    const b = flowBand(r.flow);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id, name: r.name, ticker: r.ticker, flow: r.flow, aum: r.aum,
        previous: r.previous, severity: r.severity, date: r.date,
        band: b.level, bandLabel: b.label, color: b.color,
        category: 'market', icon: meta.icon,
      },
    };
  });
  return {
    type: 'FeatureCollection',
    bands: [
      { level: 'inflow_huge',   label: 'Огромный приток (1000+)',  color: '#0d9488' },
      { level: 'inflow_strong', label: 'Сильный приток (100+)',    color: '#22c55e' },
      { level: 'inflow_small',  label: 'Небольшой приток',         color: '#84cc16' },
      { level: 'outflow_small', label: 'Небольшой отток',          color: '#eab308' },
      { level: 'outflow_strong',label: 'Сильный отток (-100-)',    color: '#f97316' },
      { level: 'outflow_huge',  label: 'Огромный отток (-1000-)',  color: '#dc2626' },
    ],
    features,
  };
}

function envelopeMeta(data, full, filtered) {
  return {
    source: meta.source, collector: meta.collector, category: meta.category, unit: meta.unit,
    updated_at: new Date().toISOString(),
    analyzer_meta: data && data._meta ? data._meta : null,
    total_flows: full.length, returned_flows: filtered.length,
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
  const lines = ['id,name,ticker,flow,aum,band'];
  for (const r of rows) { const b = flowBand(r.flow); lines.push(`${r.id},"${r.name.replace(/"/g, '""')}",${r.ticker},${r.flow},${r.aum ?? ''},${b.level}`); }
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
    const extra = { 'X-Module': 'etf-flow-analysis-api', 'X-Module-Version': '2.0.0', 'Cache-Control': `public, max-age=${meta.cache}` };

    if (format === 'csv') return sendText(res, 200, toCSVBody(rows), 'text/csv; charset=utf-8');
    if (format === 'stats') return sendJSON(res, 200, { stats, meta: envelopeMeta(data, full, rows) }, extra);
    if (format === 'raw') return sendJSON(res, 200, { data: rows, meta: envelopeMeta(data, full, rows) }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: envelopeMeta(data, full, rows),
      bands: fc.bands,
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
