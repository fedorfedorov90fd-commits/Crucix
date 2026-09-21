#!/usr/bin/env node
/**
 * Crucix Collector: risk-heatmap (11 точек риска).
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: [{lat, lng, intensity, region, collected}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const RISK_DATA = [
  { lat: 48.3794, lng: 31.1656, intensity: 0.9, region: 'Украина' },
  { lat: 32.4279, lng: 53.6880, intensity: 0.85, region: 'Иран' },
  { lat: 31.0461, lng: 34.8516, intensity: 0.8, region: 'Израиль' },
  { lat: 33.9391, lng: 67.7100, intensity: 0.92, region: 'Афганистан' },
  { lat: 34.8021, lng: 38.9968, intensity: 0.88, region: 'Сирия' },
  { lat: 15.5527, lng: 48.5164, intensity: 0.86, region: 'Йемен' },
  { lat: 5.1521, lng: 46.1996, intensity: 0.9, region: 'Сомали' },
  { lat: 12.8628, lng: 30.2176, intensity: 0.84, region: 'Судан' },
  { lat: 9.1450, lng: 40.4897, intensity: 0.8, region: 'Эфиопия' },
  { lat: 61.5240, lng: 105.3188, intensity: 0.72, region: 'Россия' },
  { lat: 30.3753, lng: 69.3451, intensity: 0.68, region: 'Пакистан' },
];

export async function collectRiskHeatmap() {
  const now = new Date().toISOString();
  const data = RISK_DATA.map(r => ({ ...r, collected: now }));
  const result = await saveRaw('risk-heatmap', data, {
    collector: 'collect-risk-heatmap.mjs',
    source: 'Crucix risk heatmap',
    source_url: 'local://reference',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'intensity_0_1',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: '11 точек риска; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[RISK-HEATMAP] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRiskHeatmap().catch((e) => { console.error('[RISK-HEATMAP] FATAL:', e); process.exit(1); });
}
