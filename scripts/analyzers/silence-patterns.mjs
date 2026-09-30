#!/usr/bin/env node
// Crucix Analyzer: SilencePatterns v1.0.3
// Файл: /home/ta8_/Рабочий стол/Crucix/scripts/analyzers/silence-patterns.mjs
// Читает: news, gdelt_news, interfax, ria, tass, bbc, google-trends (из basket)
// Пишет: data/analytics/specialist/silence-patterns.json
// Класс: apis/sources/silence-patterns.mjs (методы addMention, detectSilence, byTopic, stats)
//
// СИНТЕЗ ИЗ ДУБЛЕЙ (21.09.2026):
//   - scripts/analyzers/silence-patterns-дубль.mjs (4766 б, компактная шапка)
//   - scripts/analysis/silence-patterns-дубль.mjs (5553 б, полная шапка)
//   Взяты полные комментарии из полной версии + вся функциональность обоих.
//
// История версий:
//   v1.0.1: были ошибочные вызовы ingest()/compute() — таких методов в классе нет.
//   v1.0.2 (20.09.2026): asArray() — защита от контракта v3 (basket.v1 — объект
//     с points/series). Правильные вызовы класса: addMention(), detectSilence(),
//     byTopic(), stats().
//   v1.0.3 (21.09.2026): синтез двух дублей в канон scripts/analyzers/.

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import SilencePatterns from '../../apis/sources/silence-patterns.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'silence-patterns.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch (e) { return fallback; }
}

// asArray — приводит любой вход к массиву.
//   Массив          → как есть.
//   v3-объект       → points / series / regions / items / data / entries (первое найденное).
//   null/undefined  → [].
//   Прочее          → [].
function asArray(x) {
  if (Array.isArray(x)) return x;
  if (x && typeof x === 'object') {
    if (Array.isArray(x.points)) return x.points;
    if (Array.isArray(x.series)) return x.series;
    if (Array.isArray(x.regions)) return x.regions;
    if (Array.isArray(x.items)) return x.items;
    if (Array.isArray(x.data)) return x.data;
    if (Array.isArray(x.entries)) return x.entries;
  }
  return [];
}

// Универсальное извлечение текста из элемента (массив news или v3-point)
function extractText(n) {
  if (!n || typeof n !== 'object') return '';
  const parts = [
    n.title, n.headline, n.label,
    n.description, n.summary, n.text, n.content,
  ].filter(Boolean).map(String);
  return parts.join(' ').trim();
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const news = await readJson(join(BASKET, 'news.json'), []);
  const gdelt = await readJson(join(BASKET, 'gdelt_news.json'), []);
  const interfax = await readJson(join(BASKET, 'interfax.json'), []);
  const ria = await readJson(join(BASKET, 'ria.json'), []);
  const tass = await readJson(join(BASKET, 'tass.json'), []);
  const bbc = await readJson(join(BASKET, 'bbc.json'), []);
  const trends = await readJson(join(BASKET, 'google-trends.json'), []);

  const sp = new SilencePatterns({
    baselineHours: 168,
    currentHours: 24,
    minBaselineMentions: 3,
  });

  // Шесть новостных источников
  const newsSources = [
    ['news', news],
    ['gdelt_news', gdelt],
    ['interfax', interfax],
    ['ria', ria],
    ['tass', tass],
    ['bbc', bbc],
  ];

  let ingested = 0;
  for (const [sourceName, raw] of newsSources) {
    for (const n of asArray(raw)) {
      const text = extractText(n);
      if (!text) continue;
      const ts = n.pubDate || n.timestamp || n.date || n.collectedAt || now;
      const ok = sp.addMention({ text, source: sourceName, weight: 1, timestamp: ts });
      if (ok) ingested++;
    }
  }

  // Google Trends (v3-объект с points)
  for (const t of asArray(trends)) {
    const text = t.label || t.title || extractText(t);
    if (!text) continue;
    const ts = t.timestamp || t.date || now;
    const ok = sp.addMention({ text, source: 'google-trends', weight: 1, timestamp: ts });
    if (ok) ingested++;
  }

  const silences = sp.detectSilence();
  const byTopic = sp.byTopic();
  const classStats = sp.stats();

  const resultStats = {
    mentions: ingested,
    silences: silences.length,
    topics: Object.keys(byTopic).length,
  };

  const out = {
    _meta: {
      id: 'silence-patterns',
      category: 'specialist',
      version: '1.0.3',
      schema_version: '1.0.3',
      sources: ['news', 'gdelt_news', 'interfax', 'ria', 'tass', 'bbc', 'google-trends'],
      calculator: 'SilencePatterns',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: createHash('md5').update(JSON.stringify(silences)).digest('hex').slice(0, 16),
      stats: resultStats,
      description: 'Аномальное молчание: тема исчезает из потока при обычной активности.',
    },
    data: {
      silences,
      by_topic: byTopic,
      classStats,
    },
  };

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2), 'utf-8');

  console.log('OK silences=' + silences.length + ' topics=' + resultStats.topics + ' mentions=' + ingested);
  console.log('OUT: ' + OUT_FILE);

  for (const s of silences.slice(0, 5)) {
    console.log('  ' + s.topic + ' — baseline ' + s.baselineCount + ', current ' + s.currentCount + ', score ' + s.silenceScore + ' (' + s.level + ')');
  }
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
