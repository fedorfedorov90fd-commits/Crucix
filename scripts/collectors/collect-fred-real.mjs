#!/usr/bin/env node
/**
 * Crucix Collector: fred-real — замена FRED на открытые источники (без ключа).
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: API-ключи запрещены. FRED требует ключ → заменён на:
 *   - ECB Data Portal (курс USD/EUR)
 *   - US Treasury Fiscal Data (госдолг США)
 *   - World Bank (ВВП США)
 * Формат: {source, updated, note, indicators:{usd_eur, us_national_debt, us_gdp}}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const TIMEOUT_MS = 20000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

export async function collectFredReal() {
  console.log('[FRED-replacement] Запуск...');
  const result = {
    source: 'FRED-replacement (ECB + Treasury)',
    updated: new Date().toISOString(),
    note: 'FRED требует API-ключ. Согласно правилу 12.2 заменён на открытые источники.',
    indicators: {},
  };

  try {
    const d = await fetchJson('https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=1&format=jsondata');
    const series = d.dataSets?.[0]?.series || {};
    const firstKey = Object.keys(series)[0];
    const obs = series[firstKey]?.observations || {};
    const lastKey = Object.keys(obs).pop();
    result.indicators.usd_eur = { value: obs[lastKey]?.[0], period: lastKey, source: 'ECB' };
  } catch (e) { console.error('[FRED-replacement] ECB ошибка:', e.message); }

  try {
    const d = await fetchJson('https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1');
    const rec = d.data?.[0];
    if (rec) result.indicators.us_national_debt = { value: parseFloat(rec.tot_pub_debt_out_amt), date: rec.record_date, source: 'US Treasury' };
  } catch (e) { console.error('[FRED-replacement] Treasury ошибка:', e.message); }

  try {
    const d = await fetchJson('https://api.worldbank.org/v2/country/USA/indicator/NY.GDP.MKTP.CD?format=json&mrv=1');
    if (d[1] && d[1][0]) {
      result.indicators.us_gdp = { value: d[1][0].value, year: d[1][0].date, source: 'World Bank' };
    }
  } catch (e) { console.error('[FRED-replacement] World Bank ошибка:', e.message); }

  const resultSave = await saveRaw('fred', result, {
    collector: 'collect-fred-real.mjs',
    source: 'FRED-replacement (ECB+Treasury+WorldBank)',
    source_url: 'https://fred.stlouisfed.org/',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: Object.keys(result.indicators).length,
    notes: `FRED заменён на ECB+Treasury+World Bank (правило 12.2). Индикаторов: ${Object.keys(result.indicators).length}; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[FRED-replacement] OK ${Object.keys(result.indicators).length} → ${resultSave.raw_file}`);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFredReal().catch((e) => { console.error('[FRED-replacement] FATAL:', e); process.exit(1); });
}
