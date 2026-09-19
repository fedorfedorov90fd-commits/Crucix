#!/usr/bin/env node
// Crucix Analyzer: SilencePatterns v1.0.0
// Читает: news, gdelt_news, interfax, ria, tass, bbc, google-trends
// Пишет: data/analytics/specialist/silence-patterns.json
// Назначение: обнаружение аномального молчания. Когда тема перестаёт
// упоминаться при обычной активности — сигнал зачистки медиа-поля перед
// операцией.

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
  catch { return fallback; }
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

  const sp = new SilencePatterns({ baselineHours: 168, currentHours: 24, minBaselineMentions: 3 });

  for (const arr of [news, gdelt, interfax, ria, tass, bbc]) {
    if (!Array.isArray(arr)) continue;
    for (const n of arr) {
      sp.addMention({
        text: (n.title || '') + ' ' + (n.description || ''),
        source: n.source || 'unknown',
        timestamp: n.timestamp || n.published_at || now,
      });
    }
  }
  for (const t of (trends || [])) {
    if (t.keyword || t.query) {
      sp.addMention({
        text: t.keyword || t.query,
        source: 'google-trends',
        timestamp: t.timestamp || now,
        weight: (t.value || 1) / 100,
      });
    }
  }

  const silences = sp.detectSilence();
  const byTopic = sp.byTopic();
  const stats = sp.stats();

  const payload = {
    _meta: {
      id: 'silence-patterns',
      category: 'specialist',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['news', 'gdelt_news', 'interfax', 'ria', 'tass', 'bbc', 'google-trends'],
      calculator: 'SilencePatterns',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { mentions: sp.mentions.length, silences: silences.length, topics: Object.keys(byTopic).length },
      description: 'Аномальное молчание: тема исчезает из потока при обычной активности.',
    },
    data: { silences, by_topic: byTopic, stats, generated_at: now },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('SilencePatterns v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Упоминаний:', sp.mentions.length);
  console.log('Тем всего:', Object.keys(byTopic).length);
  console.log('Обнаружено молчаний:', silences.length);
  console.log('');
  for (const s of silences.slice(0, 5)) {
    console.log(`  "${s.topic}": baseline=${s.baselineCount}, current=${s.currentCount}, silenceScore=${s.silenceScore.toFixed(2)}, level=${s.level}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); process.exit(1); });
