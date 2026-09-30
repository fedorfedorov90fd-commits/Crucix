#!/usr/bin/env node
/**
 * Crucix Collector: pipelines (трубопроводы, 6 объектов с координатами).
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{name, lat1, lng1, lat2, lng2, type, countries, collected}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const PIPELINE_DATA = [
  { name: 'Северный поток', lat1: 60.0, lng1: 28.0, lat2: 54.0, lng2: 13.0, type: 'газ', countries: 'Россия-Германия' },
  { name: 'Турецкий поток', lat1: 42.0, lng1: 37.0, lat2: 41.0, lng2: 28.0, type: 'газ', countries: 'Россия-Турция' },
  { name: 'Дружба', lat1: 55.0, lng1: 37.0, lat2: 52.0, lng2: 21.0, type: 'нефть', countries: 'Россия-Европа' },
  { name: 'Трансальпийский', lat1: 47.0, lng1: 11.0, lat2: 45.0, lng2: 8.0, type: 'нефть', countries: 'Австрия-Италия' },
  { name: 'Ямал-Европа', lat1: 66.0, lng1: 70.0, lat2: 52.0, lng2: 16.0, type: 'газ', countries: 'Россия-Польша' },
  { name: 'Китай-Мьянма', lat1: 22.0, lng1: 96.0, lat2: 28.0, lng2: 98.0, type: 'нефть', countries: 'Мьянма-Китай' },
];

export async function collectPipelines() {
  const now = new Date().toISOString();
  const data = PIPELINE_DATA.map(p => ({ ...p, collected: now }));
  const result = await saveRaw('pipelines', data, {
    collector: 'collect-pipelines.mjs',
    source: 'Crucix pipelines reference',
    source_url: 'local://reference',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Реальные 6 трубопроводов с координатами; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[PIPELINES] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectPipelines().catch((e) => { console.error('[PIPELINES] FATAL:', e); process.exit(1); });
}
