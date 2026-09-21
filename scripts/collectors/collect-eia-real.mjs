#!/usr/bin/env node
/**
 * Crucix Collector: eia-real — заглушка (EIA требует API-ключ).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: информация о статусе → saveRaw. Сборщик НЕ пишет в basket.
 * Правило 12.2: EIA требует ключ → заменён на открытые данные.
 * Реальные энергетические данные — в отдельных источниках (oil, oil-gas, energy).
 * Формат: {source, updated, note, indicators}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectEiaReal() {
  console.log('[EIA-real] Заглушка (EIA требует ключ, правило 12.2)');
  const result = {
    source: 'EIA-replacement',
    updated: new Date().toISOString(),
    note: 'EIA требует API-ключ. Согласно правилу 12.2 заменён. Реальные энергетические данные — в отдельных источниках: oil.json, oil-gas.json, energy.json.',
    indicators: {},
  };

  const saveResult = await saveRaw('eia-real', result, {
    collector: 'collect-eia-real.mjs',
    source: 'EIA (заглушка)',
    source_url: 'https://www.eia.gov/opendata/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: 0,
    notes: 'Заглушка: EIA требует ключ (правило 12.2). Реальные данные — в oil/oil-gas/energy; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[EIA-real] OK → ${saveResult.raw_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectEiaReal().catch((e) => { console.error('[EIA-real] FATAL:', e); process.exit(1); });
}
