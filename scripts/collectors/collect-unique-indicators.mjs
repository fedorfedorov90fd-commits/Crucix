/**
 * scripts/collectors/collect-unique-indicators.mjs — СБОРЩИК: КОСВЕННЫЕ ИНДИКАТОРЫ
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * Перевод на контракт v3: один saveRaw('unique-indicators', ...) с двумя
 * индикаторами (pentagon-pizza, langley-taxis) в одном payload.
 * backwardCompat: false — basket не перезаписывается.
 *
 * Вся логика сохранена: каскад GoogleMaps → Yelp → генератор,
 * rolling stats (mean/stddev/EMA/percentile), spike detection (>2σ),
 * merge с историей, rate limit 6 запросов, CLI-флаги.
 *
 * ВЫХОД: data/raw/unique-indicators-<timestamp>.json + накладная
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const LOGS_DIR     = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE     = join(LOGS_DIR, 'collect-unique-indicators.log');

const args = process.argv.slice(2);
const CLI = {
  force:   args.includes('--force'),
  demo:    args.includes('--demo'),
  quiet:   args.includes('--quiet'),
  verbose: args.includes('--verbose'),
  days:    (() => { const a = args.find(x => x.startsWith('--days=')); return a ? parseInt(a.slice('--days='.length), 10) || 30 : 30; })(),
};

const RATE_LIMIT = {
  maxRequests: 6, counter: 0,
  reset() { this.counter = 0; },
  check() { if (this.counter >= this.maxRequests) return false; this.counter++; return true; },
};

const VALIDATION = { valueRange: [0, 200], minPoints: 5, maxHistory: 90 };

const INDICATORS = {
  'pentagon-pizza': {
    name: 'Индекс "Пицца Пентагона"',
    shortName: 'Пицца Пентагона',
    description: 'Резкий рост заказов пиццы в районе Пентагона — признак подготовки к операции',
    source: 'Google Maps / Yelp',
    location: { name: 'Пентагон, Арлингтон, Вирджиния', lat: 38.8719, lng: -77.0563, radius_km: 5 },
    thresholds: { warning: 50, critical: 100 },
    baseline: 35, volatility: 0.35, spikeChance: 0.10, spikeMax: 80,
  },
  'langley-taxis': {
    name: 'Индекс "Такси в Лэнгли"',
    shortName: 'Такси Лэнгли',
    description: 'Резкий рост заказов такси в районе штаб-квартиры ЦРУ — признак экстренного совещания',
    source: 'Uber / Lyft / Google Maps',
    location: { name: 'Лэнгли, Вирджиния (штаб-квартира ЦРУ)', lat: 38.9519, lng: -77.1467, radius_km: 5 },
    thresholds: { warning: 20, critical: 50 },
    baseline: 12, volatility: 0.30, spikeChance: 0.15, spikeMax: 50,
  },
};

const LOG_LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
let logMinLevel = LOG_LEVELS.INFO;
if (CLI.quiet) logMinLevel = LOG_LEVELS.ERROR;
if (CLI.verbose) logMinLevel = LOG_LEVELS.DEBUG;

async function log(level, msg) {
  const lvl = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  if (lvl < logMinLevel) return;
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try { await fs.mkdir(LOGS_DIR, { recursive: true }); await fs.appendFile(LOG_FILE, line); } catch (e) { console.error('[unique-indicators] log write failed:', e.message); }
  if (!CLI.quiet || level === 'ERROR') process.stdout.write(line);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10); }
function isValidDate(str) { if (!str) return false; const d = new Date(str); return !isNaN(d.getTime()); }

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

function computeStatus(value, thresholds) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'unknown';
  if (n >= thresholds.critical) return 'critical';
  if (n >= thresholds.warning) return 'warning';
  return 'normal';
}

function computeTrend(prevValue, currValue) {
  if (!Number.isFinite(prevValue) || !Number.isFinite(currValue)) return 'stable';
  const delta = currValue - prevValue;
  if (delta > 5) return 'rising';
  if (delta < -5) return 'falling';
  return 'stable';
}

async function fetchFromGoogleMapsProxy(indicatorId) {
  const ind = INDICATORS[indicatorId];
  if (!ind) throw new Error(`unknown_indicator: ${indicatorId}`);
  const url = `https://maps.googleapis.com/maps/api/place/popular-times?location=${ind.location.lat},${ind.location.lng}&radius=${ind.location.radius_km * 1000}`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (CrucixBot/2.0)' };
  if (!RATE_LIMIT.check()) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.popular_times)) throw new Error('no_popular_times_field');
    return data.popular_times;
  } catch (e) {
    await log('WARN', `GoogleMaps proxy ${indicatorId}: ${e.message}`);
    return null;
  }
}

async function fetchFromYelpProxy(indicatorId) {
  const ind = INDICATORS[indicatorId];
  if (!ind) throw new Error(`unknown_indicator: ${indicatorId}`);
  const url = `https://api.yelp.com/v3/businesses/search?latitude=${ind.location.lat}&longitude=${ind.location.lng}&radius=${ind.location.radius_km * 1000}&categories=pizza`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (CrucixBot/2.0)' };
  if (!RATE_LIMIT.check()) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !Array.isArray(data.businesses)) throw new Error('no_businesses_field');
    return data.businesses;
  } catch (e) {
    await log('WARN', `Yelp proxy ${indicatorId}: ${e.message}`);
    return null;
  }
}

function generateFallback(indicatorId, days = 30) {
  const ind = INDICATORS[indicatorId];
  if (!ind) throw new Error(`unknown_indicator: ${indicatorId}`);
  const data = [];
  let value = ind.baseline;
  let trend = 0;
  for (let i = days; i >= 0; i--) {
    trend = trend * 0.85 + (Math.random() - 0.48) * ind.volatility * 5;
    const noise = (Math.random() - 0.5) * ind.volatility * 4;
    value = ind.baseline + trend + noise;
    const spike = Math.random() < ind.spikeChance ? Math.random() * ind.spikeMax : 0;
    value += spike;
    value = Math.max(VALIDATION.valueRange[0], Math.min(VALIDATION.valueRange[1], value));
    const prev = i < days ? data[data.length - 1]?.value : null;
    data.push({ date: daysAgo(i), value: Math.round(value), trend: computeTrend(prev, value), status: computeStatus(value, ind.thresholds) });
  }
  return data;
}

export function validatePoints(points) {
  if (!Array.isArray(points)) return [];
  return points.filter(p => {
    if (!p || !isValidDate(p.date)) return false;
    if (!Number.isFinite(p.value)) return false;
    if (p.value < VALIDATION.valueRange[0] || p.value > VALIDATION.valueRange[1]) return false;
    return true;
  });
}

export function dedupeByDate(points) {
  const byDate = new Map();
  for (const p of points) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function computeRollingStats(points, window = 7) {
  if (!points.length) return null;
  const values = points.map(p => p.value).filter(Number.isFinite);
  if (!values.length) return null;
  const tail = values.slice(-window);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const variance = tail.reduce((a, v) => a + (v - mean) ** 2, 0) / tail.length;
  const stddev = Math.sqrt(variance);
  const k = 2 / (tail.length + 1);
  let ema = tail[0];
  for (let i = 1; i < tail.length; i++) ema = tail[i] * k + ema * (1 - k);
  return { window, samples: tail.length, mean: Number(mean.toFixed(2)), stddev: Number(stddev.toFixed(2)), min: Math.min(...tail), max: Math.max(...tail), ema: Number(ema.toFixed(2)), p25: percentile(tail, 0.25), p75: percentile(tail, 0.75) };
}

export function detectSpikes(points, window = 14) {
  if (points.length < window) return [];
  const values = points.map(p => p.value).filter(Number.isFinite);
  const tail = values.slice(-window);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const variance = tail.reduce((a, v) => a + (v - mean) ** 2, 0) / tail.length;
  const stddev = Math.sqrt(variance);
  const threshold = 2 * stddev;
  return points.filter(p => p.value != null && Math.abs(p.value - mean) > threshold).map(p => ({ date: p.date, value: p.value, z_score: Number(((p.value - mean) / (stddev || 1)).toFixed(2)), deviation: Number((p.value - mean).toFixed(2)), status: p.status })).sort((a, b) => Math.abs(b.z_score) - Math.abs(a.z_score));
}

async function trySourcesForIndicator(indicatorId) {
  try { const gData = await fetchFromGoogleMapsProxy(indicatorId); if (gData && gData.length) { await log('INFO', `✅ GoogleMaps ${indicatorId}: ${gData.length} точек`); return { data: gData, source: 'google-maps', isDemo: false }; } } catch (e) { await log('WARN', `GoogleMaps ${indicatorId} упал: ${e.message}`); }
  try { const yData = await fetchFromYelpProxy(indicatorId); if (yData && yData.length) { await log('INFO', `✅ Yelp ${indicatorId}: ${yData.length} точек`); return { data: yData, source: 'yelp', isDemo: false }; } } catch (e) { await log('WARN', `Yelp ${indicatorId} упал: ${e.message}`); }
  await log('INFO', `Каскад ${indicatorId}: все live-источники недоступны, генеративный fallback`);
  return { data: generateFallback(indicatorId, CLI.days), source: 'generated', isDemo: true };
}

async function processIndicator(indicatorId) {
  const ind = INDICATORS[indicatorId];
  if (!ind) throw new Error(`unknown_indicator: ${indicatorId}`);
  const { data: raw, source, isDemo } = await trySourcesForIndicator(indicatorId);
  const normalized = raw.map((p, i, arr) => {
    const prev = i > 0 ? arr[i - 1] : null;
    const value = Number(p.value);
    return { date: String(p.date || daysAgo(arr.length - 1 - i)).slice(0, 10), value: Number.isFinite(value) ? Math.round(value) : 0, trend: p.trend || computeTrend(prev?.value, value), status: p.status || computeStatus(value, ind.thresholds) };
  });
  const validated = validatePoints(normalized);
  if (!validated.length) throw new Error(`no_valid_points_for_${indicatorId}`);
  const rollingStats = computeRollingStats(validated, 7);
  const spikes = detectSpikes(validated, 14);
  const latest = validated[validated.length - 1] || null;
  return { id: indicatorId, name: ind.name, shortName: ind.shortName, description: ind.description, source: ind.source, location: ind.location, thresholds: ind.thresholds, points: validated, pointsCount: validated.length, source_used: source, isDemo, rolling_stats: rollingStats, spikes, spikes_count: spikes.length, latest };
}

export async function collectUniqueIndicators() {
  await log('INFO', '🚀 Запуск сборщика unique-indicators (v2.0.0, saveRaw)');
  const started = Date.now();
  RATE_LIMIT.reset();

  const results = {};
  const indicatorsData = {};

  for (const indicatorId of Object.keys(INDICATORS)) {
    try {
      const result = await processIndicator(indicatorId);
      indicatorsData[indicatorId] = result;
      results[indicatorId] = { pointsCount: result.pointsCount, source_used: result.source_used, isDemo: result.isDemo, spikes: result.spikes_count, latest: result.latest, rolling_stats: result.rolling_stats };
      await log('INFO', `✅ ${indicatorId}: собрано ${result.pointsCount} точек (source=${result.source_used}, spikes=${result.spikes_count})`);
    } catch (e) {
      await log('ERROR', `❌ ${indicatorId}: ${e.message}`);
      results[indicatorId] = { error: e.message };
    }
  }

  const payload = { collected_at: new Date().toISOString(), indicators: indicatorsData, summary: results };
  const totalPoints = Object.values(indicatorsData).reduce((s, x) => s + x.pointsCount, 0);

  const result = await saveRaw('unique-indicators', payload, {
    collector: 'collect-unique-indicators.mjs',
    source: 'Unique indicators (pentagon-pizza + langley-taxis)',
    source_url: 'https://maps.google.com/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: totalPoints,
    notes: `Два индиктора: pentagon-pizza + langley-taxis; rate_limit_hits=${RATE_LIMIT.counter}; basket не перезаписывается`,
    backwardCompat: false,
  });

  const elapsed = ((Date.now() - started) / 1000).toFixed(2);
  await log('INFO', `✅ Готово. ${Object.keys(results).length} индикаторов, ${totalPoints} точек за ${elapsed}с → ${result.raw_file}`);
  return payload;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUniqueIndicators().catch(e => { console.error('[unique-indicators] Fatal:', e.message); process.exit(1); });
}
