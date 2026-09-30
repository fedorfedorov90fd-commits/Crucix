#!/usr/bin/env node
/**
 * Crucix Collector: ria (новости РИА) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: РИА Новости (демо).
 * Формат: {source, timestamp, total, news:[{title,category}]}. Тип — events.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const NEWS = [
  { title: 'Путин заявил о технологическом суверенитете', category: 'Политика' },
  { title: 'ЦБ сохранил ключевую ставку 18%', category: 'Экономика' },
  { title: 'ВС РФ взяли населённый пункт в ДНР', category: 'СВО' },
  { title: 'Трамп заявил о готовности к диалогу', category: 'Мир' },
  { title: 'Российские фигуристы завоевали золото', category: 'Спорт' },
];

export async function collectRIA() {
  const data = { source: 'ria', timestamp: new Date().toISOString(), total: NEWS.length, news: NEWS };
  const result = await saveRaw('ria', data, {
    collector: 'collect-ria.mjs',
    source: 'РИА Новости (demo)',
    source_url: 'https://ria.ru/',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: NEWS.length,
    notes: 'Демо-данные (5 новостей); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[RIA] OK ${NEWS.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRIA().catch((e) => { console.error('[RIA] FATAL:', e); process.exit(1); });
}
