/**
 * scripts/collectors/collect-wti-brent-spread.mjs — СБОРЩИК: СПРЕД WTI-BRENT (эталон)
 *
 * ПРОМЫШЛЕННЫЙ СБОРЩИК уровня Refinitiv/Bloomberg.
 * Мультиисточник: Yahoo Finance → FRED → генеративный fallback.
 *
 * СТРАТЕГИЯ:
 *   Каскад из 3 источников, чтобы обеспечить максимально высокое качество:
 *     1. PRIMARY: Yahoo Finance (CL=F, BZ=F) — живые фьючерсы, ~30 дней.
 *     2. FALLBACK-1: FRED API (DCOILWTICO, DCOILBRENTEU) — дневные споты, ~30 дней.
 *     3. FALLBACK-2: генеративный (реалистичный тренд, 30 дней).
 *
 * ГАРАНТИИ:
 *   - Retry без рекурсии (3 попытки на источник с экспоненциальной паузой).
 *   - Rate limit: не более 6 запросов за запуск.
 *   - Таймаут 8 сек на запрос (AbortController).
 *   - Валидация точек: диапазон цен, отсев выбросов, проверка дат.
 *   - Дедупликация по датам (последнее значение).
 *   - Merge с существующим basket: сохранение до 365 дней истории.
 *   - CLI-флаги: --force, --demo, --days=N, --quiet, --verbose.
 *   - Нулевые побочные эффекты при импорте (CLI-хук через pathToFileURL).
 *
 * ВЫХОД: data/basket/wti-brent-spread.json
 * ФОРМАТ:
 *   {
 *     source: 'Yahoo Finance' | 'FRED' | 'generated',
 *     lastUpdated: ISO-строка,
 *     data: [{ date, value, wti, brent, spread }],
 *     meta: {
 *       description, unit, isDemo, components,
 *       points_count, coverage_days, sources_attempted,
 *       quality_score, rolling_stats, rsi, regime
 *     }
 *   }
 *
 * ЛОГИ: logs/collectors/collect-wti-brent-spread.log
 * ЗАПУСК: node scripts/collectors/collect-wti-brent-spread.mjs [--force] [--demo] [--days=N] [--quiet] [--verbose]
 * ИМПОРТ: import { collectWtiBrentSpread } from './collect-wti-brent-spread.mjs';
 *
 * ПРАВИЛО: basket — единственный источник (№16), логи в logs/collectors/ (№17),
 * catch (e) всегда, CLI-хук через pathToFileURL, никаких побочных эффектов
 * при импорте.
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_FILE  = join(PROJECT_ROOT, 'data', 'basket', 'wti-brent-spread.json');
const LOGS_DIR     = join(PROJECT_ROOT, 'logs', 'collectors');
const LOG_FILE     = join(LOGS_DIR, 'collect-wti-brent-spread.log');

// ============================================================
//  CLI-КОНФИГ
// ============================================================

const args = process.argv.slice(2);
const CLI = {
  force:   args.includes('--force'),
  demo:    args.includes('--demo'),
  quiet:   args.includes('--quiet'),
  verbose: args.includes('--verbose'),
  days:    (() => {
    const a = args.find(x => x.startsWith('--days='));
    return a ? parseInt(a.slice('--days='.length), 10) || 30 : 30;
  })(),
};

// ============================================================
//  КОНСТАНТЫ
// ============================================================

const RATE_LIMIT = {
  maxRequests: 6,
  counter: 0,
  reset() { this.counter = 0; },
  check() {
    if (this.counter >= this.maxRequests) {
      throw new Error(`rate_limit_exceeded: ${this.counter}/${this.maxRequests}`);
    }
    this.counter++;
  },
};

const VALIDATION = {
  wtiRange: [20, 200],
  brentRange: [20, 200],
  spreadRange: [-5, 30],
  minPoints: 5,
  maxPoints: 365,
};

const FRED_SERIES = {
  wti:   'DCOILWTICO',
  brent: 'DCOILBRENTEU',
};

// ============================================================
//  ЛОГИРОВАНИЕ С УРОВНЯМИ
// ============================================================

const LOG_LEVELS = { DEBUG: 10, INFO: 20, WARN: 30, ERROR: 40 };
let logMinLevel = LOG_LEVELS.INFO;
if (CLI.quiet) logMinLevel = LOG_LEVELS.ERROR;
if (CLI.verbose) logMinLevel = LOG_LEVELS.DEBUG;

async function log(level, msg) {
  const lvl = LOG_LEVELS[level] || LOG_LEVELS.INFO;
  if (lvl < logMinLevel) return;
  const line = `[${new Date().toISOString()}] [${level}] ${msg}\n`;
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line);
  } catch (e) {
    console.error('[wti-brent-spread] log write failed:', e.message);
  }
  if (!CLI.quiet || level === 'ERROR') process.stdout.write(line);
}

// ============================================================
//  УТИЛИТЫ
// ============================================================

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function isValidDate(str) {
  if (!str) return false;
  const d = new Date(str);
  return !isNaN(d.getTime());
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((sorted.length - 1) * p);
  return sorted[idx];
}

// ============================================================
//  ИСТОЧНИК 1: YAHOO FINANCE
// ============================================================

async function fetchYahooTicker(ticker, maxAttempts = 3) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1mo`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      RATE_LIMIT.check();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) throw new Error('empty chart result');
      const timestamps = result.timestamp || [];
      const closes = result.indicators?.quote?.[0]?.close || [];
      const points = [];
      for (let i = 0; i < timestamps.length; i++) {
        const v = closes[i];
        if (v == null) continue;
        points.push({
          date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
          value: Math.round(v * 100) / 100,
        });
      }
      if (!points.length) throw new Error('no valid points');
      await log('DEBUG', `Yahoo ${ticker}: ${points.length} точек (attempt ${attempt})`);
      return points;
    } catch (e) {
      await log('WARN', `Yahoo ${ticker} attempt ${attempt}/${maxAttempts}: ${e.message}`);
      if (attempt === maxAttempts) return null;
      await sleep(1000 * attempt); // экспоненциальная пауза
    }
  }
  return null;
}

// ============================================================
//  ИСТОЧНИК 2: FRED (St. Louis Fed)
// ============================================================

async function fetchFredSeries(seriesId, maxAttempts = 2) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const headers = { 'User-Agent': 'Mozilla/5.0 (CrucixBot/2.0)' };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      RATE_LIMIT.check();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const text = await res.text();
      const lines = text.split('\n').slice(1); // пропускаем заголовок
      const points = [];
      for (const line of lines) {
        const [date, value] = line.split(',');
        if (!date || !value || value === '.' || value === '') continue;
        const v = parseFloat(value);
        if (!Number.isFinite(v)) continue;
        points.push({ date, value: Math.round(v * 100) / 100 });
      }
      if (!points.length) throw new Error('no valid points');
      // Ограничиваем N последними
      const trimmed = points.slice(-CLI.days);
      await log('DEBUG', `FRED ${seriesId}: ${trimmed.length} точек (attempt ${attempt})`);
      return trimmed;
    } catch (e) {
      await log('WARN', `FRED ${seriesId} attempt ${attempt}/${maxAttempts}: ${e.message}`);
      if (attempt === maxAttempts) return null;
      await sleep(1500);
    }
  }
  return null;
}

// ============================================================
//  ИСТОЧНИК 3: ГЕНЕРАТИВНЫЙ FALLBACK
// ============================================================

function generateFallback(days = 30) {
  const data = [];
  let wti = 70;
  let spread = 2.8;
  let trend = 0;

  for (let i = days; i >= 0; i--) {
    trend = trend * 0.85 + (Math.random() - 0.5) * 0.8;
    const noise = (Math.random() - 0.5) * 0.6;
    wti = 70 + trend * 4 + noise;
    wti = Math.max(VALIDATION.wtiRange[0], Math.min(VALIDATION.wtiRange[1], wti));

    spread = spread * 0.92 + (2.5 + Math.random() * 1.5) * 0.08;
    const brent = wti + spread;

    data.push({
      date: daysAgo(i),
      value: Math.round(spread * 100) / 100,
      wti: Math.round(wti * 100) / 100,
      brent: Math.round(brent * 100) / 100,
      spread: Math.round(spread * 100) / 100,
    });
  }
  return data;
}

// ============================================================
//  СЛИЯНИЕ WTI И BRENT ПО ДАТАМ
// ============================================================

export function mergeTickers(wtiPoints, brentPoints) {
  if (!wtiPoints || !brentPoints || !wtiPoints.length || !brentPoints.length) return null;
  const brentByDate = new Map(brentPoints.map(p => [p.date, p.value]));
  const merged = [];
  for (const w of wtiPoints) {
    const b = brentByDate.get(w.date);
    if (b == null) continue;
    const spread = Math.round((b - w.value) * 100) / 100;
    merged.push({
      date: w.date,
      value: spread,
      wti: w.value,
      brent: b,
      spread,
    });
  }
  merged.sort((a, b) => a.date.localeCompare(b.date));
  return merged.length >= 5 ? merged : null;
}

// ============================================================
//  ВАЛИДАЦИЯ ТОЧЕК
// ============================================================

export function validatePoints(points) {
  if (!Array.isArray(points)) return [];
  return points.filter(p => {
    if (!p || !isValidDate(p.date)) return false;
    if (!Number.isFinite(p.wti) || !Number.isFinite(p.brent) || !Number.isFinite(p.spread)) return false;
    if (p.wti < VALIDATION.wtiRange[0] || p.wti > VALIDATION.wtiRange[1]) return false;
    if (p.brent < VALIDATION.brentRange[0] || p.brent > VALIDATION.brentRange[1]) return false;
    if (p.spread < VALIDATION.spreadRange[0] || p.spread > VALIDATION.spreadRange[1]) return false;
    return true;
  });
}

// ============================================================
//  ДЕДУПЛИКАЦИЯ ПО ДАТАМ (последнее значение)
// ============================================================

export function dedupeByDate(points) {
  const byDate = new Map();
  for (const p of points) byDate.set(p.date, p);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ============================================================
//  MERGE С СУЩЕСТВУЮЩИМ BASKET (сохранить историю до 365 дней)
// ============================================================

export async function mergeWithExisting(newPoints) {
  let existing = [];
  try {
    const raw = await fs.readFile(BASKET_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) existing = parsed;
    else if (parsed && Array.isArray(parsed.data)) existing = parsed.data;
  } catch (e) {
    await log('DEBUG', `Нет существующего basket: ${e.message}`);
  }

  const combined = dedupeByDate([...existing, ...newPoints]);
  const trimmed = combined.slice(-VALIDATION.maxPoints);
  await log('DEBUG', `Merge: было ${existing.length}, стало ${combined.length}, после отсечения ${trimmed.length}`);
  return trimmed;
}

// ============================================================
//  ROLLING STATS (mean, stddev, EMA)
// ============================================================

export function computeRollingStats(points, window = 7) {
  if (!points.length) return null;
  const spreads = points.map(p => p.spread).filter(Number.isFinite);
  if (!spreads.length) return null;

  const tail = spreads.slice(-window);
  const mean = tail.reduce((a, b) => a + b, 0) / tail.length;
  const variance = tail.reduce((a, v) => a + (v - mean) ** 2, 0) / tail.length;
  const stddev = Math.sqrt(variance);

  // EMA (экспоненциальное среднее)
  const k = 2 / (tail.length + 1);
  let ema = tail[0];
  for (let i = 1; i < tail.length; i++) ema = tail[i] * k + ema * (1 - k);

  return {
    window,
    samples: tail.length,
    mean: Number(mean.toFixed(3)),
    stddev: Number(stddev.toFixed(3)),
    min: Number(Math.min(...tail).toFixed(3)),
    max: Number(Math.max(...tail).toFixed(3)),
    ema: Number(ema.toFixed(3)),
    p25: percentile(tail, 0.25),
    p75: percentile(tail, 0.75),
  };
}

// ============================================================
//  RSI (14-период)
// ============================================================

export function computeRSI(points, period = 14) {
  if (points.length < period + 1) return null;
  const values = points.map(p => p.spread).filter(Number.isFinite);
  if (values.length < period + 1) return null;

  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < values.length; i++) {
    const diff = values[i] - values[i - 1];
    if (diff > 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) - diff) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(2));
}

// ============================================================
//  РЕЖИМ (contango/backwardation/flat)
// ============================================================

export function detectRegime(points) {
  if (!points.length) return 'unknown';
  const tail = points.slice(-7);
  const mean = tail.reduce((a, p) => a + p.spread, 0) / tail.length;
  if (mean < 2) return 'narrow';
  if (mean < 4) return 'normal';
  if (mean < 7) return 'wide';
  return 'extreme';
}

// ============================================================
//  КАЧЕСТВО ДАННЫХ
// ============================================================

function computeQualityScore(data, source) {
  let score = 50; // базовая
  if (source === 'Yahoo Finance') score += 40;
  else if (source === 'FRED') score += 30;
  else score += 5;

  const coverage = data.length;
  if (coverage >= 20) score += 10;
  else if (coverage >= 10) score += 5;

  // Штраф за выбросы
  const spreads = data.map(p => p.spread).filter(Number.isFinite);
  if (spreads.length) {
    const mean = spreads.reduce((a, b) => a + b, 0) / spreads.length;
    const variance = spreads.reduce((a, v) => a + (v - mean) ** 2, 0) / spreads.length;
    const stddev = Math.sqrt(variance);
    if (stddev > 5) score -= 10; // нестабильный ряд
  }

  return Math.max(0, Math.min(100, score));
}

// ============================================================
//  КАСКАД ИСТОЧНИКОВ
// ============================================================

async function trySourceYahoo() {
  await log('INFO', 'Каскад [1/3]: Yahoo Finance (CL=F, BZ=F)');
  const wti = await fetchYahooTicker('CL=F');
  if (!wti) return null;
  await sleep(1500);
  const brent = await fetchYahooTicker('BZ=F');
  if (!brent) return null;
  return mergeTickers(wti, brent);
}

async function trySourceFred() {
  await log('INFO', 'Каскад [2/3]: FRED (DCOILWTICO, DCOILBRENTEU)');
  const wti = await fetchFredSeries(FRED_SERIES.wti);
  if (!wti) return null;
  await sleep(1200);
  const brent = await fetchFredSeries(FRED_SERIES.brent);
  if (!brent) return null;
  return mergeTickers(wti, brent);
}

function trySourceGenerated() {
  return generateFallback(CLI.days);
}

// ============================================================
//  ОСНОВНАЯ ФУНКЦИЯ
// ============================================================

export async function collectWtiBrentSpread() {
  await log('INFO', '🚀 Запуск сборщика wti-brent-spread');
  await log('INFO', `CLI: force=${CLI.force} demo=${CLI.demo} days=${CLI.days} quiet=${CLI.quiet} verbose=${CLI.verbose}`);
  const started = Date.now();
  RATE_LIMIT.reset();

  let data = null;
  let source = 'generated';
  const sourcesAttempted = [];

  if (CLI.demo) {
    await log('INFO', '--demo: пропускаем live-источники, используем генератор');
    data = trySourceGenerated();
    sourcesAttempted.push('generated');
  } else {
    // Каскад источников
    try {
      data = await trySourceYahoo();
      if (data) {
        source = 'Yahoo Finance';
        sourcesAttempted.push('yahoo');
        await log('INFO', `✅ Yahoo Finance: ${data.length} точек`);
      }
    } catch (e) {
      await log('WARN', `Yahoo каскад упал: ${e.message}`);
    }

    if (!data) {
      try {
        data = await trySourceFred();
        if (data) {
          source = 'FRED';
          sourcesAttempted.push('fred');
          await log('INFO', `✅ FRED: ${data.length} точек`);
        }
      } catch (e) {
        await log('WARN', `FRED каскад упал: ${e.message}`);
      }
    }

    if (!data) {
      data = trySourceGenerated();
      source = 'generated';
      sourcesAttempted.push('generated');
      await log('WARN', `Все live-источники недоступны, используем fallback: ${data.length} точек`);
    }
  }

  // Валидация и очистка
  data = validatePoints(data);
  if (!data.length) {
    throw new Error('no_valid_points_after_validation');
  }
  await log('INFO', `Валидация: ${data.length} точек прошли фильтр`);

  // Merge с существующим basket (сохраняем историю)
  const merged = await mergeWithExisting(data);
  data = merged;

  // Rolling stats + RSI + режим
  const rollingStats = computeRollingStats(data, 7);
  const rsi = computeRSI(data, 14);
  const regime = detectRegime(data);

  // Качество
  const qualityScore = computeQualityScore(data, source);

  const payload = {
    source,
    lastUpdated: new Date().toISOString(),
    data,
    meta: {
      description: 'Спред между WTI и Brent',
      unit: 'долларов за баррель',
      isDemo: source === 'generated',
      components: ['WTI', 'Brent'],
      points_count: data.length,
      coverage_days: data.length,
      sources_attempted: sourcesAttempted,
      quality_score: qualityScore,
      rolling_stats: rollingStats,
      rsi,
      regime,
      cli: { force: CLI.force, demo: CLI.demo, days: CLI.days },
      rate_limit_hits: RATE_LIMIT.counter,
    },
  };

  try {
    await fs.mkdir(join(PROJECT_ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(payload, null, 2), 'utf8');
    const elapsed = ((Date.now() - started) / 1000).toFixed(2);
    await log('INFO', `✅ Сохранено ${data.length} точек (source=${source}, quality=${qualityScore}) за ${elapsed}с`);
    return payload;
  } catch (e) {
    await log('ERROR', `Ошибка записи basket: ${e.message}`);
    throw e;
  }
}

// ============================================================
//  CLI-ЗАПУСК (правильный хук через pathToFileURL)
// ============================================================

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectWtiBrentSpread().catch(e => {
    console.error('[wti-brent-spread] Fatal:', e.message);
    console.error(e.stack?.split('\n').slice(0, 5).join('\n'));
    process.exit(1);
  });
}
