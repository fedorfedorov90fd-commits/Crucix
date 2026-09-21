#!/usr/bin/env node
/**
 * Crucix Collector: indirect-indicators (косвенные индикаторы — Пицца Пентагона, Такси Лэнгли) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: Google Maps / Yelp / Uber / Lyft (демо).
 * Формат: {source, lastUpdated, data:[{date,pentagonPizza,langleyTaxis,source}], meta}. Тип — timeseries.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-indirect-indicators.log');
const DAYS_BACK = 30;

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await fs.mkdir(LOGS_DIR, { recursive: true });
  await fs.appendFile(LOG_FILE, line);
  console.log(line.trim());
}

function generateDemoData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString(),
      pentagonPizza: Math.round((Math.random() * 15 + 5) * 100) / 100,
      langleyTaxis: Math.round((Math.random() * 12 + 3) * 100) / 100,
      source: 'DEMO',
    });
  }
  return {
    source: 'Google Maps / Yelp / Uber / Lyft',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Косвенные индикаторы: Пицца Пентагона и Такси в Лэнгли', isDemo: true, indicators: ['pentagon-pizza', 'langley-taxis'] },
  };
}

export async function collectIndirectIndicators() {
  await log('🚀 Запуск сборщика indirect-indicators');
  const startTime = Date.now();
  try {
    const basketData = generateDemoData();
    const result = await saveRaw('indirect-indicators', basketData, {
      collector: 'collect-indirect-indicators.mjs',
      source: 'Google Maps / Yelp / Uber / Lyft (demo)',
      source_url: 'local://demo',
      license: 'public-domain',
      format_hint: 'timeseries',
      value_type: 'count',
      value_unit: 'count',
      granularity: 'daily',
      period: 'P30D',
      record_count: basketData.data.length,
      notes: 'Демо-данные (Пицца Пентагона + Такси Лэнгли); basket не перезаписывается',
      backwardCompat: false,
    });
    await log(`✅ Записей: ${basketData.data.length} → ${result.raw_file}`);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    await log(`✅ Завершён за ${elapsed}с`);
    return basketData;
  } catch (e) {
    await log(`❌ Ошибка: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectIndirectIndicators().catch(console.error);
}
