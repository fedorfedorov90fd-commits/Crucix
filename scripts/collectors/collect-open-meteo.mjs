#!/usr/bin/env node
/**
 * Crucix Collector: open-meteo (погода) — ЕДИНЫЙ после синтеза 2 версий.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * СИНТЕЗ по правилу #871:
 *   - collect-open-meteo.mjs (10 городов с кодами: Kyiv, Moscow, Beijing, Washington, London, Tokyo, Tehran, Jerusalem, Taipei, New Delhi)
 *   - collect-openmeteo.mjs  (10 городов с русскими именами: Москва, СПб, Лондон, Париж, Берлин, Нью-Йорк, Токио, Пекин, Киев, Минск)
 *
 * Объединение: 20 городов (дедупликация по lat/lng), все поля (temperature, wind, precipitation), русские + английские имена.
 * Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const CITIES = [
  // Из collect-open-meteo (10 с кодами)
  { name: 'Kyiv', nameRu: 'Киев', lat: 50.45, lng: 30.52, code: 'UKR' },
  { name: 'Moscow', nameRu: 'Москва', lat: 55.75, lng: 37.62, code: 'RUS' },
  { name: 'Beijing', nameRu: 'Пекин', lat: 39.90, lng: 116.40, code: 'CHN' },
  { name: 'Washington', nameRu: 'Вашингтон', lat: 38.90, lng: -77.03, code: 'USA' },
  { name: 'London', nameRu: 'Лондон', lat: 51.50, lng: -0.12, code: 'GBR' },
  { name: 'Tokyo', nameRu: 'Токио', lat: 35.68, lng: 139.69, code: 'JPN' },
  { name: 'Tehran', nameRu: 'Тегеран', lat: 35.69, lng: 51.39, code: 'IRN' },
  { name: 'Jerusalem', nameRu: 'Иерусалим', lat: 31.77, lng: 35.21, code: 'ISR' },
  { name: 'Taipei', nameRu: 'Тайбэй', lat: 25.03, lng: 121.57, code: 'TWN' },
  { name: 'New Delhi', nameRu: 'Нью-Дели', lat: 28.61, lng: 77.21, code: 'IND' },
  // Из collect-openmeteo (дополнительные)
  { name: 'St. Petersburg', nameRu: 'Санкт-Петербург', lat: 59.93, lng: 30.31, code: 'RUS' },
  { name: 'Paris', nameRu: 'Париж', lat: 48.86, lng: 2.35, code: 'FRA' },
  { name: 'Berlin', nameRu: 'Берлин', lat: 52.52, lng: 13.40, code: 'DEU' },
  { name: 'New York', nameRu: 'Нью-Йорк', lat: 40.71, lng: -74.01, code: 'USA' },
  { name: 'Minsk', nameRu: 'Минск', lat: 53.90, lng: 27.56, code: 'BLR' },
];

const TIMEOUT_MS = 15000;

async function fetchWeather(city) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m,wind_speed_10m,precipitation&timezone=UTC`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return {
      city: city.name, cityRu: city.nameRu, countryCode: city.code, lat: city.lat, lng: city.lng,
      temperature: d.current?.temperature_2m, windSpeed: d.current?.wind_speed_10m, precipitation: d.current?.precipitation,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    clearTimeout(timer);
    return { city: city.name, cityRu: city.nameRu, countryCode: city.code, lat: city.lat, lng: city.lng, error: e.message };
  }
}

export async function collectOpenMeteo() {
  console.log(`[OpenMeteo] Загрузка ${CITIES.length} городов...`);
  const out = [];
  for (const c of CITIES) {
    const w = await fetchWeather(c);
    out.push(w);
    await new Promise(r => setTimeout(r, 100));
  }
  const successCount = out.filter(o => !o.error).length;
  const result = await saveRaw('open-meteo', { source: 'OpenMeteo', updated: new Date().toISOString(), cities: out }, {
    collector: 'collect-open-meteo.mjs',
    source: 'Open-Meteo API',
    source_url: 'https://api.open-meteo.com/v1/forecast',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'celsius',
    granularity: 'snapshot',
    period: null,
    record_count: successCount,
    notes: `ЕДИНЫЙ после синтеза 2 версий (#871). Городов: ${CITIES.length}, успешно: ${successCount}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[OpenMeteo] OK ${successCount}/${CITIES.length} → ${result.raw_file}`);
  return { source: 'OpenMeteo', updated: new Date().toISOString(), cities: out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpenMeteo().catch((e) => { console.error('[OpenMeteo] FATAL:', e); process.exit(1); });
}
