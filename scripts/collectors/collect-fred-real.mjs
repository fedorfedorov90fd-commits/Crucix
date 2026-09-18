#!/usr/bin/env node
// collect-fred-real.mjs — заменён на открытые источники (без ключей).
// Правило 12.2: API-ключи запрещены. FRED требует ключ — заменён на:
//   - ECB Data Portal (макро ЕС, без ключа)
//   - US Treasury Fiscal Data (без ключа)
//   - World Bank (уже собираем в worldbank-latest.json)
// Файл сохранён для совместимости. Пишет в fred.json.

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET = join(__dirname, '..', '..', 'data', 'basket');
const LOGS = join(__dirname, '..', '..', 'logs', 'collectors');

async function log(msg) {
  await fs.mkdir(LOGS, { recursive: true });
  await fs.appendFile(join(LOGS, 'collect-fred-real.log'), `[${new Date().toISOString()}] ${msg}\n`);
}

async function main() {
  await log('Запуск collect-fred-real (замена на ECB + Treasury)');
  const result = {
    source: 'FRED-replacement (ECB + Treasury)',
    updated: new Date().toISOString(),
    note: 'FRED требует API-ключ. Согласно правилу 12.2 заменён на открытые источники.',
    indicators: {},
  };

  // 1. ECB — курс USD/EUR
  try {
    const r = await fetch('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=jsondata');
    const d = await r.json();
    const series = d.dataSets?.[0]?.series || {};
    const firstKey = Object.keys(series)[0];
    const obs = series[firstKey]?.observations || {};
    const lastKey = Object.keys(obs).pop();
    result.indicators.usd_eur = { value: obs[lastKey]?.[0], period: lastKey, source: 'ECB' };
  } catch (e) { await log(`ECB ошибка: ${e.message}`); }

  // 2. US Treasury — долг
  try {
    const r = await fetch('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1');
    const d = await r.json();
    const rec = d.data?.[0];
    if (rec) result.indicators.us_national_debt = { value: parseFloat(rec.tot_pub_debt_out_amt), date: rec.record_date, source: 'US Treasury' };
  } catch (e) { await log(`Treasury ошибка: ${e.message}`); }

  // 3. World Bank — GDP global proxy (США)
  try {
    const r = await fetch('https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?format=json&mrv=1');
    const d = await r.json();
    if (d[1] && d[1][0]) {
      result.indicators.us_gdp = { value: d[1][0].value, year: d[1][0].date, source: 'World Bank' };
    }
  } catch (e) { await log(`World Bank ошибка: ${e.message}`); }

  await fs.mkdir(BASKET, { recursive: true });
  await fs.writeFile(join(BASKET, 'fred.json'), JSON.stringify(result, null, 2));
  await log(`Сохранено. Индикаторов: ${Object.keys(result.indicators).length}`);
  console.log(`[FRED-replacement] ${Object.keys(result.indicators).length} индикаторов из ECB+Treasury+World Bank`);
}
main().catch(async (e) => { await log(`FATAL: ${e.message}`); console.error(e.message); process.exit(1); });
