#!/usr/bin/env node
/**
 * Crucix Collector: dark-fleet (тёмный флот) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: Dark Ships + OFAC (реальные данные — интеграция с OFAC SDN).
 * Формат: {source, lastUpdated, data:[{date,count,destination,flag,source}], meta}. Тип — events.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-dark-fleet.log');
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
  const destinations = ['Novorossiysk', 'Kaliningrad', 'Murmansk', 'Vladivostok', 'St. Petersburg'];
  const flags = ['Unknown', 'Camouflage', 'Fake Panama', 'Fake Liberia', 'No Flag'];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString(),
      count: Math.floor(Math.random() * 15 + 2),
      destination: destinations[Math.floor(Math.random() * destinations.length)],
      flag: flags[Math.floor(Math.random() * flags.length)],
      source: 'DEMO',
    });
  }
  return {
    source: 'Dark Ships + OFAC',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Тёмный флот — суда без AIS, идущие в Россию', unit: 'количество судов', isDemo: true, destinations },
  };
}

export async function collectDarkFleet() {
  await log('🚀 Запуск сборщика dark-fleet');
  const start = Date.now();
  try {
    const basketData = generateDemoData();
    const result = await saveRaw('dark-fleet', basketData, {
      collector: 'collect-dark-fleet.mjs',
      source: 'Dark Ships + OFAC (demo)',
      source_url: 'https://ofac.treasury.gov/sanctions-list-service',
      license: 'public-domain',
      format_hint: 'events',
      value_type: 'count',
      value_unit: 'ships',
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
  collectDarkFleet().catch(console.error);
}
