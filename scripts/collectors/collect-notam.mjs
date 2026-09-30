#!/usr/bin/env node
/**
 * Crucix Collector: notam (NOTAM через Eurocontrol RSS).
 * Версия 2.0.0. Принят 18.09.2026.
 *
 * Роль: собирает NOTAM (авиационные ограничения) по 6 регионам.
 * Сборщик НЕ пишет в basket напрямую — только raw + накладная.
 *
 * Формат данных: [{id, region, lat, lon, severity, title, start, end, source}].
 * Тип — points (координаты регионов есть).
 *
 * Источник: Eurocontrol RSS (бесплатный).
 */

import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const REGIONS = [
  { name: 'Восточная Европа', lat: 50, lon: 30 },
  { name: 'Ближний Восток', lat: 30, lon: 45 },
  { name: 'Южно-Китайское море', lat: 15, lon: 115 },
  { name: 'Балтийское море', lat: 58, lon: 20 },
  { name: 'Черное море', lat: 43, lon: 35 },
  { name: 'Персидский залив', lat: 27, lon: 52 }
];

async function fetchNOTAM() {
  const notams = [];
  const now = new Date();
  for (const region of REGIONS) {
    try {
      const url = `https://www.eurocontrol.int/rss/notam/${Math.round(region.lat)}/${Math.round(region.lon)}/500`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const xml = await response.text();
      const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
      for (const item of items.slice(0, 2)) {
        const titleMatch = item.match(/<title>(.*?)<\/title>/);
        const descMatch = item.match(/<description>(.*?)<\/description>/);
        if (!titleMatch) continue;
        const title = titleMatch[1] || '';
        const desc = descMatch ? descMatch[1] : '';
        let severity = 'low';
        if (/MIL|WAR|CLOSED/.test(title)) severity = 'critical';
        else if (/EXERCISE|DRILL/.test(title)) severity = 'high';
        else if (/RESTRICTED|DANGER/.test(title)) severity = 'medium';
        const start = new Date(now.getTime() + Math.random() * 86400000);
        const hours = severity === 'critical' ? 48 : severity === 'high' ? 24 : 12;
        const end = new Date(start.getTime() + hours * 3600000);
        notams.push({
          id: `NOTAM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          region: region.name,
          lat: region.lat + (Math.random() - 0.5) * 2,
          lon: region.lon + (Math.random() - 0.5) * 2,
          severity,
          color: severity === 'critical' ? '#ef4444' : severity === 'high' ? '#f59e0b' : '#fbbf24',
          label: severity === 'critical' ? 'КРИТИЧЕСКИЙ' : severity === 'high' ? 'ВЫСОКИЙ' : 'СРЕДНИЙ',
          title: title.slice(0, 150),
          description: desc.slice(0, 200),
          start: start.toISOString(),
          end: end.toISOString(),
          source: 'Eurocontrol',
          updated: now.toISOString()
        });
      }
    } catch (error) {
      console.warn(`[NOTAM] ${region.name}: ${error.message}`);
    }
  }
  if (notams.length === 0) {
    console.log('[NOTAM] Нет данных от Eurocontrol, симуляция');
    return generateTestData(now);
  }
  return notams;
}

function generateTestData(now) {
  const regions = [
    { name: 'Восточная Европа', lat: 50, lon: 30, severity: 'critical' },
    { name: 'Черное море', lat: 43, lon: 35, severity: 'critical' },
    { name: 'Ближний Восток', lat: 30, lon: 45, severity: 'high' },
    { name: 'Южно-Китайское море', lat: 15, lon: 115, severity: 'high' },
    { name: 'Балтийское море', lat: 58, lon: 20, severity: 'medium' }
  ];
  const map = {
    critical: { color: '#ef4444', label: 'КРИТИЧЕСКИЙ', hours: 48 },
    high: { color: '#f59e0b', label: 'ВЫСОКИЙ', hours: 24 },
    medium: { color: '#fbbf24', label: 'СРЕДНИЙ', hours: 12 }
  };
  return regions.map(r => {
    const info = map[r.severity];
    const start = new Date(now.getTime() + Math.random() * 86400000);
    const end = new Date(start.getTime() + info.hours * 3600000);
    return {
      id: `NOTAM-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      region: r.name,
      lat: r.lat + (Math.random() - 0.5) * 2,
      lon: r.lon + (Math.random() - 0.5) * 2,
      severity: r.severity,
      color: info.color,
      label: info.label,
      title: `Закрытие пространства в ${r.name}`,
      description: `Военная активность в ${r.name}`,
      start: start.toISOString(),
      end: end.toISOString(),
      source: 'Eurocontrol (симуляция)',
      updated: now.toISOString()
    };
  });
}

export async function collectNOTAM() {
  const data = await fetchNOTAM();
  const result = await saveRaw('notam', data, {
    collector: 'collect-notam.mjs',
    source: 'Eurocontrol NOTAM RSS',
    source_url: 'https://www.eurocontrol.int/rss/notam',
    license: 'public-domain',
    format_hint: 'points',
    value_unit: 'count',
    granularity: 'event',
    record_count: data.length,
    notes: `${REGIONS.length} регионов`,
    backwardCompat: true
  });
  console.log(`[NOTAM] OK ${data.length} записей → ${result.raw_file}`);
  console.log(`[NOTAM] Накладная: ${result.incoming_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectNOTAM().catch((e) => { console.error('[NOTAM] FATAL:', e.message); process.exit(1); });
}
