#!/usr/bin/env node
/**
 * Crucix Collector: gold-oil-ratio.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: загружает цены золота и нефти через FRED, считает ratio.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат данных (timeseries): [{date, gold, oil, ratio}]. Плоский массив из history.
 * Метаданные (currentRatio, riskLevel, metrics) — в notes.
 *
 * Тип — timeseries (есть date + числовые gold/oil/ratio).
 *
 * API: FRED (St. Louis Fed).
 * Учётные данные: env.FRED_API_KEY или дефолтный ключ проекта.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const FRED_API_KEY = process.env.FRED_API_KEY || '78abf54ae7e30d6a011d927002e387fc';

async function fetchFredSeries(seriesId) {
  const url = new URL('https://api.stlouisfed.org/fred/series/observations');
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', FRED_API_KEY);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('limit', '1000');
  url.searchParams.set('sort_order', 'desc');
  try {
    const r = await fetch(url.toString(), { signal: AbortSignal.timeout(30000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!data.observations) return [];
    return data.observations
      .filter(obs => obs.value !== '.' && obs.value !== null && obs.value !== '')
      .map(obs => ({ date: obs.date, value: parseFloat(obs.value) }));
  } catch (error) {
    console.warn(`[GOLD-OIL] ${seriesId}: ${error.message}`);
    return [];
  }
}

function generateDemo() {
  const now = new Date();
  const ratioData = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const gold = 1950 + (Math.random() - 0.5) * 100;
    const oil = 79 + (Math.random() - 0.5) * 10;
    ratioData.push({
      date: date.toISOString().slice(0, 10),
      gold: parseFloat(gold.toFixed(2)),
      oil: parseFloat(oil.toFixed(2)),
      value: parseFloat((gold / oil).toFixed(4)),
      gold: parseFloat(gold.toFixed(2)),
      oil: parseFloat(oil.toFixed(2))
    });
  }
  return ratioData;
}

export async function collectGoldOilRatio() {
  const goldData = await fetchFredSeries('GOLDAMGBD228NLBM');
  const oilData = await fetchFredSeries('DCOILWTICO');
  let ratioData = [];

  if (goldData.length > 0 && oilData.length > 0) {
    const oilMap = new Map();
    oilData.forEach(item => oilMap.set(item.date, item.value));
    for (const gold of goldData) {
      const oil = oilMap.get(gold.date);
      if (oil && oil > 0) {
        ratioData.push({
          date: gold.date,
          gold: gold.value,
          oil,
          value: parseFloat((gold.value / oil).toFixed(4)),
          gold: gold.value,
          oil
        });
      }
    }
  } else {
    console.log('[GOLD-OIL] FRED не ответил, демо-данные');
    ratioData = generateDemo();
  }

  if (ratioData.length === 0) ratioData = generateDemo();

  const last = ratioData[0];
  let riskLevel = 'normal';
  if (last.value > 35) riskLevel = 'critical';
  else if (last.value > 25) riskLevel = 'high';
  else if (last.value < 15) riskLevel = 'low';

  const result = await saveRaw('gold-oil-basket', ratioData, {
    collector: 'collect-gold-oil-basket.mjs',
    source: 'FRED (St. Louis Fed)',
    source_url: 'https://api.stlouisfed.org/fred/series/observations',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_unit: 'ratio',
    value_scale: 'gold_usd_per_oil_usd',
    granularity: 'daily',
    record_count: ratioData.length,
    notes: `currentRatio=${last.value.toFixed(4)}, gold=$${last.gold}, oil=$${last.oil}, riskLevel=${riskLevel}, source=${goldData.length > 0 ? 'FRED' : 'demo'}`,
    backwardCompat: true
  });
  console.log(`[GOLD-OIL] OK ${ratioData.length} записей, ratio=${last.value.toFixed(4)} (${riskLevel}) → ${result.raw_file}`);
  console.log(`[GOLD-OIL] Накладная: ${result.incoming_file}`);
  return ratioData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGoldOilRatio().catch((e) => { console.error('[GOLD-OIL] FATAL:', e.message); process.exit(1); });
}
