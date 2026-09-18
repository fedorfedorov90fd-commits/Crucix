/**
 * apis/sources/crypto-fear-api.mjs — API-МОДУЛЬ: КРИПТО-СТРАХ (BTC/ETH RATIO)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/crypto-fear.json — [{ date, btc, eth, ratio }].
 * Сборщик: scripts/collectors/collect-crypto-fear.mjs.
 *
 * Крипто-индикатор страха: BTC, ETH, ratio BTC/ETH. Временной ряд + stats.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw.
 * ФИЛЬТРЫ: ?since=, ?until=, ?limit=.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'crypto-fear.json');

export const route  = '/api/layers/crypto-fear';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '📉',
  color: '#ff8800',
  vizType: 'series',
  source: 'basket/crypto-fear.json',
  collector: 'collect-crypto-fear.mjs',
  cache: 300,
  description: 'Крипто-страх: BTC, ETH, ratio',
  unit: 'ratio',
};

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-crypto-fear.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  if (!Array.isArray(parsed)) {
    const err = new Error('unrecognized_basket_format: ожидался массив [{date,btc,eth,ratio}]'); err.statusCode = 500; throw err;
  }
  return parsed.map(r => ({
    date: String(r.date || r.timestamp || '').slice(0, 10) || null,
    btc: Number(r.btc ?? r.bitcoin),
    eth: Number(r.eth ?? r.ethereum),
    ratio: Number(r.ratio ?? r.value),
  })).filter(r => Number.isFinite(r.ratio)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.since) r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until) r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

function computeStats(rows) {
  const ratios = rows.map(r => r.ratio).filter(Number.isFinite);
  if (ratios.length === 0) return { count: 0 };
  const sorted = [...ratios].sort((a, b) => a - b);
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const trend = (last && first && Number.isFinite(first.ratio) && first.ratio !== 0)
    ? Number(((last.ratio - first.ratio) / first.ratio * 100).toFixed(2)) : null;
  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    ratio_mean: Number((ratios.reduce((a,b)=>a+b,0)/ratios.length).toFixed(4)),
    ratio_median: sorted.length % 2 === 0
      ? Number(((sorted[sorted.length/2-1] + sorted[sorted.length/2])/2).toFixed(4))
      : Number(sorted[Math.floor(sorted.length/2)].toFixed(4)),
    ratio_min: Number(Math.min(...ratios).toFixed(4)),
    ratio_max: Number(Math.max(...ratios).toFixed(4)),
    last_btc: last?.btc ?? null,
    last_eth: last?.eth ?? null,
    last_ratio: last?.ratio ?? null,
    last_date: last?.date ?? null,
    trend_pct: trend,
  };
}

function toCSV(rows) {
  const lines = ['date,btc,eth,ratio'];
  for (const r of rows) lines.push(`${r.date || ''},${r.btc ?? ''},${r.eth ?? ''},${r.ratio ?? ''}`);
  return lines.join('\n') + '\n';
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

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/crypto-fear/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const all = await loadData();
    const extra = {
      'X-Module': 'crypto-fear-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(all) }, extra);
    }
    if (sub === '/latest') return sendJSON(res, 200, { latest: all.slice(-1)[0] || null }, extra);
    if (sub === '/status') return sendJSON(res, 200, { status: 'online', count: all.length }, extra);

    const rows = applyFilters(all, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: rows, meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows }, extra);

    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      features: [],
      meta: {
        source: meta.source, category: meta.category, unit: meta.unit,
        total_records: all.length, returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      series: rows,
      stats: computeStats(rows),
    }, extra);
  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
