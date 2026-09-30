#!/usr/bin/env node
/**
 * Crucix Collector: space-track (космический мусор) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: space-track.org требует регистрации → fallback demo.
 * Формат: {source, lastUpdated, totalObjects, objects:[...], note}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.space-track.org/basicspacetrack/query/class/decay/format/json/limit/100';
const TIMEOUT_MS = 8000;

const FALLBACK = {
  source: 'SpaceTrack',
  lastUpdated: new Date().toISOString(),
  totalObjects: 5,
  objects: [
    { name: 'Object A', id: '2024-001A', country: 'USA' },
    { name: 'Object B', id: '2024-002B', country: 'RUS' },
    { name: 'Object C', id: '2024-003C', country: 'CHN' },
    { name: 'Object D', id: '2024-004D', country: 'EU' },
    { name: 'Object E', id: '2024-005E', country: 'IND' },
  ],
  note: 'Демо-данные (SpaceTrack API требует регистрации, правило 12.2)',
};

export async function collectSpaceTrack() {
  console.log('[SpaceTrack] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    basketData = {
      source: 'SpaceTrack',
      lastUpdated: new Date().toISOString(),
      totalObjects: data.length,
      objects: data.slice(0, 50).map(o => ({ name: o.OBJECT_NAME || 'Unknown', id: o.OBJECT_ID || 'N/A', decayDate: o.DECAY_DATE || 'N/A', country: o.COUNTRY_CODE || 'Unknown' })),
      note: 'Данные о космическом мусоре и сгоревших объектах',
    };
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[SpaceTrack] ⚠️ Ошибка:', e.message);
    basketData = { ...FALLBACK, lastUpdated: new Date().toISOString() };
  }

  const result = await saveRaw('space-track', basketData, {
    collector: 'collect-space-track.mjs',
    source: ok ? 'SpaceTrack API' : 'SpaceTrack (demo)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'objects',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.objects.length,
    notes: ok ? `Реальные данные SpaceTrack (${basketData.totalObjects} объектов)` : 'Fallback demo (требуется регистрация, правило 12.2); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[SpaceTrack] OK ${basketData.objects.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectSpaceTrack().catch(e => { console.error('[SpaceTrack] FATAL:', e.message); process.exit(1); });
}
