#!/usr/bin/env node
/**
 * Crucix Collector: russian-sources (сводка российских источников) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: {source, timestamp, weather:[...], tass:[...], rbc:[...], interfax:[...]}. Тип — hierarchical.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectRussianSources() {
  console.log('[Russian] Сбор...');
  const now = new Date().toISOString();
  const data = {
    source: 'russian',
    timestamp: now,
    weather: [
      { city: 'Москва', temp: 15, condition: 'Облачно' },
      { city: 'СПб', temp: 12, condition: 'Дождь' },
    ],
    tass: [{ title: 'Путин провел совещание', category: 'Политика' }],
    rbc: [{ title: 'Акции Сбербанка обновили максимум', category: 'Бизнес' }],
    interfax: [{ title: 'ВС РФ взяли новый пункт', category: 'СВО' }],
  };

  const totalItems = data.weather.length + data.tass.length + data.rbc.length + data.interfax.length;
  const result = await saveRaw('russian-sources', data, {
    collector: 'collect-russian-sources.mjs',
    source: 'Russian sources (demo)',
    source_url: 'local://demo',
    license: 'public-domain',
    format_hint: 'hierarchical',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: totalItems,
    notes: `Демо-данные (weather+tass+rbc+interfax, ${totalItems} записей); basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[Russian] OK ${totalItems} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRussianSources().catch((e) => { console.error('[Russian] FATAL:', e); process.exit(1); });
}
