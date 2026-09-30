#!/usr/bin/env node
/**
 * Crucix Collector: rss-extra (RSS-новости дополнительный) — demo.
 * Версия 2.0.0. Принят 20.09.2026.
 * Формат: {source, timestamp, total_sources, success, failed, results:[...]}. Тип — events.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

export async function collectRSSExtra() {
  const now = new Date().toISOString();
  const data = {
    source: 'rss-extra',
    timestamp: now,
    total_sources: 6,
    success: 6,
    failed: 0,
    results: [
      { source: 'BBC World', category: 'world', count: 3, items: [
        { title: 'Global tensions rise as conflicts escalate', link: '#', date: now },
        { title: 'Oil prices surge amid supply concerns', link: '#', date: now },
        { title: 'Climate summit opens with new commitments', link: '#', date: now },
      ]},
      { source: 'Al Jazeera', category: 'middle-east', count: 2, items: [
        { title: 'Middle East leaders call for de-escalation', link: '#', date: now },
        { title: 'Humanitarian crisis deepens in conflict zones', link: '#', date: now },
      ]},
    ],
  };

  const result = await saveRaw('rss-extra', data, {
    collector: 'collect-rss-extra.mjs',
    source: 'RSS Extra (demo)',
    source_url: 'local://demo',
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: data.results.reduce((s, r) => s + r.count, 0),
    notes: 'Демо-данные (5 новостей, 2 источника); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[RSS Extra] OK 5 → ${result.raw_file}`);
  return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectRSSExtra().catch((e) => { console.error('[RSS Extra] FATAL:', e); process.exit(1); });
}
