#!/usr/bin/env node
/**
 * Crucix Collector: CISA KEV (Known Exploited Vulnerabilities) — реальный API.
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: реальный API → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 * Формат: {source, updated, total, recent:[50]}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const RECENT_LIMIT = 50;
const TIMEOUT_MS = 20000;

export async function collectCisaKev() {
  console.log('[CISA KEV] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;

  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    const all = d.vulnerabilities || [];
    const recent = all.slice(-RECENT_LIMIT).reverse();
    basketData = {
      source: 'CISA KEV',
      updated: new Date().toISOString(),
      total: d.count || all.length,
      recent,
    };
    console.log(`[CISA KEV] Получено ${all.length}, взято ${recent.length}`);
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[CISA KEV] ⚠️ Ошибка:', e.message);
    basketData = { source: 'CISA KEV', updated: new Date().toISOString(), total: 0, recent: [], error: e.message };
  }

  const result = await saveRaw('cisa-kev', basketData, {
    collector: 'collect-cisa-kev.mjs',
    source: 'CISA Known Exploited Vulnerabilities',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.recent.length,
    notes: ok ? `Реальные данные CISA, взято ${basketData.recent.length} из ${basketData.total}` : 'Fallback (API недоступен); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CISA KEV] OK → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCisaKev().catch((e) => { console.error('[CISA KEV] FATAL:', e); process.exit(1); });
}
