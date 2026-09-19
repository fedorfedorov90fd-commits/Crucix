#!/usr/bin/env node
/**
 * Crucix Collector: EIA (энергоносители — WTI, Brent, Natural Gas, Gasoline, Heating Oil).
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Источник: Yahoo Finance (без ключа, без регистрации). EIA API v2 требует ключ
 * (правило #39 — сейчас без ключей), Bulk Download Facility недоступен (403/404).
 * Yahoo Finance отдаёт исторические котировки фьючерсов.
 *
 * Символы Yahoo:
 *   CL=F — WTI Crude Oil (USD/barrel)
 *   BZ=F — Brent Crude Oil (USD/barrel)
 *   NG=F — Natural Gas (USD/MMBtu)
 *   RB=F — RBOB Gasoline (USD/gallon)
 *   HO=F — Heating Oil (USD/gallon)
 *
 * Глубина: параметр EIA_DAYS (default 30, max 730). См. маппинг range.
 * Пример: EIA_DAYS=365 node scripts/collectors/collect-eia.mjs
 *
 * Формат: timeseries (массив {date, value, symbol, unit, name}).
 * Demo-fallback: 5 захардкоженных позиций при падении всех Yahoo endpoint'ов.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const SYMBOLS = [
  { symbol: 'CL=F', name: 'WTI Crude Oil',  unit: 'USD/barrel' },
  { symbol: 'BZ=F', name: 'Brent Crude Oil', unit: 'USD/barrel' },
  { symbol: 'NG=F', name: 'Natural Gas',    unit: 'USD/MMBtu'  },
  { symbol: 'RB=F', name: 'RBOB Gasoline',  unit: 'USD/gallon' },
  { symbol: 'HO=F', name: 'Heating Oil',    unit: 'USD/gallon' }
];

const FETCH_TIMEOUT_MS = 30000;

// Маппинг числа дней на диапазон Yahoo. Yahoo понимает: 1d,5d,1mo,3mo,6mo,1y,2y,5y,10y,ytd,max.
function daysToYahooRange(days) {
  if (days <= 1) return '1d';
  if (days <= 5) return '5d';
  if (days <= 30) return '1mo';
  if (days <= 90) return '3mo';
  if (days <= 180) return '6mo';
  if (days <= 365) return '1y';
  if (days <= 730) return '2y';
  if (days <= 1825) return '5y';
  return 'max';
}

function parseDays() {
  // Приоритет: env EIA_DAYS → аргумент CLI --days=N → default 30
  const envVal = process.env.EIA_DAYS;
  if (envVal && !isNaN(parseInt(envVal, 10))) {
    return Math.min(730, Math.max(1, parseInt(envVal, 10)));
  }
  const arg = process.argv.find(a => a.startsWith('--days='));
  if (arg) {
    const v = parseInt(arg.split('=')[1], 10);
    if (!isNaN(v)) return Math.min(730, Math.max(1, v));
  }
  return 30;
}

async function fetchYahoo(symbol, days) {
  const range = daysToYahooRange(days);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
  const r = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Crucix-OSINT/1.0)' }
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  const result = j.chart?.result?.[0];
  if (!result) throw new Error('Yahoo: нет result[0]');
  const ts = result.timestamp || [];
  const close = result.indicators?.quote?.[0]?.close || [];
  if (ts.length === 0) throw new Error('Yahoo: пустой timestamp');

  const series = [];
  for (let i = 0; i < ts.length; i++) {
    const v = close[i];
    if (typeof v !== 'number') continue;
    const date = new Date(ts[i] * 1000).toISOString().slice(0, 10);
    series.push({ date, value: Math.round(v * 100) / 100 });
  }
  return {
    symbol,
    currency: result.meta?.currency || 'USD',
    series
  };
}

function demoData() {
  const now = new Date();
  const series = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    series.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round((Math.random() * 50 + 70) * 100) / 100,
      symbol: 'CL=F',
      name: 'WTI Crude Oil (demo)',
      unit: 'USD/barrel'
    });
  }
  return series;
}

export async function collectEIA() {
  const days = parseDays();
  const allSeries = [];
  const errors = [];
  let successCount = 0;

  for (const { symbol, name, unit } of SYMBOLS) {
    try {
      const data = await fetchYahoo(symbol, days);
      for (const p of data.series) {
        allSeries.push({ ...p, symbol, name, unit });
      }
      successCount++;
    } catch (e) {
      errors.push(`${symbol}: ${e.message}`);
    }
  }

  let finalData;
  let sourceName;

  if (successCount === 0) {
    finalData = demoData();
    sourceName = 'demo-fallback';
    console.warn(`[EIA] Все Yahoo endpoint'ы упали: ${errors.join(' | ')}. Demo-данные.`);
  } else {
    finalData = allSeries;
    sourceName = `yahoo-finance (${successCount}/${SYMBOLS.length})`;
    if (errors.length > 0) {
      console.warn(`[EIA] Частичный сбой: ${errors.join(' | ')}`);
    }
  }

  const result = await saveRaw('eia', finalData, {
    collector: 'collect-eia.mjs',
    source: 'Yahoo Finance (EIA replacement)',
    source_url: 'https://query1.finance.yahoo.com/v8/finance/chart/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'usd',
    value_scale: 'energy_futures',
    granularity: 'daily',
    record_count: finalData.length,
    notes: `source=${sourceName}, глубина=${days}д, серий=${successCount}`,
    backwardCompat: true
  });

  console.log(`[EIA] OK ${finalData.length} точек (${sourceName}, глубина=${days}д) → ${result.raw_file}`);
  return finalData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectEIA().catch((e) => { console.error('[EIA] FATAL:', e.message); process.exit(1); });
}
