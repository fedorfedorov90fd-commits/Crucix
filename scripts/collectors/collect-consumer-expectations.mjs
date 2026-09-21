#!/usr/bin/env node
/**
 * Crucix Collector: consumer-expectations (индекс потребительских ожиданий) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Реальный источник: FRED / Conference Board.
 * Формат: {source, lastUpdated, data:[{date,value,source}], meta}. Тип — timeseries.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-consumer-expectations.log');
const COLLECTOR_NAME = 'consumer-expectations';
const DAYS_BACK = 30;

async function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
    await fs.appendFile(LOG_FILE, line);
  } catch (e) { console.error('Ошибка лога:', e.message); }
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
      value: Math.round((Math.random() * 20 + 80) * 100) / 100,
      source: 'DEMO',
    });
  }
  return {
    source: 'FRED / Conference Board',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Индекс потребительских ожиданий (Consumer Expectations)', unit: 'индекс', frequency: 'ежемесячно', isDemo: true },
  };
}

export async function collectConsumerExpectations() {
  await log(`🚀 Запуск сборщика ${COLLECTOR_NAME}`);
  const startTime = Date.now();
  try {
    await log('📊 Генерация данных...');
    const basketData = generateDemoData();
    const result = await saveRaw('consumer-expectations', basketData, {
      collector: 'collect-consumer-expectations.mjs',
      source: 'FRED / Conference Board (demo)',
      source_url: 'https://fred.stlouisfed.org/series/CONCEXP',
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
    await log(`✅ Накладная: ${result.incoming_file}`);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    await log(`✅ Завершён за ${elapsed}с`);
    return basketData;
  } catch (error) {
    await log(`❌ Ошибка: ${error.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectConsumerExpectations().catch(console.error);
}
