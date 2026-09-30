#!/usr/bin/env node
/**
 * Crucix Collector: cyber-threats.
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: генерирует демо-данные кибер-угроз и сдаёт через saveRaw.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат данных: [{date, threat, region, count}]. Тип — timeseries
 * (есть date + числовое count, нет координат). Регион текстовый (континент),
 * в справочнике стран его нет — уйдёт в extra.unmapped_regions.
 *
 * Реальный источник — не подключён (демо-режим).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const THREATS = ['DDoS', 'Ransomware', 'Phishing', 'Data Breach', 'Malware', 'APT'];
const REGIONS = ['Europe', 'North America', 'Asia', 'Middle East'];
const DAYS_BACK = 30;

function generateData() {
  const now = new Date();
  const data = [];
  for (let i = DAYS_BACK; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toISOString().slice(0, 10),
      threat: THREATS[Math.floor(Math.random() * THREATS.length)],
      region: REGIONS[Math.floor(Math.random() * REGIONS.length)],
      count: Math.floor(Math.random() * 50) + 1
    });
  }
  return data;
}

export async function collectCyberThreats() {
  const data = generateData();
  const result = await saveRaw('cyber-threats', data, {
    collector: 'collect-cyber-threats.mjs',
    source: 'Crucix cyber-threats (demo)',
    source_url: 'local://demo',
    license: 'proprietary',
    format_hint: 'timeseries',
    value_unit: 'count',
    granularity: 'event',
    record_count: data.length,
    notes: 'Демо-данные, реальный источник не подключён',
    backwardCompat: true
  });

  console.log(`[Cyber Threats] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[Cyber Threats] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectCyberThreats().catch((e) => { console.error('[Cyber Threats] FATAL:', e.message); process.exit(1); });
}
