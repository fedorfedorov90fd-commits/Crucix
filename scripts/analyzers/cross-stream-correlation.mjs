#!/usr/bin/env node
// Crucix Analyzer: CrossStreamCorrelation v1.0.0
// Читает: acled, news, gdelt, market, infrastructure, weather, cyber
// Пишет: data/analytics/flow/cross-stream-correlation.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import CrossStreamCorrelation from '../../apis/sources/cross-stream-correlation.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'flow');
const OUT_FILE = join(OUT_DIR, 'cross-stream-correlation.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

const COUNTRY_TO_REGION = {
  UKR: 'Eastern Europe', RUS: 'Eastern Europe', BLR: 'Eastern Europe',
  ISR: 'Middle East', IRN: 'Middle East', SYR: 'Middle East', IRQ: 'Middle East', YEM: 'Middle East', LBN: 'Middle East',
  SDN: 'East Africa', ETH: 'East Africa', SOM: 'East Africa',
  MLI: 'West Africa', NGA: 'West Africa', BFA: 'West Africa', NER: 'West Africa',
  CHN: 'East Asia', TWN: 'East Asia', JPN: 'East Asia', KOR: 'East Asia', PRK: 'East Asia',
  USA: 'Americas', MEX: 'Americas', BRA: 'Americas', VEN: 'Americas',
};

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  const acled = await readJson(join(BASKET, 'acled.json'), { events: [] });
  const news = await readJson(join(BASKET, 'news.json'), []);
  const gdelt = await readJson(join(BASKET, 'gdelt.json'), []);
  const vix = await readJson(join(BASKET, 'vix.json'), null);
  const quakes = await readJson(join(BASKET, 'earthquakes.json'), []);
  const cyber = await readJson(join(BASKET, 'cyber-attacks.json'), []);

  const csc = new CrossStreamCorrelation();

  // Conflict stream — из ACLED
  for (const ev of (acled.events || acled || [])) {
    csc.add({
      id: ev.id || `acled_${Math.random()}`,
      stream: 'conflict',
      timestamp: ev.event_date ? new Date(ev.event_date).getTime() : Date.now(),
      region: COUNTRY_TO_REGION[ev.country] || ev.country || 'Unknown',
      severity: Math.min((ev.fatalities || 0) / 50, 1),
    });
  }

  // News stream
  const newsArr = Array.isArray(news) ? news : (news.articles || news.features || []);
  for (const n of newsArr.slice(0, 100)) {
    csc.add({
      id: n.id || `news_${Math.random()}`,
      stream: 'news',
      timestamp: typeof n.timestamp === 'number' ? n.timestamp : (n.publishedAt ? new Date(n.publishedAt).getTime() : Date.now()),
      region: COUNTRY_TO_REGION[n.country] || n.region || 'Unknown',
      severity: 0.5,
    });
  }

  // Market stream
  if (vix && typeof vix.value === 'number') {
    csc.add({
      id: 'vix_event',
      stream: 'market',
      timestamp: Date.now(),
      region: 'GLOBAL',
      severity: Math.min(vix.value / 50, 1),
    });
  }

  // Infrastructure stream — землетрясения
  for (const eq of (quakes || []).slice(0, 50)) {
    csc.add({
      id: eq.id || `quake_${Math.random()}`,
      stream: 'weather',
      timestamp: eq.time ? new Date(eq.time).getTime() : Date.now(),
      region: COUNTRY_TO_REGION[eq.country] || eq.country || 'Unknown',
      severity: Math.min((eq.magnitude || 0) / 8, 1),
    });
  }

  // Cyber stream
  for (const c of (cyber || []).slice(0, 50)) {
    csc.add({
      id: c.id || `cyber_${Math.random()}`,
      stream: 'cyber',
      timestamp: c.timestamp || Date.now(),
      region: COUNTRY_TO_REGION[c.country] || c.region || 'Unknown',
      severity: 0.5,
    });
  }

  const topRegions = csc.topConvergenceRegions(15, { windowHours: 168, minSeverity: 0.1 });

  const payload = {
    _meta: {
      id: 'cross-stream-correlation',
      category: 'flow',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['acled', 'news', 'gdelt', 'vix', 'earthquakes', 'cyber-attacks'],
      calculator: 'CrossStreamCorrelation',
      updated_at: now,
      period: '168h',
      duration_ms: Date.now() - t0,
      checksum: '',
      stats: { total_events: csc.events.length, regions: topRegions.length },
      description: 'Кросс-корреляция событий из разных потоков данных: новости, конфликты, рынки, инфраструктура, погода, кибер.',
    },
    data: {
      regions: topRegions,
      total: topRegions.length,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('CrossStreamCorrelation v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Событий загружено:', csc.events.length);
  console.log('Регионов проанализировано:', topRegions.length);
  console.log('');
  console.log('Топ-5 регионов по конвергенции:');
  for (const r of topRegions.slice(0, 5)) {
    console.log(`  ${r.region}: convergence=${r.convergenceScore} (${r.convergenceLevel}), streams=${r.activeStreams}, events=${r.totalEvents}`);
  }
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
