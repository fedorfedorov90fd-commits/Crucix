#!/usr/bin/env node
/**
 * Crucix Collector: opensky (5 аэропортов) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: OpenSky Network (демо).
 * Формат: {source, timestamp, total, airports:[{airport,code,lat,lng,flights_count,updated}]}. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const AIRPORTS = [
  { name: 'Шереметьево (SVO)', lat: 55.97, lng: 37.41, code: 'UUEE' },
  { name: 'Домодедово (DME)', lat: 55.41, lng: 37.90, code: 'UUDD' },
  { name: 'Внуково (VKO)', lat: 55.60, lng: 37.27, code: 'UUWW' },
  { name: 'Хитроу (LHR)', lat: 51.47, lng: -0.45, code: 'EGLL' },
  { name: 'Франкфурт (FRA)', lat: 50.03, lng: 8.56, code: 'EDDF' },
];

export async function collectOpensky() {
  console.log('[OpenSky] Сбор...');
  const results = AIRPORTS.map(a => ({
    airport: a.name, code: a.code, lat: a.lat, lng: a.lng,
    flights_count: Math.floor(Math.random() * 15) + 1,
    updated: new Date().toISOString(),
  }));
  const data = { source: 'opensky', timestamp: new Date().toISOString(), total: results.length, airports: results };

  const result = await saveRaw('opensky', data, {
    collector: 'collect-opensky.mjs',
    source: 'OpenSky Network (demo)',
    source_url: 'https://opensky-network.org/api/states/all',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: results.length,
    notes: 'Демо-данные по 5 аэропортам; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OpenSky] OK ${results.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpensky().catch((e) => { console.error('[OpenSky] FATAL:', e); process.exit(1); });
}
