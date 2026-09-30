#!/usr/bin/env node
/**
 * Crucix Collector: open-meteo (погода) — ЕДИНЫЙ после синтеза 2 версий.
 * Версия 2.1.1. Принят 23.09.2026.
 *
 * Изменения v2.1.1:
 *  - Устранены 4 мусорные вставки, попавшие в файл при копировании v2.1.0
 *    через терминал (строки 153, 158, 159, 160 в испорченной версии).
 *  - Логика v2.1.0 сохранена без изменений.
 *
 * Изменения v2.1:
 *  - readJsonWithSignal(): r.json() читается под тем же AbortController, что и fetch.
 *  - clearTimeout(timer) перенесён в finally — после чтения тела.
 *  - Батчевая параллелизация: 15 городов по 5 в Promise.allSettled, 3 батча.
 *  - Диагностика ошибок с e.name + e.code + e.message.
 *
 * СИНТЕЗ по правилу #871 (без изменений от v2.0.0):
 *   - collect-open-meteo.mjs (10 городов с кодами)
 *   - collect-openmeteo.mjs  (дополнительные с русскими именами)
 *
 * Объединение: 15 городов (дедупликация по lat/lng), все поля
 * (temperature, wind, precipitation), русские + английские имена.
 * Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const CITIES = [
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
  { name: 'St. Petersburg', nameRu: 'Санкт-Петербург', lat: 59.93, lng: 30.31, code: 'RUS' },
  { name: 'Paris', nameRu: 'Париж', lat: 48.86, lng: 2.35, code: 'FRA' },
  { name: 'Berlin', nameRu: 'Берлин', lat: 52.52, lng: 13.40, code: 'DEU' },
  { name: 'New York', nameRu: 'Нью-Йорк', lat: 40.71, lng: -74.01, code: 'USA' },
  { name: 'Minsk', nameRu: 'Минск', lat: 53.90, lng: 27.56, code: 'BLR' },
];

const TIMEOUT_MS = 15000;
const BATCH_SIZE = 5;

function readJsonWithSignal(res, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) {
      reject(new Error('aborted before read'));
      return;
    }
    const onAbort = () => reject(new Error('aborted while reading body'));
    if (signal) signal.addEventListener('abort', onAbort, { once: true });
    res.json().then(
      (data) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        resolve(data);
      },
      (err) => {
        if (signal) signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

function describeError(e) {
  const name = e?.name || 'Error';
  const code = e?.cause?.code || e?.code || '';
  const msg = e?.message || '';
  return code ? `${name}/${code}: ${msg}` : `${name}: ${msg}`;
}

async function fetchWeather(city) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lng}&current=temperature_2m,wind_speed_10m,precipitation&timezone=UTC`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await readJsonWithSignal(r, controller.signal);
    return {
      city: city.name, cityRu: city.nameRu, countryCode: city.code, lat: city.lat, lng: city.lng,
      temperature: d.current?.temperature_2m, windSpeed: d.current?.wind_speed_10m, precipitation: d.current?.precipitation,
      timestamp: new Date().toISOString(),
    };
  } catch (e) {
    return { city: city.name, cityRu: city.nameRu, countryCode: city.code, lat: city.lat, lng: city.lng, error: describeError(e) };
  } finally {
    clearTimeout(timer);
  }
}

export async function collectOpenMeteo() {
  console.log(`[OpenMeteo] Загрузка ${CITIES.length} городов (батчи по ${BATCH_SIZE})...`);
  const out = new Array(CITIES.length);
  for (let i = 0; i < CITIES.length; i += BATCH_SIZE) {
    const slice = CITIES.slice(i, i + BATCH_SIZE);
    const settled = await Promise.allSettled(slice.map(c => fetchWeather(c)));
    for (let j = 0; j < settled.length; j++) {
      const s = settled[j];
      const idx = i + j;
      if (s.status === 'fulfilled') {
        out[idx] = s.value;
      } else {
        const c = slice[j];
        out[idx] = {
          city: c.name, cityRu: c.nameRu, countryCode: c.code, lat: c.lat, lng: c.lng,
          error: describeError(s.reason)
        };
      }
    }
    if (i + BATCH_SIZE < CITIES.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }
  const successCount = out.filter(o => !o.error).length;
  const failCount = CITIES.length - successCount;
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
    notes: `ЕДИНЫЙ после синтеза 2 версий (#871). Городов: ${CITIES.length}, успешно: ${successCount}, ошибок: ${failCount}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[OpenMeteo] OK ${successCount}/${CITIES.length} (ошибок: ${failCount}) → ${result.raw_file}`);
  return { source: 'OpenMeteo', updated: new Date().toISOString(), cities: out };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpenMeteo().catch((e) => { console.error('[OpenMeteo] FATAL:', e); process.exit(1); });
}
