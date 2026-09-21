#!/usr/bin/env node
/**
 * Crucix Collector: openaq (качество воздуха, реальный API + fallback).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://api.openaq.org/v2/latest?limit=100
 * Формат: {source, lastUpdated, totalRecords, measurements:[...], note}. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.openaq.org/v2/latest?limit=100';
const TIMEOUT_MS = 15000;

function buildFallback() {
  return {
    source: 'OpenAQ (DEMO)',
    lastUpdated: new Date().toISOString(),
    totalRecords: 8,
    measurements: [
      { city: 'Beijing', country: 'CN', parameter: 'pm25', value: 35, unit: 'µg/m³' },
      { city: 'London', country: 'GB', parameter: 'pm25', value: 12, unit: 'µg/m³' },
      { city: 'New York', country: 'US', parameter: 'pm25', value: 8, unit: 'µg/m³' },
      { city: 'Moscow', country: 'RU', parameter: 'pm25', value: 25, unit: 'µg/m³' },
      { city: 'Delhi', country: 'IN', parameter: 'pm25', value: 120, unit: 'µg/m³' },
      { city: 'Paris', country: 'FR', parameter: 'pm25', value: 15, unit: 'µg/m³' },
      { city: 'Tokyo', country: 'JP', parameter: 'pm25', value: 10, unit: 'µg/m³' },
      { city: 'Sydney', country: 'AU', parameter: 'pm25', value: 5, unit: 'µg/m³' },
    ],
    note: 'Демо-данные (OpenAQ API недоступен)',
  };
}

export async function collectOpenAQ() {
  console.log('[OpenAQ] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    basketData = {
      source: 'OpenAQ',
      lastUpdated: new Date().toISOString(),
      totalRecords: data.results?.length || 0,
      measurements: (data.results || []).slice(0, 50).map(r => ({
        city: r.city || 'Unknown', country: r.country || 'Unknown',
        location: r.location || 'Unknown', parameter: r.parameter || 'Unknown',
        value: r.value || 0, unit: r.unit || 'Unknown', lastUpdated: r.lastUpdated || new Date().toISOString(),
      })),
      note: 'Данные загружены через OpenAQ API (без ключа)',
    };
    console.log(`[OpenAQ] Всего записей: ${basketData.totalRecords}`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[OpenAQ] ⚠️ Ошибка:', e.message);
    basketData = buildFallback();
  }

  const result = await saveRaw('openaq', basketData, {
    collector: 'collect-openaq.mjs',
    source: 'OpenAQ API',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'µg/m³',
    value_scale: 'air_quality_pm25',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.measurements.length,
    notes: ok ? 'Реальные данные OpenAQ' : 'Fallback demo (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OpenAQ] OK ${basketData.measurements.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpenAQ().catch((e) => { console.error('[OpenAQ] FATAL:', e); process.exit(1); });
}
