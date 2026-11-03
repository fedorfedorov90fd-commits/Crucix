#!/usr/bin/env node
// Crucix Collector: Alerts v1.0.0
// Читает: silence.json + taxonomy-gaps.json + narrative-framing.json
// Пишет: data/basket/alerts.json — единый список алертов для тикера
//
// Назначение: объединяет три источника (тишина, тематические gaps,
// поляризация фреймингов) в единый поток алертов с приоритетом.
// Только severity=high идёт в тикер (короткие 5-10 сообщений).
//
// Формат alerts.json:
//   { schema, meta, alerts: [{ id, type, severity, title, topic, short, url, ts }] }

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_FILE = join(BASKET, 'alerts.json');

async function loadJson(name) {
  try {
    const raw = await readFile(join(BASKET, name), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

function asTopics(d) {
  if (!d) return [];
  if (Array.isArray(d.topics)) return d.topics;
  if (Array.isArray(d.regions)) return d.regions;
  if (Array.isArray(d)) return d;
  return [];
}

async function main() {
  const silence = await loadJson('silence.json');
  const gaps = await loadJson('taxonomy-gaps.json');
  const framing = await loadJson('narrative-framing.json');

  const alerts = [];
  const now = new Date().toISOString();
  let nextId = 1;

  // ─── 1. Silence: только статус silence или warning ───
  for (const r of asTopics(silence)) {
    if (r.status === 'silence' || r.status === 'warning') {
      const drop = r.drop || 0;
      alerts.push({
        id: `alert-${nextId++}`,
        type: 'silence',
        severity: r.status === 'silence' ? 'high' : 'normal',
        title: `Информационная тишина: ${r.name || r.id}`,
        topic: r.id,
        short: `Тишина: ${r.name} (drop ${drop.toFixed(1)}%)`,
        url: `/silence?region=${r.id}`,
        ts: now,
        drop_pct: drop,
        baseline: r.baseline,
        current: r.current,
      });
    }
  }

  // ─── 2. Taxonomy gaps: только severity=high ───
  for (const t of asTopics(gaps)) {
    if (t.severity !== 'high') continue;
    const ratio = t.western_count > 0 ? Math.round(t.russian_count / t.western_count) : 999;
    alerts.push({
      id: `alert-${nextId++}`,
      type: 'taxonomy_gap',
      severity: 'high',
      title: `Информационный пробел: ${t.name || t.topic}`,
      topic: t.topic,
      short: `${t.gap_type === 'western_silence' ? 'Запад молчит' : 'Россия молчит'}: ${t.name} (r=${t.russian_count} w=${t.western_count})`,
      url: `/dashboard-news#taxonomy-gaps`,
      ts: now,
      gap_type: t.gap_type,
      russian_count: t.russian_count,
      western_count: t.western_count,
      ratio,
    });
  }

  // ─── 3. Framing gaps: только severity=high ───
  for (const t of asTopics(framing)) {
    if (t.severity !== 'high') continue;
    const delta = Math.abs(t.polarity_delta || 0);
    alerts.push({
      id: `alert-${nextId++}`,
      type: 'narrative_framing',
      severity: 'high',
      title: `Поляризация фрейминга: ${t.name || t.topic}`,
      topic: t.topic,
      short: `Фрейминг: ${t.name} (Δ=${delta.toFixed(2)})`,
      url: `/dashboard-news#narrative-framing`,
      ts: now,
      polarity_russian: t.polarity_russian,
      polarity_western: t.polarity_western,
      polarity_delta: delta,
    });
  }

  // Сортируем: severity=high первыми, потом по типу
  alerts.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return a.type.localeCompare(b.type);
  });

  const payload = {
    schema: 'crucix.basket.v1',
    meta: {
      id: 'alerts',
      source: 'silence.json + taxonomy-gaps.json + narrative-framing.json',
      collected_at: now,
      collector: 'collect-alerts.mjs',
      count: alerts.length,
      count_high: alerts.filter(a => a.severity === 'high').length,
      sources: {
        silence: asTopics(silence).length,
        taxonomy_gaps: asTopics(gaps).length,
        narrative_framing: asTopics(framing).length,
      },
      description: 'Единый поток алертов для тикера (silence + taxonomy-gaps + narrative-framing)',
    },
    alerts,
    series: [],
    points: [],
    documents: [],
  };

  await mkdir(BASKET, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`[alerts] sources: silence=${asTopics(silence).length}, taxonomy-gaps=${asTopics(gaps).length}, narrative-framing=${asTopics(framing).length}`);
  console.log(`[alerts] total alerts: ${alerts.length} (high: ${payload.meta.count_high})`);
  for (const a of alerts.slice(0, 10)) {
    console.log(`  [${a.severity}] ${a.short}`);
  }
  console.log(`[alerts] written to ${OUT_FILE}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
