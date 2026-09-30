#!/usr/bin/env node
/**
 * Crucix Collector: conflicts (ACLED-совместимый, тестовые данные).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: тестовое сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: ACLED (для реальных данных нужен ключ).
 * Формат: [{date, value}] — агрегат по 5 странам. Тип — timeseries.
 * ПРИМЕЧАНИЕ: старый путь data/conflicts/history.json заменён на saveRaw.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COUNTRIES = ['Ukraine', 'Syria', 'Yemen', 'Sudan', 'Myanmar'];
const DAYS_BACK = 30;

function generateTestConflicts(country) {
  const data = [];
  const now = new Date();
  for (let i = DAYS_BACK; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const base = 10 + Math.sin(i / 3) * 8;
    const value = Math.round(Math.max(0, base + Math.random() * 15) * 100) / 100;
    data.push({ date, value, country });
  }
  return data;
}

export async function collectConflicts() {
  console.log('[Conflicts] Начинаю сбор...');
  let allData = [];
  for (const country of COUNTRIES) {
    const d = generateTestConflicts(country);
    allData = allData.concat(d);
    console.log(`[Conflicts] ${country}: ${d.length} записей`);
  }
  const daily = {};
  for (const item of allData) {
    if (!daily[item.date]) daily[item.date] = 0;
    daily[item.date] += item.value;
  }
  const result = Object.entries(daily)
    .map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const saveResult = await saveRaw('conflicts', result, {
    collector: 'collect-conflicts.mjs',
    source: 'ACLED (test data)',
    source_url: 'https://acleddata.com/api/acled/read',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'daily',
    period: 'P30D',
    record_count: result.length,
    notes: 'Тестовые данные по 5 странам; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Conflicts] OK ${result.length} дней → ${saveResult.raw_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectConflicts().catch((e) => { console.error('[Conflicts] FATAL:', e); process.exit(1); });
}
