#!/usr/bin/env node
/**
 * Crucix Collector: cyber-threat-index (композитный индекс) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: demo-сырьё → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: CISA + Darkweb (для реальных данных нужна интеграция).
 * Формат: {source, lastUpdated, data:[{date,value,cisa,darkweb}], meta}. Тип — timeseries.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, '..', '..', 'logs', 'collectors');
const LOG_FILE = path.join(LOGS_DIR, 'collect-cyber-threat-index.log');
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
      value: Math.round((Math.random() * 30 + 20) * 100) / 100,
      cisa: Math.round((Math.random() * 20 + 10) * 100) / 100,
      darkweb: Math.round((Math.random() * 20 + 10) * 100) / 100,
    });
  }
  return {
    source: 'CISA + Darkweb',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Композитный индекс киберугроз', unit: 'индекс', isDemo: true, components: ['CISA', 'Darkweb'] },
  };
}

export async function collectCyberThreatIndex() {
  await log('🚀 Запуск сборщика cyber-threat-index');
  const start = Date.now();
  try {
    const basketData = generateDemoData();
    const result = await saveRaw('cyber-threat-index', basketData, {
      collector: 'collect-cyber-threat-index.mjs',
      source: 'CISA + Darkweb (demo)',
      source_url: 'https://www.cisa.gov/',
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
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    await log(`✅ Завершён за ${elapsed}с`);
    return basketData;
  } catch (e) {
    await log(`❌ Ошибка: ${e.message}`);
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCyberThreatIndex().catch(console.error);
}
