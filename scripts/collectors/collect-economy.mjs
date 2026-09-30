#!/usr/bin/env node
/**
 * Crucix Collector: economy (FRED-индикаторы: VIX, 10Y Treasury, AAA) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: FRED API (https://fred.stlouisfed.org/).
 * Формат: [{date, value, indicator}]. Тип — timeseries.
 * ПРИМЕЧАНИЕ: старый путь data/economy/history.json заменён на saveRaw.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const INDICATORS = [
  { id: 'VIXCLS', name: 'VIX', base: 20, vol: 0.3 },
  { id: 'DGS10', name: '10Y Treasury', base: 4.3, vol: 0.1 },
  { id: 'DAAA', name: 'Corporate AAA', base: 5.2, vol: 0.1 },
];
const DAYS_BACK = 30;

function generateForIndicator(ind) {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = d.toISOString().slice(0, 10);
    const value = Math.round((ind.base + (Math.random() - 0.5) * ind.vol * 2) * 100) / 100;
    data.push({ date, value, indicator: ind.id });
  }
  return data;
}

export async function collectEconomy() {
  console.log('[Economy] Начинаем сбор...');
  let allData = [];
  for (const ind of INDICATORS) {
    const d = generateForIndicator(ind);
    allData = allData.concat(d);
    console.log(`[Economy] ${ind.id}: ${d.length} записей`);
  }
  const result = await saveRaw('economy', allData, {
    collector: 'collect-economy.mjs',
    source: 'FRED (demo)',
    source_url: 'https://fred.stlouisfed.org/',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    granularity: 'daily',
    period: 'P30D',
    record_count: allData.length,
    notes: `Демо-данные по ${INDICATORS.length} индикаторам; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[Economy] OK ${allData.length} → ${result.raw_file}`);
  return allData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectEconomy().catch((e) => { console.error('[Economy] FATAL:', e); process.exit(1); });
}
