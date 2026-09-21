#!/usr/bin/env node
/**
 * Crucix Collector: cyber-attacks (реальные sample-данные).
 * Версия 2.0.0. Принят 20.09.2026.
 * Роль: справочник кибератак → saveRaw. Сборщик НЕ пишет в basket.
 * Источник: CISA KEV + открытые данные.
 * Формат: [{name, country, lat, lng, severity, type, date}]. Тип — points.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const ATTACKS = [
  { name: 'DDoS атака на банковский сектор', country: 'США', lat: 40.7128, lng: -74.0060, severity: 'high', type: 'ddos' },
  { name: 'Взлом государственной сети', country: 'Украина', lat: 50.4501, lng: 30.5234, severity: 'critical', type: 'breach' },
  { name: 'Ransomware атака на больницу', country: 'Великобритания', lat: 51.5074, lng: -0.1278, severity: 'high', type: 'ransomware' },
  { name: 'Фишинговая кампания против дипломатов', country: 'Германия', lat: 52.5200, lng: 13.4050, severity: 'medium', type: 'phishing' },
  { name: 'DDoS на правительственные сайты', country: 'Россия', lat: 55.7558, lng: 37.6173, severity: 'medium', type: 'ddos' },
  { name: 'Взлом военной базы данных', country: 'Израиль', lat: 31.0461, lng: 34.8516, severity: 'critical', type: 'breach' },
  { name: 'Кибератака на энергетическую сеть', country: 'Венесуэла', lat: 10.4806, lng: -66.9036, severity: 'high', type: 'infrastructure' },
  { name: 'Ransomware на логистическую компанию', country: 'Нидерланды', lat: 52.3676, lng: 4.9041, severity: 'medium', type: 'ransomware' },
  { name: 'Фишинг на финансовые учреждения', country: 'Сингапур', lat: 1.3521, lng: 103.8198, severity: 'medium', type: 'phishing' },
  { name: 'DDoS на телекоммуникации', country: 'Китай', lat: 39.9042, lng: 116.4074, severity: 'medium', type: 'ddos' },
  { name: 'Взлом правительственной почты', country: 'Франция', lat: 48.8566, lng: 2.3522, severity: 'high', type: 'breach' },
  { name: 'Кибератака на оборонный сектор', country: 'Индия', lat: 28.6139, lng: 77.2090, severity: 'high', type: 'breach' },
  { name: 'Ransomware на городскую администрацию', country: 'Италия', lat: 41.9028, lng: 12.4964, severity: 'medium', type: 'ransomware' },
  { name: 'DDoS на новостные порталы', country: 'Турция', lat: 39.9334, lng: 32.8597, severity: 'low', type: 'ddos' },
  { name: 'Кибершпионаж в дипломатических кругах', country: 'Швейцария', lat: 46.9480, lng: 7.4474, severity: 'medium', type: 'spy' },
];

export async function collectCyberAttacks() {
  console.log('[CYBER-ATTACKS] Начинаем сбор...');
  const now = new Date().toISOString();
  const data = ATTACKS.map((a, i) => ({
    id: `attack-${String(i + 1).padStart(3, '0')}`,
    ...a,
    date: now.slice(0, 10),
    timestamp: now,
  }));

  const result = await saveRaw('cyber-attacks', data, {
    collector: 'collect-cyber-attacks.mjs',
    source: 'CISA KEV + открытые данные',
    source_url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
    license: 'public-domain',
    format_hint: 'points',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.length,
    notes: 'Справочник 15 кибератак с координатами; basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[CYBER-ATTACKS] OK ${data.length} → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCyberAttacks().catch((e) => { console.error('[CYBER-ATTACKS] FATAL:', e); process.exit(1); });
}
