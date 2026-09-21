#!/usr/bin/env node
/**
 * Crucix Collector: business-optimism (Conference Board / FRED) — demo-режим.
 * Версия 2.0.0. Принят 20.09.2026.
 *
 * Роль: генерирует сырьё (демо-режим) и сдаёт его на склад через
 * collector-helper. Сборщик НЕ пишет в basket — только в raw + накладную.
 * Кладовщик managerbasket.mjs нормализует и укладывает в basket.
 *
 * Реальный источник (для будущего перехода): FRED сериал
 * https://fred.stlouisfed.org/series/BSCICP03USM665S (OECD / Conference Board).
 *
 * ВАЖНО: backwardCompat: false — существующий basket/business-optimism.json
 * НЕ перезаписывается. Сырьё идёт только в data/raw/ + накладную.
 *
 * Формат: {source, lastUpdated, data: [{date, value}], meta:{...}}.
 * Тип — timeseries (значения по времени).
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { saveRaw } from './lib/collector-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE = path.join(__dirname, '..', '..', 'logs', 'collectors', 'collect-business-optimism.log');
const DAYS_BACK = 30;

async function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
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
      value: Math.round((Math.random() * 30 + 50) * 100) / 100,
    });
  }
  return {
    source: 'FRED / Conference Board',
    lastUpdated: now.toISOString(),
    data,
    meta: { description: 'Индекс делового оптимизма', unit: 'индекс', isDemo: true },
  };
}

export async function collectBusinessOptimism() {
  await log('🚀 Запуск сборщика business-optimism');
  const start = Date.now();

  const basketData = generateDemoData();
  const result = await saveRaw('business-optimism', basketData, {
    collector: 'collect-business-optimism.mjs',
    source: 'FRED / Conference Board (demo)',
    source_url: 'https://fred.stlouisfed.org/series/BSCICP03USM665S',
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'index',
    value_unit: 'index',
    value_scale: null,
    granularity: 'daily',
    period: 'P30D',
    record_count: basketData.data.length,
    notes: 'Демо-данные, FRED/Conference Board API не подключён; basket/business-optimism.json не перезаписывается',
    backwardCompat: false,
  });

  await log(`✅ Сохранено ${basketData.data.length} записей → ${result.raw_file}`);
  await log(`✅ Накладная: ${result.incoming_file}`);
  await log(`✅ basket/business-optimism.json НЕ перезаписан (backwardCompat: false)`);
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  await log(`✅ Завершён за ${elapsed}с`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectBusinessOptimism().catch((e) => { console.error('[business-optimism] FATAL:', e); process.exit(1); });
}
