#!/usr/bin/env node
/**
 * Crucix Collector: treasury (госдолг США) — реальный API Fiscal Data.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://api.fiscaldata.treasury.gov/.../debt_to_penny
 * Формат: {source, updated, latest, history:[{date, totalDebt}]}. Тип — timeseries.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=10';
const TIMEOUT_MS = 15000;

export async function collectTreasury() {
  console.log('[Treasury] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const records = (d.data || []).map(x => ({ date: x.record_date, totalDebt: parseFloat(x.tot_pub_debt_out_amt) }));
    basketData = { source: 'US Treasury', updated: new Date().toISOString(), latest: records[0], history: records };
    ok = true;
    console.log(`[Treasury] последняя: ${records[0]?.date}, долг: $${(records[0]?.totalDebt / 1e12).toFixed(2)}T`);
  } catch (e) {
    clearTimeout(timer);
    console.error('[Treasury] ⚠️ Ошибка:', e.message);
    basketData = { source: 'US Treasury (fallback)', updated: new Date().toISOString(), latest: null, history: [], error: e.message };
  }

  const result = await saveRaw('treasury-debt', basketData, {
    collector: 'collect-treasury.mjs',
    source: 'US Treasury Fiscal Data',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'usd',
    granularity: 'daily',
    period: 'P10D',
    record_count: basketData.history.length,
    notes: ok ? `Реальные данные Treasury (${basketData.history.length} записей)` : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[Treasury] OK ${basketData.history.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectTreasury().catch(e => { console.error('[Treasury] FATAL:', e.message); process.exit(1); });
}
