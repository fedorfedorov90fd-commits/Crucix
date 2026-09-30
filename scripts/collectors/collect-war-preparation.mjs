#!/usr/bin/env node
/**
 * Crucix Collector: war-preparation (индекс подготовки к войне) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{date, value, region, notam, gps, status}]. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const BASE_VALUES = [65,66,67,68,69,70,71,72,73,74,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90,91,92,93,94];
const REGIONS = ['Восточная Европа', 'Ближний Восток', 'Южно-Китайское море', 'Корейский полуостров', 'Балканы'];

function generateWarPreparation() {
  const now = new Date();
  const data = [];
  for (let i = 0; i < BASE_VALUES.length; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - (BASE_VALUES.length - 1 - i));
    data.push({
      date: date.toISOString().slice(0, 10),
      value: BASE_VALUES[i],
      region: REGIONS[i % REGIONS.length],
      notam: Math.floor(Math.random() * 5) + 1,
      gps: Math.floor(Math.random() * 5) + 1,
      status: BASE_VALUES[i] > 70 ? 'high' : BASE_VALUES[i] > 50 ? 'medium' : 'low',
    });
  }
  return data;
}

export async function collectWarPreparation() {
  const data = generateWarPreparation();
  const result = await saveRaw('war-preparation', data, {
    collector: 'collect-war-preparation.mjs',
    source: 'War preparation index (demo)',
    source_url: 'local://reference',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'score_0_100',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.length,
    notes: 'Демо-данные (индекс подготовки к войне); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[WAR_PREPARATION] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectWarPreparation().catch(e => { console.error('[WAR_PREPARATION] FATAL:', e.message); process.exit(1); });
}
