#!/usr/bin/env node
/**
 * Crucix Collector: ships (суда, AIS) — ЕДИНЫЙ после синтеза 2 версий.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * СИНТЕЗ по правилу #871:
 *   - collect-ships.v1.0.0       (demo 31 день, 8 портов: ships, port, lat/lng, active)
 *   - collect-ships-real.v1.0.0  (10 хардкод-судов: CMA CGM, MSC, Maersk, COSCO, Ever Given, ...)
 *
 * Объединение: 10 реальных судов + 31 день временной истории по портам.
 * Формат: {source, lastUpdated, vessels:[10 хардкод], daily:[31 demo]}. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const PORTS = ['Singapore', 'Rotterdam', 'Shanghai', 'Los Angeles', 'Dubai', 'Hamburg', 'Antwerp', 'Hong Kong'];
const DAYS_BACK = 30;

const VESSELS = [
  { name: 'CMA CGM Alexander', imo: '1234567', lat: 30.0, lng: -80.0, type: 'container' },
  { name: 'MSC Anna', imo: '2345678', lat: 35.0, lng: -75.0, type: 'container' },
  { name: 'Maersk Sofia', imo: '3456789', lat: 40.0, lng: -70.0, type: 'container' },
  { name: 'COSCO Hope', imo: '4567890', lat: 45.0, lng: -65.0, type: 'container' },
  { name: 'Ever Given', imo: '5678901', lat: 25.0, lng: -60.0, type: 'container' },
  { name: 'HMM Rotterdam', imo: '6789012', lat: 20.0, lng: -55.0, type: 'container' },
  { name: 'ONE Trust', imo: '7890123', lat: 15.0, lng: -50.0, type: 'container' },
  { name: 'Yang Ming Wisdom', imo: '8901234', lat: 10.0, lng: -45.0, type: 'container' },
  { name: 'ZIM Constanta', imo: '9012345', lat: 5.0, lng: -40.0, type: 'container' },
  { name: 'MOL Triumph', imo: '0123456', lat: 0.0, lng: -35.0, type: 'container' },
];

function buildDaily() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      ships: Math.round(80 + Math.random() * 220),
      port: PORTS[Math.floor(Math.random() * PORTS.length)],
      lat: 15 + Math.random() * 45,
      lng: -70 + Math.random() * 150,
      active: Math.random() > 0.3,
    });
  }
  return data;
}

export async function collectShips() {
  const now = new Date().toISOString();
  const daily = buildDaily();
  const vessels = VESSELS.map(v => ({ ...v, collected: now }));

  const data = {
    source: 'Ships (AIS / sample)',
    lastUpdated: now,
    vessels,
    daily,
    total: vessels.length + daily.length,
  };

  const result = await saveRaw('ships', data, {
    collector: 'collect-ships.mjs',
    source: 'Ships AIS (sample + demo)',
    source_url: 'https://www.marinetraffic.com/',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'ships',
    granularity: 'daily',
    period: 'P30D',
    record_count: data.total,
    notes: `Синтез #871 из 2 версий: 10 vessels + 31 daily = ${data.total}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[SHIPS] OK vessels=${vessels.length} daily=${daily.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectShips().catch((e) => { console.error('[SHIPS] FATAL:', e); process.exit(1); });
}
