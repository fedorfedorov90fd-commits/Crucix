#!/usr/bin/env node
/**
 * Crucix Collector: frankfurter (курсы валют ЕЦБ) — реальный API, без ключа.
 * Версия 2.0.0. Принят 20.09.2026.
 * Источник: https://api.frankfurter.app/latest?from=USD
 * Формат: {source, updated, base, date, rates:{...}}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://api.frankfurter.app/latest?from=USD';
const TIMEOUT_MS = 15000;

export async function collectFrankfurter() {
  console.log('[FX] Загрузка курсов...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    basketData = { source: 'Frankfurter (ECB)', updated: new Date().toISOString(), base: d.base, date: d.date, rates: d.rates };
    console.log(`[FX] ${Object.keys(d.rates).length} валют на ${d.date}`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[FX] ⚠️ Ошибка:', e.message);
    basketData = { source: 'Frankfurter (ECB)', updated: new Date().toISOString(), base: 'USD', date: null, rates: {}, error: e.message };
  }

  const result = await saveRaw('fx-rates', basketData, {
    collector: 'collect-frankfurter.mjs',
    source: 'Frankfurter API (ECB)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'price',
    value_unit: 'rate',
    granularity: 'snapshot',
    period: null,
    record_count: Object.keys(basketData.rates || {}).length,
    notes: ok ? 'Реальные курсы ЕЦБ' : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[FX] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectFrankfurter().catch((e) => { console.error('[FX] FATAL:', e); process.exit(1); });
}
