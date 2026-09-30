#!/usr/bin/env node
/**
 * Crucix Collector: ECB (курсы валют ЕЦБ) — реальный API, без ключа.
 * Версия 2.0.1. Принят 20.09.2026.
 *
 * Изменения от 2.0.0:
 *   - Реальные даты вместо индексов observations. ECB API возвращает
 *     observations: {0: [v], 1: [v], ...}, а даты — в
 *     structure.dimensions.observation[0].values[i].id (ISO-строки).
 *   - Формат values: [{date: "2026-09-10", value: 1.1622}, ...].
 *   - Ключ pair вместо pairs (единственное число — это одна пара).
 *
 * ВЫХОД: data/raw/ecb-usd-eur-<timestamp>.json + накладная.
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.USD.EUR.SP00.A?lastNObservations=10&format=jsondata';
const TIMEOUT_MS = 15000;

export async function collectECB() {
  console.log('[ECB] Загрузка USD/EUR...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;

  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}
r. status}
`);
    const d = await r.json();

    // observations: {0: [v], 1: [v], ...}
    const obs = d.dataSets?.[0]?.series?.['0:0:0:0:0']?.observations || {};
    const obsKeys = Object.keys(obs);

    // Реальные даты — в structure.dimensions.observation[0].values
    const dateValues = d.structure?.dimensions?.observation?.[0]?.values || [];

    // Строим карту индекс → дата
    // dateValues: [{id: "2026-09-10", name: "2026-09-10"}, ...]
    // Порядок в values[] соответствует порядку obsKeys по возрастанию индекса.
    const sortedKeys = obsKeys.map(k => parseInt(k, 10)).sort((a, b) => a - b);

    const values = sortedKeys.map((idx, i) => {
      const dateEntry = dateValues[idx] || dateValues[i] || null;
      const dateStr = dateEntry?.id || dateEntry?.name || null;
      const obsEntry = obs[String(idx)];
      const val = Array.isArray(obsEntry) ? obsEntry[0] : null;
      return { date: dateStr, value: val };
    }).filter(x => x.date && typeof x.value === 'number');

    basketData = {
      source: 'ECB',
      updated: new Date().toISOString(),
      pair: 'USD/EUR',
      values,
    };
    console.log(`[ECB] USD/EUR: ${values.length}
Ценности. длина}
 точек, последняя ${values[values.length - 1]?.date}
значения [значения. длина - 1]
`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[ECB] ⚠️ Ошибка:', e.message);
    basketData = { source: 'ECB', updated: new Date().toISOString(), pair: 'USD/EUR', values: [], error: e.message };
  }

  const result = await saveRaw('ecb-usd-eur', basketData, {
    collector: 'collect-ecb.mjs',
    source: 'European Central Bank Data API',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'timeseries',
    value_type: 'price',
    value_unit: 'rate',
    granularity: 'daily',
    period: null,
    record_count: basketData.values.length,
    notes: ok ? `Реальные данные ЕЦБ (${basketData.values.length}
basketData. Ценности. длина}
 точек)` : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[ECB] OK ${basketData.values.length}
basketData. Ценности. длина}
 → ${result.raw_file}
результат. raw_file}
`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectECB().catch(e => { console.error('[ECB] FATAL:', e.message); process.exit(1); });
}
