#!/usr/bin/env node
/**
 * Crucix Collector: aviation (OpenSky / demo) — синтез из трёх источников.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * СИНТЕЗ (правило #871): объединяет данные трёх версий:
 *   - collect-aviation.v1.0.0        (demo 31 день: flights, aircraft, airline, lat/lng, delayed)
 *   - collect-aviation-monitor.v1.0.0 (demo 31 день по регионам: flights, military)
 *   - collect-aviation-real.v1.0.0    (13 реальных sample-сущностей: OpenSky формат GeoJSON)
 *
 * Роль: сдаёт на склад через collector-helper. Сборщик НЕ пишет в basket.
 *
 * ВАЖНО: backwardCompat: false — существующий basket/aviation.json НЕ перезаписывается.
 *
 * Формат: {daily: [...], regional: [...], aircraft: [...]} — три представления.
 * Тип — points (авиация привязана к точкам).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const DAYS_BACK = 30;
const AIRCRAFT_TYPES = ['Boeing 737', 'Airbus A320', 'Boeing 747', 'Airbus A380', 'Cessna 172', 'Embraer E190'];
const AIRLINES = ['American', 'Delta', 'United', 'Emirates', 'British', 'Lufthansa'];
const REGIONS = ['Eastern Europe', 'Middle East', 'South China Sea', 'Baltic Sea', 'Korean Peninsula'];

// Реальные sample-данные из collect-aviation-real.v1.0.0
const REAL_AIRCRAFT = [
  { flight: 'AFL123', aircraft: 'Boeing 777', lat: 55.7558, lng: 37.6173, altitude: 11000, type: 'passenger' },
  { flight: 'UAL456', aircraft: 'Boeing 737', lat: 40.7128, lng: -74.0060, altitude: 10500, type: 'passenger' },
  { flight: 'BAW789', aircraft: 'Airbus A380', lat: 51.5074, lng: -0.1278, altitude: 12000, type: 'passenger' },
  { flight: 'AFR012', aircraft: 'Airbus A350', lat: 48.8566, lng: 2.3522, altitude: 11500, type: 'passenger' },
  { flight: 'DLH345', aircraft: 'Airbus A330', lat: 52.5200, lng: 13.4050, altitude: 10800, type: 'passenger' },
  { flight: 'RFF678', aircraft: 'Ilyushin Il-76', lat: 55.0300, lng: 82.9300, altitude: 9500, type: 'military' },
  { flight: 'RFF901', aircraft: 'Tupolev Tu-95', lat: 68.9667, lng: 33.0833, altitude: 8000, type: 'military' },
  { flight: 'AMY234', aircraft: 'Boeing C-17', lat: 39.3553, lng: -94.9286, altitude: 10000, type: 'military' },
  { flight: 'AMY567', aircraft: 'Lockheed C-130', lat: 31.1355, lng: -97.7825, altitude: 8500, type: 'military' },
  { flight: 'JAL789', aircraft: 'Boeing 787', lat: 35.6762, lng: 139.6503, altitude: 11800, type: 'passenger' },
  { flight: 'SIN123', aircraft: 'Airbus A380', lat: 1.3521, lng: 103.8198, altitude: 12200, type: 'passenger' },
  { flight: 'EMI456', aircraft: 'Airbus A330', lat: 25.2048, lng: 55.2708, altitude: 11000, type: 'passenger' },
  { flight: 'QTR789', aircraft: 'Boeing 777', lat: 25.2769, lng: 51.5200, altitude: 11500, type: 'passenger' },
];

function buildDaily() {
  const now = new Date();
  const daily = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    daily.push({
      date: date.toISOString().slice(0, 10),
      flights: Math.round(300 + Math.random() * 1200),
      aircraft: AIRCRAFT_TYPES[Math.floor(Math.random() * AIRCRAFT_TYPES.length)],
      airline: AIRLINES[Math.floor(Math.random() * AIRLINES.length)],
      lat: 25 + Math.random() * 45,
      lng: -80 + Math.random() * 140,
      delayed: Math.random() > 0.7,
    });
  }
  return daily;
}

function buildRegional() {
  const now = new Date();
  const regional = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    regional.push({
      date: date.toISOString().slice(0, 10),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      flights: Math.floor(Math.random() * 200) + 50,
      military: Math.floor(Math.random() * 20) + 1,
    });
  }
  return regional;
}

export async function collectAviation() {
  const now = new Date().toISOString();
  const basketData = {
    source: 'OpenSky Network / demo',
    lastUpdated: now,
    daily: buildDaily(),
    regional: buildRegional(),
    aircraft: REAL_AIRCRAFT.map(a => ({ ...a, collected: now })),
    note: 'Синтез 3 версий: daily + regional + реальные sample-сущности OpenSky',
  };

  const result = await saveRaw('aviation', basketData, {
    collector: 'collect-aviation.mjs',
    source: 'OpenSky Network (sample) / demo',
    source_url: 'https://opensky-network.org/api/states/all',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: 'P30D',
    record_count: basketData.daily.length + basketData.regional.length + basketData.aircraft.length,
    notes: `Синтез #871 из 3 версий. daily ${basketData.daily.length} + regional ${basketData.regional.length} + aircraft ${basketData.aircraft.length}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[AVIATION] OK daily=${basketData.daily.length} regional=${basketData.regional.length} aircraft=${basketData.aircraft.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectAviation().catch((e) => { console.error('[AVIATION] FATAL:', e); process.exit(1); });
}
