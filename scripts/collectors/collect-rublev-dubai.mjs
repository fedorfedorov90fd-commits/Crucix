#!/usr/bin/env node
/**
 * Crucix Collector: rublev-dubai (RUB/USDT) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: Garantex / CommEX (demo).
 * Формат: {source, lastUpdated, data:[{date,rate,exchange,spread,source}], meta}. Тип — timeseries.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-rublev-dubai.log');
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
      rate: Math.round((Math.random() * 20 + 80) * 100) / 100,
      exchange: 'Garantex',
      spread: Math.round((Math.random() * 2 + 0.5) * 100) / 100,
      source: 'DEMO',
    });
  }
  return {
    source: 'Garantex / CommEX',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Рубль в Дубае — реальный курс обхода санкций', unit: 'RUB/USDT', isDemo: true, exchanges: ['Garantex', 'CommEX'] },
  };
}

export async function collectRublevDubai() {
  await log('🚀 Запуск сборщика rublev-dubai');
  const start = Date.now();
  try {
    const basketData = generateDemoData();
    const result = await saveRaw('rublev-dubai', basketData, {
      collector: 'collect-rublev-dubai.mjs',
      source: 'Garantex / CommEX (demo)',
      source_url: 'https://garantex.org/',
      license: 'public-domain',
      format_hint: 'timeseries',
      value_type: 'price',
      value_unit: 'rub_per_usdt',
      granularity: 'daily',
      period: 'P30D',
      record_count: basketData.data.length,
      notes: 'Демо-данные (RUB/USDT через Garantex); basket не перезаписывается',
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
  collectRublevDubai().catch(console.error);
}
