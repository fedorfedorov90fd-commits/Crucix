#!/usr/bin/env node
/**
 * Crucix Collector: FRED (макроэкономические индикаторы).
 * Версия 2.0.1. Принят 19.09.2026.
 *
 * Синтез из collect-fred.mjs (demo) + collect-fred-real.mjs (реальная логика).
 * Правило #871: единый файл, вбирающий лучшее из обоих.
 * Правило #39 (12.2): API-ключи запрещены — FRED не используется напрямую.
 *   Замена на открытые источники без ключей:
 *   - ECB Data Portal (курс USD/EUR, макро ЕС)
 *   - US Treasury Fiscal Data (госдолг США)
 *   - World Bank (ВВП США как макро-прокси)
 *
 * Роль: привозит сырьё в data/raw/ через saveRaw(), кладовщик нормализует в v1.
 * Формат: catalog (массив indicators — список сущностей одного типа).
 *
 * Изменение 2.0.1: indicators — МАССИВ (было: объект). Для единообразия со всеми
 * catalog-источниками (CoinGecko → массив монет, OFAC SDN → массив сущностей).
 * Потребителю удобнее: extra.entries[i].value, а не extra.entries[0].indicators.usd_eur.value.
 * catalog.mjs v1.1.1 знает ключ 'indicators' (добавлен в ARRAY_KEYS).
 *
 * Demo-fallback: только если все три источника упали.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const ECB_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=jsondata';
const TREASURY_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1';
const WORLDBANK_URL = 'https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?format=json&mrv=1';

const FETCH_TIMEOUT_MS = 30000;

async function fetchJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function fetchECB() {
  const d = await fetchJson(ECB_URL);
  const series = d.dataSets?.[0]?.series || {};
  const firstKey = Object.keys(series)[0];
  if (!firstKey) throw new Error('ECB: пустой series');
  const obs = series[firstKey]?.observations || {};
  const lastKey = Object.keys(obs).pop();
  if (!lastKey) throw new Error('ECB: нет наблюдений');
  return {
    id: 'usd_eur',
    value: obs[lastKey]?.[0],
    period: lastKey,
    source: 'ECB',
    indicator: 'USD/EUR курс'
  };
}

async function fetchTreasury() {
  const d = await fetchJson(TREASURY_URL);
  const rec = d.data?.[0];
  if (!rec) throw new Error('Treasury: нет записей');
  return {
    id: 'us_national_debt',
    value: parseFloat(rec.tot_pub_debt_out_amt),
    date: rec.record_date,
    source: 'US Treasury',
    indicator: 'Госдолг США (USD)'
  };
}

async function fetchWorldBank() {
  const d = await fetchJson(WORLDBANK_URL);
  if (!d[1] || !d[1][0]) throw new Error('World Bank: нет данных');
  return {
    id: 'us_gdp',
    value: d[1][0].value,
    year: d[1][0].date,
    source: 'World Bank',
    indicator: 'ВВП США (USD)'
  };
}

function demoData() {
  return {
    source: 'FRED (demo-fallback)',
    updated: new Date().toISOString(),
    note: 'Все три открытых источника (ECB, Treasury, World Bank) недоступны. Demo-данные.',
    indicators: [
      { id: 'demo_1', value: 100, date: new Date().toISOString().slice(0, 10), source: 'demo', indicator: 'Demo 1' },
      { id: 'demo_2', value: 200, date: new Date().toISOString().slice(0, 10), source: 'demo', indicator: 'Demo 2' }
    ]
  };
}

export async function collectFRED() {
  const fetched = [];
  const errors = [];

  try { fetched.push(await fetchECB()); }
  catch (e) { errors.push(`ECB: ${e.message}`); }

  try { fetched.push(await fetchTreasury()); }
  catch (e) { errors.push(`Treasury: ${e.message}`); }

  try { fetched.push(await fetchWorldBank()); }
  catch (e) { errors.push(`World Bank: ${e.message}`); }

  let data;
  let sourceName;

  if (fetched.length === 0) {
    data = demoData();
    sourceName = 'demo-fallback';
    console.warn(`[FRED] Все источники недоступны: ${errors.join(' | ')}. Demo-данные.`);
  } else {
    data = {
      source: 'FRED-replacement (ECB + Treasury + World Bank)',
      updated: new Date().toISOString(),
      note: 'FRED требует API-ключ. Заменён на открытые источники без ключей.',
      indicators: fetched
    };
    sourceName = 'open-data';
    if (errors.length > 0) {
      data.partial_errors = errors;
      console.warn(`[FRED] Частичный сбой: ${errors.join(' | ')}`);
    }
  }

  const result = await saveRaw('fred', data, {
    collector: 'collect-fred.mjs',
    source: 'ECB + US Treasury + World Bank',
    source_url: 'https://data-api.ecb.europa.eu / https://api.fiscaldata.treasury.gov / https://api.worldbank.org',
    license: 'public-domain',
    format_hint: 'catalog',
    value_unit: 'mixed',
    value_scale: 'macro_indicators',
    granularity: 'snapshot',
    record_count: (data.indicators || []).length,
    notes: `source=${sourceName}, индикаторов=${(data.indicators || []).length}`,
    backwardCompat: true
  });

  console.log(`[FRED] OK ${(data.indicators || []).length} индикаторов (${sourceName}) → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFRED().catch((e) => { console.error('[FRED] FATAL:', e.message); process.exit(1); });
}
