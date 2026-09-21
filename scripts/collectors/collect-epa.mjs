#!/usr/bin/env node
/**
 * Crucix Collector: EPA (Air Quality — PM2.5, PM10, озон, NO2).
 * Версия 2.0.1. Принят 19.09.2026.
 *
 * Источник: Open-Meteo Air Quality API (без ключа, без регистрации).
 *   Основные air quality API (AirNow, OpenAQ v3, WAQI, EPA AQS) требуют ключ
 *   (правило #39 — сейчас без ключей). Open-Meteo — открытый альтернативный
 *   источник, даёт реальные данные по городам мира.
 *
 * Точки сбора: 250 столиц из data/reference/capitals-coords.json.
 *   Каждая столица = точка с PM2.5 (основной показатель).
 *   Дополнительно — временные ряды (hourly) для моделей.
 *
 * Глубина: EPA_DAYS env или --days=N CLI. Default 1, max 92.
 *   Пример: EPA_DAYS=7 node scripts/collectors/collect-epa.mjs
 *
 * Формат: points + timeseries.
 *   points — массив {lat, lon, value: pm2_5, region: iso3, label: capitalName, timestamp}.
 *   timeseries — массив {date, value, region: iso3, extra: {pm10, ozone, no2, ...}}.
 *
 * Demo-fallback: 30 записей Math.random при полном сбое всех точек.
 *
 * Изменение 2.0.1: payload передаётся КАК ОБЪЕКТ {points, series}, а не плоский массив.
 *   Это позволяет адаптеру points.mjs v2.1.0 сохранять оба представления через
 *   passThroughV1Object. Ранее (v2.0.0) .concat() терял 12000 series — они шли
 *   в skippedInvalidCoords, потому что не имели lat/lon.
 *
 * Роль: привозит сырьё в data/raw/ через saveRaw(), кладовщик нормализует в v1.
 * backwardCompat: true — пишет и в basket, пока не все API-модули переведены.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const CAPITALS_FILE = join(ROOT, 'data', 'reference', 'capitals-coords.json');

const OPEN_METEO_URL = 'https://air-quality-api.open-meteo.com/v1/air-quality';
const FETCH_TIMEOUT_MS = 20000;
const FETCH_RETRIES = 3;
const BATCH_SIZE = 10;      // параллельно по 10 запросов
const BATCH_PAUSE_MS = 300; // пауза между батчами

const HOURLY_VARS = ['pm2_5', 'pm10', 'ozone', 'nitrogen_dioxide', 'sulphur_dioxide', 'carbon_monoxide'];

function parseDays() {
  const envVal = process.env.EPA_DAYS;
  if (envVal && !isNaN(parseInt(envVal, 10))) {
    return Math.min(92, Math.max(1, parseInt(envVal, 10)));
  }
  const arg = process.argv.find(a => a.startsWith('--days='));
  if (arg) {
    const v = parseInt(arg.split('=')[1], 10);
    if (!isNaN(v)) return Math.min(92, Math.max(1, v));
  }
  return 1;
}

async function fetchWithRetry(url, retries = FETCH_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchOptions = {
        method: 'GET',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Crucix-OSINT/1.0)' }
      };
      const r = await fetch(url, fetchOptions);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (attempt === retries) throw e;
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }
  }
}

async function fetchCapitalAirQuality(capital, days) {
  const { lat, lon, iso3, name_en, name_ru, timezone } = capital;
  if (lat == null || lon == null) return null;
  const hourlyParams = HOURLY_VARS.join(',');
  const pastDays = Math.min(days, 92);
  const url = `${OPEN_METEO_URL}?latitude=${lat}&longitude=${lon}&hourly=${hourlyParams}&timezone=UTC&past_days=${pastDays}&forecast_days=1`;
  try {
    const r = await fetchWithRetry(url);
    const j = await r.json();
    if (!j.hourly || !j.hourly.time) return null;
    return {
      iso3,
      name_en: name_en || null,
      name_ru: name_ru || null,
      lat, lon,
      timezone: timezone || null,
      hourly: j.hourly,
      hours_count: j.hourly.time.length
    };
  } catch (e) {
    return { iso3, error: e.message };
  }
}

function buildPoints(fetched) {
  const points = [];
  const now = new Date().toISOString();
  for (const c of fetched) {
    if (!c || !c.hourly || !c.hourly.time) continue;
    // Берём последнее значение pm2_5 (последний час)
    const lastIdx = c.hourly.time.length - 1;
    const pm25 = c.hourly.pm2_5 ? c.hourly.pm2_5[lastIdx] : null;
    if (pm25 == null) continue;
    points.push({
      lat: c.lat,
      lon: c.lon,
      value: pm25,
      region: c.iso3,
      label: c.name_en || c.name_ru || c.iso3,
      timestamp: now,
      extra: {
        pm10: c.hourly.pm10 ? c.hourly.pm10[lastIdx] : null,
        ozone: c.hourly.ozone ? c.hourly.ozone[lastIdx] : null,
        no2: c.hourly.nitrogen_dioxide ? c.hourly.nitrogen_dioxide[lastIdx] : null,
        so2: c.hourly.sulphur_dioxide ? c.hourly.sulphur_dioxide[lastIdx] : null,
        co: c.hourly.carbon_monoxide ? c.hourly.carbon_monoxide[lastIdx] : null,
        timezone: c.timezone
      }
    });
  }
  return points;
}

function buildTimeseries(fetched) {
  const series = [];
  for (const c of fetched) {
    if (!c || !c.hourly || !c.hourly.time) continue;
    for (let i = 0; i < c.hourly.time.length; i++) {
      const pm25 = c.hourly.pm2_5 ? c.hourly.pm2_5[i] : null;
      if (pm25 == null) continue;
      const extra = {};
      if (c.hourly.pm10 && c.hourly.pm10[i] != null) extra.pm10 = c.hourly.pm10[i];
      if (c.hourly.ozone && c.hourly.ozone[i] != null) extra.ozone = c.hourly.ozone[i];
      if (c.hourly.nitrogen_dioxide && c.hourly.nitrogen_dioxide[i] != null) extra.no2 = c.hourly.nitrogen_dioxide[i];
      if (c.hourly.sulphur_dioxide && c.hourly.sulphur_dioxide[i] != null) extra.so2 = c.hourly.sulphur_dioxide[i];
      if (c.hourly.carbon_monoxide && c.hourly.carbon_monoxide[i] != null) extra.co = c.hourly.carbon_monoxide[i];
      series.push({
        date: c.hourly.time[i],
        value: pm25,
        region: c.iso3,
        extra: Object.keys(extra).length > 0 ? extra : undefined
      });
    }
  }
  return series;
}

function demoData() {
  const now = new Date();
  const data = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      value: Math.round((Math.random() * 50 + 10) * 100) / 100,
      region: 'GLOBAL',
      label: 'Demo Air Quality',
      extra: { airQuality: Math.floor(Math.random() * 100) + 20, waterQuality: Math.floor(Math.random() * 100) + 20 }
    });
  }
  return data;
}

export async function collectEPA() {
  const days = parseDays();
  const capitalsData = JSON.parse(await readFile(CAPITALS_FILE, 'utf-8'));
  const capitals = Object.values(capitalsData.capitals || {});
  console.log(`[EPA] ${capitals.length} столиц, глубина ${days}д`);

  const results = [];
  const errors = [];
  for (let i = 0; i < capitals.length; i += BATCH_SIZE) {
    const batch = capitals.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(c => fetchCapitalAirQuality(c, days)));
    for (const r of batchResults) {
      if (!r) continue;
      if (r.error) errors.push(`${r.iso3}: ${r.error}`);
      else results.push(r);
    }
    if (i + BATCH_SIZE < capitals.length) {
      await new Promise(resolve => setTimeout(resolve, BATCH_PAUSE_MS));
    }
    if ((i / BATCH_SIZE + 1) % 5 === 0) {
      console.log(`[EPA] батч ${i / BATCH_SIZE + 1}/${Math.ceil(capitals.length / BATCH_SIZE)}, успешно ${results.length}`);
    }
  }

  let data;
  let sourceName;
  if (results.length === 0) {
    data = demoData();
    sourceName = 'demo-fallback';
    console.warn(`[EPA] Все точки упали: ${errors.slice(0, 3).join(' | ')}. Demo-данные.`);
  } else {
    const points = buildPoints(results);
    const timeseries = buildTimeseries(results);
    data = { points, series: timeseries };
    sourceName = `open-meteo (${results.length}/${capitals.length})`;
    if (errors.length > 0) {
      console.warn(`[EPA] Частичный сбой (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
    }
    console.log(`[EPA] points: ${points.length}, series: ${timeseries.length}`);
  }

  // v2.0.1: для open-meteo передаём ОБЪЕКТ {points, series} — адаптер points.mjs v2.1.0
  // сохранит оба представления через passThroughV1Object. Для demo-fallback — массив.
  const payload = Array.isArray(data) ? data : { points: data.points, series: data.series };
  const recordCount = Array.isArray(payload)
    ? payload.length
    : ((payload.points?.length || 0) + (payload.series?.length || 0));

  const result = await saveRaw('epa', payload, {
    collector: 'collect-epa.mjs',
    source: 'Open-Meteo Air Quality (EPA replacement)',
    source_url: OPEN_METEO_URL,
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'µg/m³',
    value_scale: 'air_quality_pm25',
    granularity: 'hourly',
    record_count: recordCount,
    notes: `source=${sourceName}, глубина=${days}д, столиц=${results.length}`,
    backwardCompat: true
  });

  console.log(`[EPA] OK ${recordCount} записей (${sourceName}) → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectEPA().catch((e) => { console.error('[EPA] FATAL:', e.message); process.exit(1); });
}
