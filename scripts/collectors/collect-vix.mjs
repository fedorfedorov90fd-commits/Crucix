#!/usr/bin/env node
/**
 * Crucix Collector: vix (индекс волатильности CBOE VIX).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: Yahoo Finance ^VIX (реальный API) + fallback demo 365 дней.
 * Формат: [{date, value}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=1y';
const TIMEOUT_MS = 20000;

async function fetchVIX() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const data = await response.json();
    const result = data.chart.result[0];
    const timestamps = result.timestamp;
    const close = result.indicators.quote[0].close;
    const vixData = [];
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000);
      const value = close[i];
      if (value !== null && value !== undefined) {
        vixData.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
      }
    }
    return vixData;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function demoVIX() {
  const now = new Date();
  const data = [];
  let value = 16;
  let trend = 0;
  for (let i = 365; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    trend = trend * 0.99 + (Math.random() - 0.5) * 0.3;
    const noise = (Math.random() - 0.5) * 1.5;
    const spike = Math.random() > 0.97 ? Math.random() * 8 : 0;
    value = 16 + trend * 5 + noise + spike;
    value = Math.max(10, Math.min(45, value));
    data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
  }
  return data;
}

export async function collectVIX() {
  console.log('[VIX] Запрос к Yahoo Finance...');
  let data;
  let ok = false;
  try {
    data = await fetchVIX();
    if (data.length > 0) ok = true;
    else throw new Error('empty result');
  } catch (e) {
    console.error('[VIX] ⚠️ Ошибка:', e.message);
    data = demoVIX();
  }
  const result = await saveRaw('vix', data, {
    collector: 'collect-vix.mjs',
    source: ok ? 'Yahoo Finance (^VIX)' : 'VIX (demo fallback)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P365D',
    record_count: data.length,
    notes: ok ? `Реальные данные Yahoo (${data.length} точек)` : 'Fallback (Yahoo недоступен, demo 365 дней); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[VIX] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectVIX().catch(e => { console.error('[VIX] FATAL:', e.message); process.exit(1); });
}
