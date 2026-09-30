#!/usr/bin/env node
// Crucix Analyzer: NarrativeDrift v1.1.0
// Читает: news.json, gdelt_news.json, interfax, ria, tass, bbc + действия
// Пишет: data/analytics/specialist/narrative-drift.json
//
// ИСПРАВЛЕНИЕ v1.1.0: безопасное чтение источников любой структуры
// (массив / {articles:[...]} / {events:[...]} / {data:[...]} / null).

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import NarrativeDrift from '../../apis/sources/narrative-drift.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'specialist');
const OUT_FILE = join(OUT_DIR, 'narrative-drift.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function asArray(d) {
  if (Array.isArray(d)) return d;
  if (!d || typeof d !== 'object') return [];
  if (Array.isArray(d.articles)) return d.articles;
  if (Array.isArray(d.events)) return d.events;
  if (Array.isArray(d.news)) return d.news;
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.records)) return d.records;
  if (Array.isArray(d.features)) return d.features;
  if (d.data) return asArray(d.data);
  return [];
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const nd = new NarrativeDrift({ windowHours: 168 });

  const newsFiles = [
    { file: 'news.json', type: 'news' },
    { file: 'gdelt_news.json', type: 'gdelt' },
    { file: 'interfax.json', type: 'interfax' },
    { file: 'ria.json', type: 'ria' },
    { file: 'tass.json', type: 'tass' },
    { file: 'bbc.json', type: 'bbc' },
  ];

  const loaded = {};

  for (const src of newsFiles) {
    const raw = await readJson(join(BASKET, src.file), null);
    const arr = asArray(raw);
    let count = 0;
    for (const n of arr) {
      const title = n.title || n.text || n.headline || '';
      const desc = n.description || n.summary || n.body || '';
      if (!title && !desc) continue;
      nd.addStatement({
        title,
        description: desc,
        source: src.type,
        country: n.country || null,
        timestamp: n.timestamp || n.published_at || n.pubDate || now,
      });
      count++;
    }
    loaded[src.type] = count;
  }

  // Действия
  const acled = asArray(await readJson(join(BASKET, 'acled.json'), null));
  for (const e of acled) {
    nd.addAction({ type: 'conflict', country: e.country, timestamp: e.event_date || e.timestamp || now, severity: Math.min((e.fatalities || 0) / 50, 1) });
  }

  const milEx = asArray(await readJson(join(BASKET, 'military-exercises.json'), null));
  for (const m of milEx) {
    const c = m.coordinates || m;
    nd.addAction({ type: 'military-exercise', country: m.country || null, lat: c.lat, lon: c.lng || c.lon, timestamp: m.timestamp || now, severity: 0.8 });
  }

  const notam = asArray(await readJson(join(BASKET, 'notam.json'), null));
  for (const n of notam) {
    nd.addAction({ type: 'notam', country: n.country, lat: n.lat, lon: n.lng || n.lon, timestamp: now, severity: 0.6 });
  }

  const gps = asArray(await readJson(join(BASKET, 'gps-jamming.json'), null));
  for (const g of gps) {
    nd.addAction({ type: 'gps-jamming', country: g.country, lat: g.lat, lon: g.lng || g.lon, timestamp: now, severity: 0.7 });
  }

  const drifts = nd.computeDrift();
  const byCountry = nd.byCountry();
  const stats = nd.stats();

  const payload = {
    _meta: {
      id: 'narrative-drift',
      category: 'specialist',
      version: '1.1.0',
      schema_version: '1.1.0',
      sources: Object.keys(loaded).filter(k => loaded[k] > 0),
      calculator: 'NarrativeDrift',
      updated_at: now,
      period: 'latest',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { statements: nd.statements.length, actions: nd.actions.length, drifts: drifts.length, by_source: loaded },
      description: 'Расхождение слов и действий: официальные заявления vs физические данные.',
    },
    data: { drifts, by_country: byCountry, stats, generated_at: now },
  };

  const body = JSON.stringify({ ...payload, _meta: { ...payload._meta, checksum: '' } });
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('NarrativeDrift v1.1.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Заявлений:', nd.statements.length);
  console.log('Действий:', nd.actions.length);
  console.log('Расхождений:', drifts.length);
  console.log('');
  for (const [name, cnt] of Object.entries(loaded)) {
    console.log(`  ${cnt > 0 ? '✓' : '·'} ${name.padEnd(15)} ${cnt}`);
  }
  console.log('');
  for (const d of drifts.slice(0, 5)) {
    console.log(`  ${d.country}: statements=${d.statements}, actions=${d.actions}, drift=${d.driftScore}, level=${d.level}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
