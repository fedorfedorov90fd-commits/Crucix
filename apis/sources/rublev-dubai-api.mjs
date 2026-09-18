/**
 * apis/sources/rublev-dubai-api.mjs — API-МОДУЛЬ: РУБЛЬ В ДУБАЕ (RUB/USDT)
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/rublev-dubai.json — { source, lastUpdated, data:[{ date, rate, exchange, spread, source }], meta? }.
 * Сборщик: scripts/collectors/collect-rublev-dubai.mjs.
 *
 * Индикатор реального курса рубля через криптобиржи (Garantex, CommEX, обход санкций).
 * «Рубль в Дубае» — прокси реальной стоимости рубля за пределами РФ.
 *
 * ФОРМАТЫ: json (FC + series + stats), csv, series, stats, raw, spread.
 * ФИЛЬТРЫ: ?exchange=, ?min_rate=, ?max_rate=, ?min_spread=, ?max_spread=, ?since=, ?until=, ?limit=, ?sort=.
 *
 * СЛУЖЕБНЫЕ ПОДПУТИ:
 *   GET /                  — корень (список эндпоинтов)
 *   GET /stats             — агрегированная статистика
 *   GET /status            — health-check
 *   GET /latest            — последнее значение
 *   GET /exchanges         — группировка по биржам
 *   GET /rates             — только курсы (без spread)
 *   GET /spreads           — только спреды
 *   GET /trend             — динамика 7 vs 7
 *   GET /sources           — источники данных (Garantex/CommEX/DEMO)
 *   GET /volatility        — волатильность по скользящему окну
 *   GET /composite         — композитный индикатор (rate + spread + trend)
 *   GET /featurecollection — GeoJSON (точка Дубая)
 *   GET /render            — рендер-конфиг для графика
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'rublev-dubai.json');

export const route  = '/api/layers/rublev-dubai';
export const method = 'GET';

export const meta = {
  category: 'finance',
  icon: '💱',
  color: '#eab308',
  vizType: 'series',
  source: 'basket/rublev-dubai.json',
  collector: 'collect-rublev-dubai.mjs',
  cache: 300,
  description: 'Рубль в Дубае — реальный курс RUB/USDT через криптобиржи (Garantex / CommEX)',
  unit: 'RUB/USDT',
};

// Координаты Дубая — точка индикатора на карте
const DUBAI_COORDS = [25.2048, 55.2708];
const MOSCOW_COORDS = [55.7558, 37.6173];

const EXCHANGE_COLORS = {
  'Garantex': '#dc2626',
  'CommEX':   '#0891b2',
  'DEMO':     '#94a3b8',
  'unknown':  '#64748b',
};

// Уровни реального курса (RUB за 1 USDT через криптобиржи)
const RATE_TIERS = {
  strong:   { min: 0,  max: 75, color: '#22c55e', label: 'Крепкий рубль' },
  normal:   { min: 75, max: 85, color: '#84cc16', label: 'Норма' },
  weak:     { min: 85, max: 95, color: '#eab308', label: 'Слабый' },
  very_weak:{ min: 95, max: 110, color: '#f97316', label: 'Очень слабый' },
  collapse: { min: 110, max: 9999, color: '#dc2626', label: 'Обвал' },
};

function rateTier(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(RATE_TIERS)) {
    if (n >= def.min && n < def.max) return { key: k, color: def.color, label: def.label };
  }
  return { key: 'collapse', ...RATE_TIERS.collapse };
}

// Уровни спреда
const SPREAD_TIERS = {
  tight:    { min: 0,  max: 0.5, color: '#22c55e', label: 'Узкий' },
  normal:   { min: 0.5, max: 1.0, color: '#84cc16', label: 'Норма' },
  wide:     { min: 1.0, max: 2.0, color: '#eab308', label: 'Широкий' },
  very_wide:{ min: 2.0, max: 5.0, color: '#f97316', label: 'Очень широкий' },
  panic:    { min: 5.0, max: 9999, color: '#dc2626', label: 'Паника' },
};

function spreadTier(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return { key: 'unknown', color: '#64748b', label: 'Нет данных' };
  for (const [k, def] of Object.entries(SPREAD_TIERS)) {
    if (n >= def.min && n < def.max) return { key: k, color: def.color, label: def.label };
  }
  return { key: 'panic', ...SPREAD_TIERS.panic };
}

// ============================================================
//  ЗАГРУЗКА
// ============================================================

async function loadData() {
  let raw;
  try { raw = await fs.readFile(BASKET_FILE, 'utf8'); }
  catch (e) {
    if (e.code === 'ENOENT') {
      const err = new Error('no_data'); err.statusCode = 503;
      err.hint = 'run scripts/collectors/collect-rublev-dubai.mjs'; throw err;
    }
    throw e;
  }
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { const err = new Error('invalid_json_in_basket: ' + e.message); err.statusCode = 500; throw err; }
  return parsed;
}

function extractSeries(doc) {
  let arr = null;
  let source = null;
  let metaObj = null;

  if (Array.isArray(doc)) arr = doc;
  else if (doc && Array.isArray(doc.data)) { arr = doc.data; source = doc.source || null; metaObj = doc.meta || null; }
  else if (doc && Array.isArray(doc.records)) arr = doc.records;
  else if (doc && Array.isArray(doc.items)) arr = doc.items;

  if (!arr) return { series: [], source, meta: metaObj };

  const series = arr.map(r => {
    const rate = Number(r.rate ?? r.value ?? r.usdt);
    const spread = r.spread != null ? Number(r.spread) : null;
    const exchange = r.exchange || r.exchangeName || 'unknown';
    const rt = rateTier(rate);
    const st = spreadTier(spread);
    return {
      date: String(r.date || r.timestamp || '').slice(0, 10) || null,
      timestamp: r.date || r.timestamp || null,
      rate: Number.isFinite(rate) ? Number(rate.toFixed(2)) : null,
      spread: spread != null && Number.isFinite(spread) ? Number(spread.toFixed(2)) : null,
      exchange,
      exchangeColor: EXCHANGE_COLORS[exchange] || EXCHANGE_COLORS.unknown,
      source: r.source || null,
      rateTier: rt.key,
      rateTierLabel: rt.label,
      rateColor: rt.color,
      spreadTier: st.key,
      spreadTierLabel: st.label,
      spreadColor: st.color,
    };
  }).filter(r => r.rate != null && Number.isFinite(r.rate));

  series.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  return { series, source, meta: metaObj };
}

// ============================================================
//  ФИЛЬТРЫ
// ============================================================

function applyFilters(rows, query) {
  let r = rows.slice();
  if (query.exchange) r = r.filter(x => String(x.exchange).toLowerCase() === String(query.exchange).toLowerCase());
  if (query.source)   r = r.filter(x => String(x.source || '').toLowerCase().includes(String(query.source).toLowerCase()));
  if (query.since)    r = r.filter(x => !x.date || x.date >= String(query.since).slice(0, 10));
  if (query.until)    r = r.filter(x => !x.date || x.date <= String(query.until).slice(0, 10));
  if (query.min_rate != null) { const n = Number(query.min_rate); if (Number.isFinite(n)) r = r.filter(x => x.rate != null && x.rate >= n); }
  if (query.max_rate != null) { const n = Number(query.max_rate); if (Number.isFinite(n)) r = r.filter(x => x.rate != null && x.rate <= n); }
  if (query.min_spread != null) { const n = Number(query.min_spread); if (Number.isFinite(n)) r = r.filter(x => x.spread != null && x.spread >= n); }
  if (query.max_spread != null) { const n = Number(query.max_spread); if (Number.isFinite(n)) r = r.filter(x => x.spread != null && x.spread <= n); }
  if (query.rate_tier)   r = r.filter(x => x.rateTier === String(query.rate_tier));
  if (query.spread_tier) r = r.filter(x => x.spreadTier === String(query.spread_tier));

  const sortKey = query.sort || null;
  if (sortKey === 'rate-desc')   r.sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0));
  else if (sortKey === 'rate-asc')  r.sort((a, b) => (a.rate ?? 0) - (b.rate ?? 0));
  else if (sortKey === 'spread-desc') r.sort((a, b) => (b.spread ?? 0) - (a.spread ?? 0));
  else if (sortKey === 'date-desc') r.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));

  if (query.top)   { const n = parseInt(query.top, 10);   if (n > 0) r = r.slice(0, n); }
  if (query.limit) { const n = parseInt(query.limit, 10); if (n > 0) r = r.slice(-n); }
  return r;
}

// ============================================================
//  СТАТИСТИКА
// ============================================================

function computeStats(rows) {
  const rates = rows.map(r => r.rate).filter(Number.isFinite);
  const spreads = rows.map(r => r.spread).filter(Number.isFinite);
  const dates = rows.map(r => r.date).filter(Boolean).sort();
  const byExchange = {};
  const byRateTier = {};
  const bySpreadTier = {};

  for (const r of rows) {
    byExchange[r.exchange] = (byExchange[r.exchange] || 0) + 1;
    byRateTier[r.rateTier] = (byRateTier[r.rateTier] || 0) + 1;
    if (r.spread != null) bySpreadTier[r.spreadTier] = (bySpreadTier[r.spreadTier] || 0) + 1;
  }

  if (rates.length === 0) return { count: rows.length, by_exchange: byExchange };

  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  const stddev = Math.sqrt(variance);
  const sorted = [...rates].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length/2 - 1] + sorted[sorted.length/2]) / 2
    : sorted[Math.floor(sorted.length/2)];

  const last = rows.slice(-1)[0] || null;
  const first = rows[0] || null;
  const changeAbs = (last && first) ? Number((last.rate - first.rate).toFixed(2)) : null;
  const changePct = (last && first && first.rate !== 0)
    ? Number(((last.rate - first.rate) / first.rate * 100).toFixed(2)) : null;

  const spreadMean = spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : null;

  return {
    count: rows.length,
    date_from: dates[0] || null,
    date_to: dates[dates.length - 1] || null,
    rate_mean: Number(mean.toFixed(2)),
    rate_median: Number(median.toFixed(2)),
    rate_stddev: Number(stddev.toFixed(2)),
    rate_min: Number(Math.min(...rates).toFixed(2)),
    rate_max: Number(Math.max(...rates).toFixed(2)),
    rate_last: last?.rate ?? null,
    rate_last_date: last?.date ?? null,
    rate_last_tier: last?.rateTier ?? null,
    rate_first: first?.rate ?? null,
    rate_change_abs: changeAbs,
    rate_change_pct: changePct,
    spread_mean: spreadMean != null ? Number(spreadMean.toFixed(2)) : null,
    spread_min: spreads.length ? Number(Math.min(...spreads).toFixed(2)) : null,
    spread_max: spreads.length ? Number(Math.max(...spreads).toFixed(2)) : null,
    spread_last: last?.spread ?? null,
    by_exchange: byExchange,
    by_rate_tier: byRateTier,
    by_spread_tier: bySpreadTier,
    sources: [...new Set(rows.map(r => r.source).filter(Boolean))],
  };
}

// ============================================================
//  АНАЛИТИКА
// ============================================================

function computeTrend(rows) {
  const tail = rows.slice(-7);
  const prev = rows.slice(-14, -7);
  if (tail.length === 0 || prev.length === 0) return null;
  const mean = arr => arr.reduce((s, r) => s + (r.rate ?? 0), 0) / arr.length;
  const mNew = mean(tail);
  const mOld = mean(prev);
  const delta = mOld !== 0 ? ((mNew - mOld) / mOld * 100) : null;
  return {
    last7_count: tail.length,
    prev7_count: prev.length,
    last7_mean: Number(mNew.toFixed(2)),
    prev7_mean: Number(mOld.toFixed(2)),
    delta_pct: delta != null ? Number(delta.toFixed(2)) : null,
    direction: delta == null ? 'unknown' : delta > 2 ? 'weak' : delta < -2 ? 'strong' : 'flat',
  };
}

function computeVolatility(rows, window = 7) {
  if (rows.length < window) return null;
  const window_ = rows.slice(-window);
  const rates = window_.map(r => r.rate).filter(Number.isFinite);
  if (rates.length === 0) return null;
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length;
  const variance = rates.reduce((a, v) => a + (v - mean) ** 2, 0) / rates.length;
  const stddev = Math.sqrt(variance);
  return {
    window,
    samples: rates.length,
    mean: Number(mean.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    coefficient_pct: mean !== 0 ? Number((stddev / mean * 100).toFixed(2)) : null,
    min: Number(Math.min(...rates).toFixed(2)),
    max: Number(Math.max(...rates).toFixed(2)),
    range: Number((Math.max(...rates) - Math.min(...rates)).toFixed(2)),
  };
}

function computeComposite(rows) {
  const stats = computeStats(rows);
  const trend = computeTrend(rows);
  const vol = computeVolatility(rows);
  return {
    value: stats.rate_last,
    tier: stats.rate_last_tier,
    date: stats.rate_last_date,
    rate_mean: stats.rate_mean,
    spread_last: stats.spread_last,
    trend_pct: trend?.delta_pct ?? null,
    trend_direction: trend?.direction ?? 'unknown',
    volatility_pct: vol?.coefficient_pct ?? null,
    sample_count: stats.count,
  };
}

function buildSeriesOnly(rows, field) {
  return rows.map(r => ({ date: r.date, value: r[field] })).filter(r => r.value != null);
}

function groupByExchange(rows) {
  const map = {};
  for (const r of rows) {
    if (!map[r.exchange]) map[r.exchange] = { exchange: r.exchange, color: r.exchangeColor, count: 0, rates: [], spreads: [] };
    map[r.exchange].count++;
    if (r.rate != null) map[r.exchange].rates.push(r.rate);
    if (r.spread != null) map[r.exchange].spreads.push(r.spread);
  }
  return Object.values(map).map(x => ({
    exchange: x.exchange,
    color: x.color,
    count: x.count,
    rate_mean: x.rates.length ? Number((x.rates.reduce((a, b) => a + b, 0) / x.rates.length).toFixed(2)) : null,
    rate_min: x.rates.length ? Number(Math.min(...x.rates).toFixed(2)) : null,
    rate_max: x.rates.length ? Number(Math.max(...x.rates).toFixed(2)) : null,
    spread_mean: x.spreads.length ? Number((x.spreads.reduce((a, b) => a + b, 0) / x.spreads.length).toFixed(2)) : null,
  })).sort((a, b) => b.count - a.count);
}

// ============================================================
//  ФОРМАТЫ
// ============================================================

function toFeatureCollection(rows) {
  const features = [];
  for (const r of rows) {
    if (r.rate == null) continue;
    // Дубай (точка индикатора)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [DUBAI_COORDS[1], DUBAI_COORDS[0]] },
      properties: {
        id: `dubai-${r.date}`,
        name: 'Dubai RUB/USDT',
        date: r.date,
        rate: r.rate,
        spread: r.spread,
        exchange: r.exchange,
        tier: r.rateTier,
        tierLabel: r.rateTierLabel,
        color: r.rateColor,
        category: 'finance',
        icon: meta.icon,
      },
    });
    // Москва (для сравнения)
    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [MOSCOW_COORDS[1], MOSCOW_COORDS[0]] },
      properties: {
        id: `moscow-${r.date}`,
        name: 'Moscow RUB/USDT',
        date: r.date,
        rate: r.rate,
        spread: r.spread,
        exchange: r.exchange,
        tier: r.rateTier,
        tierLabel: r.rateTierLabel,
        color: r.rateColor,
        category: 'finance',
        icon: meta.icon,
      },
    });
  }
  return {
    type: 'FeatureCollection',
    features,
    legend: Object.entries(RATE_TIERS).map(([key, def]) => ({ key, ...def })),
    meta: { total: rows.length, mapped: features.length },
  };
}

function toSeries(rows) {
  return rows.map(r => ({
    date: r.date,
    rate: r.rate,
    spread: r.spread,
    exchange: r.exchange,
    rateTier: r.rateTier,
    spreadTier: r.spreadTier,
  }));
}

function toCSV(rows) {
  const lines = ['date,rate,spread,exchange,source,rate_tier,spread_tier'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    lines.push([r.date, r.rate, r.spread, r.exchange, r.source, r.rateTier, r.spreadTier].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toSpreadCSV(rows) {
  const lines = ['date,spread,exchange,spread_tier'];
  const esc = (v) => { if (v == null) return ''; const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  for (const r of rows) {
    if (r.spread == null) continue;
    lines.push([r.date, r.spread, r.exchange, r.spreadTier].map(esc).join(','));
  }
  return lines.join('\n') + '\n';
}

function toRenderConfig(rows) {
  const rates = rows.map(r => ({ x: r.date, y: r.rate })).filter(p => p.y != null);
  const spreads = rows.map(r => ({ x: r.date, y: r.spread })).filter(p => p.y != null);
  const exchanges = [...new Set(rows.map(r => r.exchange))];
  return {
    type: 'line',
    series: [
      { name: 'RUB/USDT', color: meta.color, data: rates, axis: 'y1' },
      { name: 'Spread', color: '#0ea5e9', data: spreads, axis: 'y2' },
    ],
    exchanges,
    legend: Object.entries(RATE_TIERS).map(([k, v]) => ({ key: k, label: v.label, color: v.color })),
  };
}

// ============================================================
//  ОТВЕТЫ
// ============================================================

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

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  try {
    const urlObj = new URL(req.url, 'http://x');
    const sub = urlObj.pathname.replace(/^\/api\/layers\/rublev-dubai/, '') || '/';
    const query = Object.fromEntries(urlObj.searchParams.entries());
    const format = (query.format || 'json').toLowerCase();

    const doc = await loadData();
    const { series, source, meta: srcMeta } = extractSeries(doc);
    const extra = {
      'X-Module': 'rublev-dubai-api',
      'X-Module-Version': '2.0.0',
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (sub === '/stats' || format === 'stats') {
      return sendJSON(res, 200, { stats: computeStats(series), source, src_meta: srcMeta }, extra);
    }
    if (sub === '/status') {
      return sendJSON(res, 200, {
        status: 'online',
        count: series.length,
        source,
        generated_at: new Date().toISOString(),
      }, extra);
    }
    if (sub === '/latest') {
      return sendJSON(res, 200, { latest: series.slice(-1)[0] || null, source }, extra);
    }
    if (sub === '/exchanges') {
      const exchanges = groupByExchange(series);
      return sendJSON(res, 200, { exchanges, total: exchanges.length }, extra);
    }
    if (sub === '/rates') {
      return sendJSON(res, 200, { series: buildSeriesOnly(series, 'rate'), field: 'rate', count: series.length }, extra);
    }
    if (sub === '/spreads') {
      return sendJSON(res, 200, { series: buildSeriesOnly(series, 'spread'), field: 'spread', count: series.filter(r => r.spread != null).length }, extra);
    }
    if (sub === '/trend') {
      return sendJSON(res, 200, { trend: computeTrend(series) }, extra);
    }
    if (sub === '/sources') {
      const bySource = {};
      for (const r of series) bySource[r.source || 'unknown'] = (bySource[r.source || 'unknown'] || 0) + 1;
      const top = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
      return sendJSON(res, 200, { sources: top, total: top.length }, extra);
    }
    if (sub === '/volatility') {
      const window_ = parseInt(query.window, 10) || 7;
      return sendJSON(res, 200, { volatility: computeVolatility(series, window_) }, extra);
    }
    if (sub === '/composite') {
      return sendJSON(res, 200, { composite: computeComposite(series) }, extra);
    }
    if (sub === '/featurecollection') {
      const rows = applyFilters(series, query);
      return sendJSON(res, 200, toFeatureCollection(rows), extra);
    }
    if (sub === '/render') {
      const rows = applyFilters(series, query);
      return sendJSON(res, 200, { render: toRenderConfig(rows) }, extra);
    }

    const rows = applyFilters(series, query);

    if (format === 'csv')    return sendText(res, 200, toCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'spread') return sendText(res, 200, toSpreadCSV(rows), 'text/csv; charset=utf-8');
    if (format === 'series') return sendJSON(res, 200, { series: toSeries(rows), meta: { count: rows.length } }, extra);
    if (format === 'raw')    return sendJSON(res, 200, { data: rows, source, src_meta: srcMeta }, extra);

    const fc = toFeatureCollection(rows);
    return sendJSON(res, 200, {
      type: 'FeatureCollection',
      meta: {
        source: meta.source,
        category: meta.category,
        unit: meta.unit,
        upstream_source: source,
        upstream_meta: srcMeta,
        total_records: series.length,
        returned_records: rows.length,
        generated_at: new Date().toISOString(),
      },
      features: fc.features,
      legend: fc.legend,
      series: toSeries(rows),
      stats: computeStats(rows),
      trend: computeTrend(rows),
      volatility: computeVolatility(rows),
      exchanges: groupByExchange(rows),
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = { error: status === 503 ? 'no_data' : 'handler_error', message: e.message };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
