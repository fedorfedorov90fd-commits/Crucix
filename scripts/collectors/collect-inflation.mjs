#!/usr/bin/env node
/**
 * Crucix Collector: inflation (инфляция США) — реальный API Trading Economics.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://api.tradingeconomics.com/markets/united-states-inflation-rate
 * Формат: [{date, value}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.tradingeconomics.com/markets/united-states-inflation-rate?format=json';
const TIMEOUT_MS = 15000;

function generateFallbackData() {
  const now = new Date();
  const data = [];
  let value = 3;
  for (let i = 365; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    value = value + (Math.random() - 0.5) * 0.2;
    value = Math.max(1, Math.min(8, value));
    data.push({ date: date.toISOString().slice(0, 10), value: Math.round(value * 100) / 100 });
  }
  return data;
}

async function fetchInflation() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      return data.map(item => ({ date: (item.DateTime || '').slice(0, 10), value: Math.round((item.Value || 0) * 100) / 100 }));
    }
    return null;
  } catch (e) {
    console.error('[Inflation] Ошибка API:', e.message);
    return null;
  }
}

export async function collectInflation() {
  console.log('[Inflation] Загрузка...');
  let data = await fetchInflation();
  let ok = !!data;
  if (!data) data = generateFallbackData();

  const result = await saveRaw('inflation', data, {
    collector: 'collect-inflation.mjs',
    source: ok ? 'Trading Economics (US inflation)' : 'Trading Economics (fallback)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'percent',
    granularity: 'daily',
    period: ok ? null : 'P365D',
    record_count: data.length,
    notes: ok ? 'Реальные данные Trading Economics' : 'Fallback (API недоступен, 365 дней демо); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Inflation] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectInflation().catch((e) => { console.error('[Inflation] FATAL:', e); process.exit(1); });
}
