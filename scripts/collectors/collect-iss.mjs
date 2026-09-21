#!/usr/bin/env node
/**
 * Crucix Collector: iss (позиция МКС в реальном времени).
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://api.wheretheiss.at/v1/satellites/25544
 * Формат: {source, updated, iss:{lat,lng,altitude,velocity,visibility,timestamp}}. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const TIMEOUT_MS = 15000;

export async function collectISS() {
  console.log('[ISS] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    basketData = {
      source: 'WhereTheISSAt',
      updated: new Date().toISOString(),
      iss: { lat: d.latitude, lng: d.longitude, altitude: d.altitude, velocity: d.velocity, visibility: d.visibility, timestamp: d.timestamp },
    };
    console.log(`[ISS] lat=${d.latitude}, lng=${d.longitude}, alt=${d.altitude}km`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[ISS] ⚠️ Ошибка:', e.message);
    basketData = { source: 'WhereTheISSAt', updated: new Date().toISOString(), iss: null, error: e.message };
  }

  const result = await saveRaw('iss', basketData, {
    collector: 'collect-iss.mjs',
    source: 'WhereTheISSAt API',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.iss ? 1 : 0,
    notes: ok ? 'Реальные данные WhereTheISSAt' : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[ISS] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectISS().catch((e) => { console.error('[ISS] FATAL:', e); process.exit(1); });
}
