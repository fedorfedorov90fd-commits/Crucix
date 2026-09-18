#!/usr/bin/env node

// ============================================================
// collect-openweather.mjs — OpenWeatherMap (бесплатно)
// ============================================================
// Ключ: https://home.openweathermap.org/api_keys
// Лимит: 60 зап/мин
// Сохраняет: data/basket/openweather.json
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

const PROJECT_ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const FILE_PATH = join(BASKET_DIR, 'openweather.json');

const OPENWEATHER_KEY = process.env.OPENWEATHER_KEY;

if (!OPENWEATHER_KEY) {
  console.error('❌ OPENWEATHER_KEY не найден в .env');
  process.exit(1);
}

async function fetchOpenWeather() {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?q=Moscow&appid=${OPENWEATHER_KEY}&units=metric`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();

    await fs.mkdir(BASKET_DIR, { recursive: true });
    await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2));
    console.log('[OpenWeather] ✅ Данные сохранены');
  } catch (error) {
    console.error('[OpenWeather]', error.message);
  }
}

fetchOpenWeather();
