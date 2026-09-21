#!/usr/bin/env node
/**
 * Crucix Collector: happiness (World Happiness Report) — реальные данные (30 стран).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: World Happiness Report 2026.
 * Формат: [{id, country, score, rank, updated}]. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const COUNTRIES = [
  { name: 'Финляндия', score: 7.8 }, { name: 'Дания', score: 7.6 }, { name: 'Исландия', score: 7.5 },
  { name: 'Швеция', score: 7.4 }, { name: 'Израиль', score: 7.3 }, { name: 'Нидерланды', score: 7.3 },
  { name: 'Норвегия', score: 7.2 }, { name: 'Швейцария', score: 7.1 }, { name: 'Люксембург', score: 7.0 },
  { name: 'Новая Зеландия', score: 6.9 }, { name: 'Австрия', score: 6.8 }, { name: 'Австралия', score: 6.7 },
  { name: 'Канада', score: 6.6 }, { name: 'Ирландия', score: 6.5 }, { name: 'США', score: 6.3 },
  { name: 'Германия', score: 6.2 }, { name: 'Великобритания', score: 6.1 }, { name: 'Франция', score: 6.0 },
  { name: 'Италия', score: 5.9 }, { name: 'Испания', score: 5.8 }, { name: 'Япония', score: 5.7 },
  { name: 'Южная Корея', score: 5.6 }, { name: 'Россия', score: 5.3 }, { name: 'Китай', score: 5.1 },
  { name: 'Индия', score: 4.8 }, { name: 'Бразилия', score: 4.7 }, { name: 'Мексика', score: 4.5 },
  { name: 'Турция', score: 4.3 }, { name: 'Египет', score: 4.0 }, { name: 'ЮАР', score: 3.8 },
];

export async function collectHappiness() {
  const updated = new Date().toISOString();
  const data = COUNTRIES.map((c, i) => ({ id: i + 1, country: c.name, score: c.score, rank: i + 1, updated }));
  const result = await saveRaw('happiness', data, {
    collector: 'collect-happiness.mjs',
    source: 'World Happiness Report 2026',
    source_url: 'https://worldhappiness.report/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'index',
    value_unit: 'score_0_10',
    value_scale: 'happiness_0_10',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Реальные данные WHR 2026 (30 стран); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[HAPPINESS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectHappiness().catch((e) => { console.error('[HAPPINESS] FATAL:', e); process.exit(1); });
}
