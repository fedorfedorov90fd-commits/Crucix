#!/usr/bin/env node
/**
 * Crucix Collector: who (алерты ВОЗ) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: {source, updated, alerts:[...], summary:{...}}. Тип — catalog.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const DEMO_DATA = {
  alerts: [
    { id: 'who-001', disease: 'Ebola', country: 'Демократическая Республика Конго', status: 'active', risk: 'high', date: '2026-08-10', source: 'WHO' },
    { id: 'who-002', disease: 'Cholera', country: 'Йемен', status: 'active', risk: 'high', date: '2026-08-12', source: 'WHO' },
    { id: 'who-003', disease: 'Dengue', country: 'Бразилия', status: 'active', risk: 'medium', date: '2026-08-14', source: 'WHO' },
    { id: 'who-004', disease: 'Monkeypox', country: 'Нигерия', status: 'active', risk: 'medium', date: '2026-08-15', source: 'WHO' },
    { id: 'who-005', disease: 'Polio', country: 'Пакистан', status: 'active', risk: 'high', date: '2026-08-16', source: 'WHO' },
  ],
  summary: {
    total: 5,
    byRisk: { high: 3, medium: 2 },
    byStatus: { active: 5 },
    byCountry: { 'ДР Конго': 1, 'Йемен': 1, 'Бразилия': 1, 'Нигерия': 1, 'Пакистан': 1 },
  },
};

export async function collectWHO() {
  const basketData = {
    source: 'WHO',
    updated: new Date().toISOString(),
    alerts: DEMO_DATA.alerts,
    summary: DEMO_DATA.summary,
    note: 'Демо-данные (WHO Disease Outbreak News API не подключён)',
  };
  const result = await saveRaw('who', basketData, {
    collector: 'collect-who.mjs',
    source: 'WHO Disease Outbreak News (demo)',
    source_url: 'https://www.who.int/emergencies/disease-outbreak-news',
    license: 'public-domain',
    format_hint: 'catalog',
    value_type: 'count',
    value_unit: 'alerts',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.alerts.length,
    notes: `Demo: 5 алертов ВОЗ; basket не перезаписывается`,
    backwardCompat: false,
  });
  console.log(`[WHO] OK ${basketData.alerts.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectWHO().catch(e => { console.error('[WHO] FATAL:', e.message); process.exit(1); });
}
