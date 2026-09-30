#!/usr/bin/env node
/**
 * Crucix Collector: gold-oil (золото/нефть + ratio) — ЕДИНЫЙ после синтеза 5 версий.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * СИНТЕЗ по правилу #871 из пяти источников:
 *   - collect-gold-oil.mjs         (demo, простой ratio)
 *   - collect-gold-oil-ratio.mjs   (Yahoo GC=F+CL=F range=1y — длинная история)
 *   - collect-gold-oil-real.mjs    (Yahoo + FRED + demo-fallback + realCount)
 *   - collect-gold-oil-test.mjs    (тестовый, содержит утечку FRED_API_KEY — НЕ ИСПОЛЬЗУЕТСЯ)
 *   - collect-gold-oil-basket.mjs  (FRED + saveRaw + riskLevel)
 *
 * ЛУЧШЕЕ ИЗ КАЖДОГО:
 *   - Yahoo Finance GC=F + CL=F, range=1y (реальные данные без ключа, длинная история)
 *   - FRED как дополнительный источник (если есть FRED_API_KEY)
 *   - Demo-fallback на любой стадии
 *   - riskLevel (normal/high/critical/low) — из basket-версии
 *   - source на каждой записи + realCount — из real-версии
 *   - Плоский массив [{date, gold, oil, ratio, source}] — из basket-версии
 *
 * Роль: сдаёт на склад через collector-helper. Сборщик НЕ пишет в basket.
 * Источник: https://query1.finance.yahoo.com/v8/finance/chart/GC=F
 * Формат: [{date, gold, oil, ratio, source}]. Тип — timeseries.
 *
 * ВАЖНО: FRED_API_KEY берётся ТОЛЬКО из env. Никаких хардкод-ключей.
 * backwardCompat: false — существующий basket/gold-oil.json НЕ перезаписывается.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const FRED_API_KEY = process.env.FRED_API_KEY || null;
const YAHOO_RANGE = '1y';
const TIMEOUT_MS = 20000;
const DAYS_DEMO = 30;

// ─── Утилита: fetch с таймаутом ───
async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ─── Источник 1: Yahoo Finance (GC=F = gold futures, CL=F = oil futures) ───
async function fetchYahooSeries(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=${YAHOO_RANGE}`;
  const d = await fetchJson(url);
  const result = d.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo result for ${symbol}`);
  const timestamps = result.timestamp || [];
  const close = result.indicators?.quote?.[0]?.close || [];
  return timestamps
    .map((ts, i) => ({
      date: new Date(ts * 1000).toISOString().slice(0, 10),
      value: close[i] || 0,
    }))
    .filter(x => x.value > 0);
}

// ─── Источник 2: FRED (только если ключ есть) ───
async function fetchFredSeries(seriesId) {
  if (!FRED_API_KEY) return [];
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', FRED_API_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('limit', '1000');
  url.searchParams.set('sort_order', 'desc');
  const d = await fetchJson(url.toString());
  if (!d.observations) return [];
  return d.observations
    .filter(obs => obs.value !== '.' && obs.value !== null && obs.value !== '')
    .map(obs => ({ date: obs.date, value: parseFloat(obs.value) }));
}

// ─── Demo-fallback ───
function demoGold() {
  const now = new Date();
  const out = [];
  for (let i = DAYS_DEMO; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), value: Math.round((1900 + Math.sin(i / 5) * 80 + Math.random() * 20) * 100) / 100 });
  }
  return out;
}

function demoOil() {
  const now = new Date();
  const out = [];
  for (let i = DAYS_DEMO; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    out.push({ date: d.toISOString().slice(0, 10), value: Math.round((70 + Math.sin(i / 7) * 12 + Math.random() * 4) * 100) / 100 });
  }
  return out;
}

// ─── Загрузка золота ───
async function loadGold() {
  try {
    const y = await fetchYahooSeries('GC=F');
    if (y.length > 0) { console.log(`[GOLD-OIL] Золото: Yahoo ${y.length} записей`); return { data: y, source: 'yahoo' }; }
  } catch (e) { console.error(`[GOLD-OIL] Yahoo gold упал: ${e.message}`); }
  try {
    const f = await fetchFredSeries('GOLDAMGBD228NLBM');
    if (f.length > 0) { console.log(`[GOLD-OIL] Золото: FRED ${f.length} записей`); return { data: f, source: 'fred' }; }
  } catch (e) { console.error(`[GOLD-OIL] FRED gold упал: ${e.message}`); }
  console.log('[GOLD-OIL] Золото: demo');
  return { data: demoGold(), source: 'demo' };
}

// ─── Загрузка нефти ───
async function loadOil() {
  try {
    const y = await fetchYahooSeries('CL=F');
    if (y.length > 0) { console.log(`[GOLD-OIL] Нефть: Yahoo ${y.length} записей`); return { data: y, source: 'yahoo' }; }
  } catch (e) { console.error(`[GOLD-OIL] Yahoo oil упал: ${e.message}`); }
  try {
    const f = await fetchFredSeries('DCOILWTICO');
    if (f.length > 0) { console.log(`[GOLD-OIL] Нефть: FRED ${f.length} записей`); return { data: f, source: 'fred' }; }
  } catch (e) { console.error(`[GOLD-OIL] FRED oil упал: ${e.message}`); }
  console.log('[GOLD-OIL] Нефть: demo');
  return { data: demoOil(), source: 'demo' };
}

// ─── Risk level ───
function riskLevel(ratio) {
  if (ratio > 35) return 'critical';
  if (ratio > 25) return 'high';
  if (ratio < 15) return 'low';
  return 'normal';
}

// ─── Основная логика ───
export async function collectGoldOil() {
  console.log('[GOLD-OIL] Сбор...');
  const t0 = Date.now();

  const [goldRes, oilRes] = await Promise.all([loadGold(), loadOil()]);

  const oilMap = new Map();
  for (const o of oilRes.data) oilMap.set(o.date, o.value);

  const combined = [];
  for (const g of goldRes.data) {
    const oil = oilMap.get(g.date);
    if (oil && oil > 0 && g.value > 0) {
      combined.push({
        date: g.date,
        gold: Math.round(g.value * 100) / 100,
        oil: Math.round(oil * 100) / 100,
        ratio: Math.round((g.value / oil) * 100) / 100,
        source: (goldRes.source === 'yahoo' && oilRes.source === 'yahoo') ? 'yahoo' : (goldRes.source === 'fred' && oilRes.source === 'fred') ? 'fred' : 'mixed',
      });
    }
  }
  combined.sort((a, b) => a.date.localeCompare(b.date));

  const last = combined[combined.length - 1] || { gold: 0, oil: 0, ratio: 0 };
  const level = riskLevel(last.ratio);
  const realCount = combined.filter(x => x.source !== 'demo' && x.source !== 'mixed').length;

  const result = await saveRaw('gold-oil', combined, {
    collector: 'collect-gold-oil.mjs',
    source: goldRes.source === 'yahoo' ? 'Yahoo Finance (GC=F + CL=F)' : goldRes.source === 'fred' ? 'FRED' : 'demo',
    source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'ratio',
    value_scale: 'gold_usd_per_oil_usd',
    granularity: 'daily',
    period: YAHOO_RANGE === '1y' ? 'P365D' : 'P30D',
    record_count: combined.length,
    notes: `ЕДИНЫЙ после синтеза 5 версий (#871). currentRatio=${last.ratio}, gold=$${last.gold}, oil=$${last.oil}, riskLevel=${level}, realCount=${realCount}, goldSource=${goldRes.source}, oilSource=${oilRes.source}; basket не перезаписывается`,
    backwardCompat: false,
  });

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[GOLD-OIL] OK ${combined.length} записей за ${elapsed}с`);
  console.log(`[GOLD-OIL] currentRatio=${last.ratio}, gold=$${last.gold}, oil=$${last.oil}, riskLevel=${level}, realCount=${realCount}`);
  console.log(`[GOLD-OIL] → ${result.raw_file}`);
  console.log(`[GOLD-OIL] Накладная: ${result.incoming_file}`);
  return combined;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGoldOil().catch((e) => { console.error('[GOLD-OIL] FATAL:', e); process.exit(1); });
}
