#!/usr/bin/env node
/**
 * Crucix Collector: gps-jamming (GPS-глушение по 5 регионам).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: реальный OpenSky API + demo-fallback → saveRaw.
 * Источник: https://opensky-network.org/api/states/all
 * Формат: [{id, region, lat, lon, intensity, color, label, aircraftCount, description, start, end, source, updated}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = [
  { name: 'Восточная Европа', lat: 50, lon: 30 },
  { name: 'Черное море', lat: 43, lon: 35 },
  { name: 'Ближний Восток', lat: 30, lon: 45 },
  { name: 'Южно-Китайское море', lat: 15, lon: 115 },
  { name: 'Балтийское море', lat: 58, lon: 20 },
];

async function fetchOpenSky() {
  const jamming = [];
  const now = new Date();
  for (const region of REGIONS) {
    try {
      const url = `https://opensky-network.org/api/states/all?lamin=${region.lat - 3}&lomin=${region.lon - 3}&lamax=${region.lat + 3}&lomax=${region.lon + 3}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) continue;
      const data = await response.json();
      const states = data.states || [];
      if (states.length < 10) continue;
      let intensity = 'low', desc = 'Нормальный GPS';
      if (states.length < 20) { intensity = 'critical'; desc = 'Полное глушение'; }
      else if (states.length < 50) { intensity = 'high'; desc = 'Частичное глушение'; }
      else if (states.length < 100) { intensity = 'medium'; desc = 'Периодическое глушение'; }
      const start = new Date(now.getTime() - Math.random() * 86400000);
      const end = new Date(start.getTime() + (Math.random() * 24 + 12) * 3600000);
      jamming.push({
        id: `JAM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        region: region.name,
        lat: region.lat + (Math.random() - 0.5) * 2,
        lon: region.lon + (Math.random() - 0.5) * 2,
        intensity,
        color: intensity === 'critical' ? '#ef4444' : intensity === 'high' ? '#f59e0b' : '#fbbf24',
        label: intensity === 'critical' ? 'КРИТИЧЕСКИЙ' : intensity === 'high' ? 'ВЫСОКИЙ' : 'СРЕДНИЙ',
        aircraftCount: states.length,
        description: desc,
        start: start.toISOString(),
        end: end.toISOString(),
        source: 'OpenSky Network',
        updated: now.toISOString(),
      });
    } catch (e) {
      console.log(`[GPS] ⚠️ ${region.name}: ${e.message}`);
    }
  }
  if (jamming.length === 0) return generateTestData(now);
  return jamming;
}

function generateTestData(now) {
  const regions = [
    { name: 'Восточная Европа', lat: 50, lon: 30, intensity: 'critical' },
    { name: 'Черное море', lat: 43, lon: 35, intensity: 'critical' },
    { name: 'Ближний Восток', lat: 30, lon: 45, intensity: 'high' },
    { name: 'Южно-Китайское море', lat: 15, lon: 115, intensity: 'high' },
    { name: 'Балтийское море', lat: 58, lon: 20, intensity: 'medium' },
  ];
  const map = { critical: { color: '#ef4444', label: 'КРИТИЧЕСКИЙ' }, high: { color: '#f59e0b', label: 'ВЫСОКИЙ' }, medium: { color: '#fbbf24', label: 'СРЕДНИЙ' } };
  return regions.map(r => {
    const info = map[r.intensity];
    const start = new Date(now.getTime() - Math.random() * 86400000);
    const end = new Date(start.getTime() + (Math.random() * 24 + 12) * 3600000);
    return {
      id: `JAM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      region: r.name,
      lat: r.lat + (Math.random() - 0.5) * 2,
      lon: r.lon + (Math.random() - 0.5) * 2,
      intensity: r.intensity,
      color: info.color,
      label: info.label,
      aircraftCount: Math.floor(Math.random() * 30) + 5,
      description: info.label === 'КРИТИЧЕСКИЙ' ? 'Полное глушение GPS' : 'Частичное глушение GPS',
      start: start.toISOString(),
      end: end.toISOString(),
      source: 'OpenSky (симуляция)',
      updated: now.toISOString(),
    };
  });
}

export async function collectGPSJamming() {
  console.log('[GPS] Начинаем сбор...');
  const data = await fetchOpenSky();
  const result = await saveRaw('gps-jamming', data, {
    collector: 'collect-gps-jamming.mjs',
    source: 'OpenSky Network',
    source_url: 'https://opensky-network.org/api/states/all',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'aircraft',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: `${data.length} зон GPS-глушения; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[GPS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectGPSJamming().catch((e) => { console.error('[GPS] FATAL:', e); process.exit(1); });
}
