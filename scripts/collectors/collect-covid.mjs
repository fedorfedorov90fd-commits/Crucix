#!/usr/bin/env node
/**
 * Crucix Collector: COVID-19 (disease.sh API, без ключа).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: реальный API → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: https://disease.sh/v3/covid-19/countries
 * Формат: {source, lastUpdated, totalRecords, countries:[...], note}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://disease.sh/v3/covid-19/countries';
const MAX_COUNTRIES = 50;
const TIMEOUT_MS = 15000;

function buildFallback() {
  return {
    source: 'COVID-19 API',
    lastUpdated: new Date().toISOString(),
    totalRecords: 0,
    countries: [],
    note: 'API недоступен, fallback пустой',
  };
}

export async function collectCovid() {
  console.log('[COVID] Загрузка статистики...');
  let basketData;
  let ok = false;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    basketData = {
      source: 'COVID-19 API',
      lastUpdated: new Date().toISOString(),
      totalRecords: data.length,
      countries: data.slice(0, MAX_COUNTRIES).map(c => ({
        country: c.country || 'Unknown',
        cases: c.cases || 0,
        deaths: c.deaths || 0,
        recovered: c.recovered || 0,
        active: c.active || 0,
        critical: c.critical || 0,
        todayCases: c.todayCases || 0,
        todayDeaths: c.todayDeaths || 0,
        population: c.population || 0,
      })),
      note: 'Данные загружены через disease.sh API (без ключа)',
    };
    console.log(`[COVID] Получено ${data.length} стран, взято ${basketData.countries.length}`);
    ok = true;
  } catch (e) {
    console.error('[COVID] ⚠️ Ошибка API:', e.message);
    basketData = buildFallback();
  }

  const result = await saveRaw('covid', basketData, {
    collector: 'collect-covid.mjs',
    source: 'disease.sh COVID-19 API',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.countries.length,
    notes: ok ? 'Реальные данные disease.sh' : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[COVID] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCovid().catch((e) => { console.error('[COVID] FATAL:', e); process.exit(1); });
}
