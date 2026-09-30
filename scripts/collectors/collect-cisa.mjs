#!/usr/bin/env node
/**
 * Crucix Collector: CISA KEV (известные эксплуатируемые уязвимости).
 * Версия 2.0.0. Принят 19.09.2026.
 *
 * Синтез из collect-cisa.mjs (demo) + collect-cisa-kev.mjs (реальная логика).
 * Правило #871: единый файл, вбирающий лучшее из обоих.
 * Правило #39: API-ключи запрещены — KEV фид открыт (без ключа, без регистрации).
 *
 * Источник: https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 * Формат: catalog (массив vulnerabilities как entries).
 *
 * Улучшение против collect-cisa-kev.mjs: НЕ обрезаем до 50 последних.
 * Сборщик привозит ВЕСЬ фид (~1200 уязвимостей). Обрезка — задача потребителя.
 *
 * Demo-fallback: если fetch упал — 30 demo-записей (логика сохранена из v1.0.0).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const KEV_URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
const FETCH_TIMEOUT_MS = 60000;

async function fetchKev() {
  const r = await fetch(KEV_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  if (!d || !Array.isArray(d.vulnerabilities)) {
    throw new Error('CISA KEV: неожиданный формат ответа');
  }
  return {
    catalogVersion: d.catalogVersion || null,
    dateReleased: d.dateReleased || null,
    count: d.count || d.vulnerabilities.length,
    entries: d.vulnerabilities
  };
}

function demoData() {
  const vendors = ['Microsoft', 'Adobe', 'Oracle', 'Cisco', 'Google', 'Apple', 'Linux', 'Apache'];
  const severity = ['Critical', 'High', 'Medium'];
  const now = new Date();
  const entries = [];
  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    entries.push({
      cveID: `CVE-DEMO-${i}`,
      vendorProject: vendors[Math.floor(Math.random() * vendors.length)],
      product: 'Demo Product',
      vulnerabilityName: `Demo Vulnerability ${i}`,
      dateAdded: date.toISOString().slice(0, 10),
      severity: severity[Math.floor(Math.random() * severity.length)],
      shortDescription: 'Demo-fallback запись. CISA KEV фид недоступен.'
    });
  }
  return {
    source: 'CISA KEV (demo-fallback)',
    updated: new Date().toISOString(),
    note: 'CISA KEV фид недоступен. Demo-данные.',
    entries
  };
}

export async function collectCISA() {
  let data;
  let sourceName;

  try {
    const kev = await fetchKev();
    data = {
      source: 'CISA KEV',
      updated: new Date().toISOString(),
      catalogVersion: kev.catalogVersion,
      dateReleased: kev.dateReleased,
      total: kev.count,
      entries: kev.entries
    };
    sourceName = 'kev-feed';
  } catch (e) {
    console.warn(`[CISA] KEV недоступен: ${e.message}. Demo-данные.`);
    data = demoData();
    sourceName = 'demo-fallback';
  }

  const result = await saveRaw('cisa', data, {
    collector: 'collect-cisa.mjs',
    source: 'CISA KEV (Known Exploited Vulnerabilities)',
    source_url: KEV_URL,
    license: 'public-domain',
    format_hint: 'catalog',
    value_unit: 'count',
    value_scale: 'cyber_vulnerabilities',
    granularity: 'snapshot',
    record_count: data.entries.length,
    notes: `source=${sourceName}, уязвимостей=${data.entries.length}`,
    backwardCompat: true
  });

  console.log(`[CISA] OK ${data.entries.length} уязвимостей (${sourceName}) → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCISA().catch((e) => { console.error('[CISA] FATAL:', e.message); process.exit(1); });
}
