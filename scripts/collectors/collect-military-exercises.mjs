#!/usr/bin/env node
/**
 * Crucix Collector: military-exercises (военные учения) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: OpenSky + NOTAM (демо).
 * Формат: {source, lastUpdated, data:[{date,value,exercises,region,notam,opensky}], meta}. Тип — timeseries.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-military-exercises.log');
const REGIONS = ['Europe', 'Asia', 'Middle East', 'Pacific', 'Atlantic'];
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
      value: Math.round((Math.random() * 40 + 10) * 100) / 100,
      exercises: Math.floor(Math.random() * 15 + 2),
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      notam: Math.floor(Math.random() * 20 + 2),
      opensky: Math.floor(Math.random() * 15 + 1),
    });
  }
  return {
    source: 'OpenSky + NOTAM',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Отслеживание военных учений', unit: 'индекс активности', isDemo: true, components: ['OpenSky', 'NOTAM'] },
  };
}

export async function collectMilitaryExercises() {
  await log('🚀 Запуск сборщика military-exercises');
  const start = Date.now();
  try {
    const basketData = generateDemoData();
    const result = await saveRaw('military-exercises', basketData, {
      collector: 'collect-military-exercises.mjs',
      source: 'OpenSky + NOTAM (demo)',
      source_url: 'local://demo',
      license: 'public-domain',
      format_hint: 'timeseries',
      value_type: 'index',
      value_unit: 'index',
      granularity: 'daily',
      period: 'P30D',
      record_count: basketData.data.length,
      notes: 'Демо-данные; basket не перезаписывается',
      backwardCompat: false,
    });
    await log(`✅ Записей: ${basketData.data.length} → ${result.raw_file}`);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await log(`✅ Завершён за ${elapsed}с`);
    return basketData;
  } catch (e) {
    await log(`❌ Ошибка: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectMilitaryExercises().catch(console.error);
}
