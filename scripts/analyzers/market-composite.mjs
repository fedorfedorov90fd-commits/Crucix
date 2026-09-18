#!/usr/bin/env node
// Crucix Analyzer: MarketComposite v1.0.0
// Читает: data/basket/vix.json, oil.json, gold.json, dxy.json, treasury.json
//         и другие market-данные
// Пишет: data/analytics/market/market-composite.json

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import MarketComposite from '../../apis/sources/market-composite.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_DIR = join(ROOT, 'data', 'analytics', 'market');
const OUT_FILE = join(OUT_DIR, 'market-composite.json');

async function readJson(path, fallback = null) {
  try { return JSON.parse(await readFile(path, 'utf-8')); }
  catch { return fallback; }
}

function extractLatestValue(data) {
  if (!data) return null;
  if (typeof data.value === 'number') return data.value;
  if (typeof data.value === 'string') return parseFloat(data.value);
  if (Array.isArray(data) && data.length > 0) {
    const last = data[data.length - 1];
    return typeof last === 'object' ? (last.value ?? last.close ?? last.price ?? null) : last;
  }
  if (data.data && Array.isArray(data.data)) {
    const last = data.data[data.data.length - 1];
    return last?.value ?? last?.close ?? null;
  }
  if (data.features && Array.isArray(data.features)) {
    return data.features[0]?.properties?.value ?? null;
  }
  return null;
}

async function main() {
  const now = new Date().toISOString();
  const t0 = Date.now();

  // Загружаем все market-источники
  const sources = {
    vix: await readJson(join(BASKET, 'vix.json')),
    oil: await readJson(join(BASKET, 'oil.json')),
    gold: await readJson(join(BASKET, 'gold.json')),
    dxy: await readJson(join(BASKET, 'dxy.json')),
    treasury: await readJson(join(BASKET, 'treasury.json')),
    hySpread: await readJson(join(BASKET, 'hy-spread.json')),
    dxyAlt: await readJson(join(BASKET, 'dxy-latest.json')),
  };

  const inputs = {
    vix: extractLatestValue(sources.vix),
    oil: extractLatestValue(sources.oil),
    gold: extractLatestValue(sources.gold),
    dxy: extractLatestValue(sources.dxy) ?? extractLatestValue(sources.dxyAlt),
    yield10y: extractLatestValue(sources.treasury),
    hySpread: extractLatestValue(sources.hySpread),
    region: 'GLOBAL',
  };

  const stats = {
    sources_found: Object.entries(sources).filter(([k, v]) => v !== null).map(([k]) => k),
    sources_missing: Object.entries(sources).filter(([k, v]) => v === null).map(([k]) => k),
    fields_imputed: [],
  };

  for (const [k, v] of Object.entries(inputs)) {
    if (v == null && k !== 'region') stats.fields_imputed.push(k);
  }

  const mc = new MarketComposite();
  const result = mc.compute(inputs);

  const payload = {
    _meta: {
      id: 'market-composite',
      category: 'market',
      version: '1.0.0',
      schema_version: '1.0.0',
      sources: ['vix', 'oil', 'gold', 'dxy', 'treasury', 'hy-spread'],
      calculator: 'MarketComposite',
      updated_at: now,
      duration_ms: Date.now() - t0,
      period: 'daily',
      checksum: '',
      stats,
      description: 'Композитный рыночный риск: волатильность (VIX) + commodities (нефть/золото) + валюты (DXY) + bonds (yield10y/HY spread). Взвешенная сумма.',
    },
    data: {
      composite: result,
      generated_at: now,
    },
  };

  const body = JSON.stringify(payload, null, 2);
  payload._meta.checksum = createHash('sha256').update(body).digest('hex').slice(0, 16);
  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log('════════════════════════════════════════════');
  console.log('MarketComposite v1.0.0 — отчёт');
  console.log('════════════════════════════════════════════');
  console.log('Score:', result.score, '(' + result.level + ')');
  console.log('Components:', JSON.stringify(result.components));
  console.log('Raw inputs:', JSON.stringify(result.raw));
  console.log('');
  console.log('Источники найдены:', stats.sources_found.join(', ') || 'нет');
  console.log('Источники отсутствуют:', stats.sources_missing.join(', ') || 'нет');
  console.log('Imputed поля:', stats.fields_imputed.join(', ') || 'нет');
  console.log('Длительность:', payload._meta.duration_ms, 'мс');
  console.log('');
  console.log('Файл записан:', OUT_FILE);
}

main().catch(e => { console.error('ERR:', e.message); console.error(e.stack); process.exit(1); });
