#!/usr/bin/env node
/**
 * Crucix Collector: ucdp (конфликты UCDP) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: UCDP PRIO (zip+CSV — прямой парсинг сложен, demo-fallback).
 * Формат: {source, lastUpdated, conflicts:[...], note}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectUCDP() {
  console.log('[UCDP] Запуск...');
  const basketData = {
    source: 'UCDP',
    lastUpdated: new Date().toISOString(),
    conflicts: [
      { region: 'Ukraine', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Syria', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Yemen', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Sudan', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Myanmar', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Gaza', type: 'Armed Conflict', year: 2024, status: 'active' },
      { region: 'Ethiopia', type: 'Armed Conflict', year: 2024, status: 'active' },
    ],
    note: 'Demo. Для реальных данных требуется парсинг ZIP→CSV UCDP',
  };
  const result = await saveRaw('ucdp', basketData, {
    collector: 'collect-ucdp.mjs',
    source: 'UCDP (demo)',
    source_url: 'https://ucdp.uu.se/downloads/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.conflicts.length,
    notes: `Demo: 7 активных конфликтов; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[UCDP] OK ${basketData.conflicts.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectUCDP().catch(e => { console.error('[UCDP] FATAL:', e.message); process.exit(1); });
}
