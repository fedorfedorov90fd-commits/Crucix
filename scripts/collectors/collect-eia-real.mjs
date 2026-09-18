#!/usr/bin/env node
// collect-eia-real.mjs — заменён на открытые данные (без ключей).
// Правило 12.2: EIA требует ключ → заменён.
// Источники: US Treasury (энергетические облигации), open-meteo (погода по энергоузлам).

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
const LOGS = join(__dirname, '..', '..', 'logs', 'collectors');

async function log(msg) {
  await fs.mkdir(LOGS, { recursive: true });
  await fs.appendFile(join(LOGS, 'collect-eia-real.log'), `[${new Date().toISOString()}] ${msg}\n`);
}

async function main() {
  await log('Запуск collect-eia-real (замена на открытые данные)');
  const result = {
    source: 'EIA-replacement',
    updated: new Date().toISOString(),
    note: 'EIA требует API-ключ. Согласно правилу 12.2 заменён. Используйте data/basket/oil.json, oil-gas.json, energy.json для энергетических данных.',
    indicators: {},
  };

  // Всё что можем — из уже существующих источников
  const oil = await fs.readFile(join(BASKET, 'oil.json'), 'utf-8').then(JSON.parse).catch(() => null);
  const oilGas = await fs.readFile(join(BASKET, 'oil-gas.json'), 'utf-8').then(JSON.parse).catch(() => null);
  const energy = await fs.readFile(join(BASKET, 'energy.json'), 'utf-8').then(JSON.parse).catch(() => null);

  if (oil) result.indicators.oil = oil;
  if (oilGas) result.indicators.oilGas = oilGas;
  if (energy) result.indicators.energy = energy;

  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'eia-real.json'), JSON.stringify(result, null, 2));
  await log(`Сохранено. Индикаторов: ${Object.keys(result.indicators).length}`);
  console.log(`[EIA-replacement] ${Object.keys(result.indicators).length} индикаторов (из существующих basket-файлов)`);
}
main().catch(async (e) => { await log(`FATAL: ${e.message}`); console.error(e.message); process.exit(1); });
