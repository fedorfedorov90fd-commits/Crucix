#!/usr/bin/env node
/**
 * Crucix Collector: openweather (OpenWeatherMap, опционально с ключом).
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: OpenWeatherMap требует ключ — опционален. Без ключа — demo-fallback.
 * Источник: https://api.openweathermap.org/data/2.5/weather
 * Формат: {source, updated, mode, data:[...], note}. Тип — points.
 */
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY || null;
const TIMEOUT_MS = 15000;

async function fetchWithKey() {
  const url = `https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid=${OPENWEATHER_KEY}&units=metric`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

function demoData() {
  return [{
    city: 'Москва', country: 'RU', lat: 55.75, lng: 37.62,
    temperature: 15, feels_like: 13, humidity: 70, pressure: 1013,
    wind_speed: 3.5, condition: 'Clouds', description: 'облачно',
    timestamp: new Date().toISOString(),
  }];
}

export async function collectOpenWeather() {
  console.log('[OpenWeather] Запуск...');
  let result;
  let mode = 'demo';

  if (OPENWEATHER_KEY) {
    try {
      const d = await fetchWithKey();
      result = [{
        city: d.name, country: d.sys?.country, lat: d.coord?.lat, lng: d.coord?.lon,
        temperature: d.main?.temp, feels_like: d.main?.feels_like,
        humidity: d.main?.humidity, pressure: d.main?.pressure,
        wind_speed: d.wind?.speed, condition: d.weather?.[0]?.main, description: d.weather?.[0]?.description,
        timestamp: new Date().toISOString(),
      }];
      mode = 'real';
      console.log(`[OpenWeather] Реальные данные: ${d.name}`);
    } catch (e) {
      console.error('[OpenWeather] ⚠️ Ошибка API:', e.message);
      result = demoData();
    }
  } else {
    console.log('[OpenWeather] OPENWEATHER_KEY не найден — demo-режим');
    result = demoData();
  }

  const basketData = { source: 'OpenWeatherMap', updated: new Date().toISOString(), mode, data: result };
  const saveResult = await saveRaw('openweather', basketData, {
    collector: 'collect-openweather.mjs',
    source: mode === 'real' ? 'OpenWeatherMap API' : 'OpenWeatherMap (demo)',
    source_url: 'https://api.openweathermap.org/data/2.5/weather',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'index',
    value_unit: 'celsius',
    granularity: 'snapshot',
    period: null,
    record_count: result.length,
    notes: mode === 'real' ? 'Реальные данные OpenWeatherMap' : 'Demo (ключ не найден, правило 12.2); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[OpenWeather] OK (${mode}) ${result.length} → ${saveResult.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectOpenWeather().catch((e) => { console.error('[OpenWeather] FATAL:', e); process.exit(1); });
}
