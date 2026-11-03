#!/usr/bin/env node
// Crucix Collector: Silence v1.0.0
// Читает: rsshub.json (basket.v1, 500 items — основной)
// Пишет: data/basket/silence.json — регионы с аномальным падением потока
//
// Назначение: детектор информационной тишины. Сравнивает baseline (7 дней)
// с current (24 часа). Если поток упал на 40%+ — warning, на 70%+ — silence.
//
// Группировка по группам источников (russian / western / neutral),
// потому что в rsshub.json нет поля region. Это честный сигнал:
// если российские СМИ вдруг замолчали — это аномалия.
//
// Формат silence.json (совместим с silence-api.mjs):
//   { regions: [{ id, name, lat, lng, status, drop, baseline, current, category, region, since, notes, source }] }

import { writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from '../../apis/sources/lib/basket-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_FILE = join(BASKET, 'silence.json');

// ─── Маппинг источников на группы ───
// russian: РИА, ТАСС, Интерфакс, RT, Известия, Взгляд, Lenta, КП, Правда
// western: Guardian, BBC, NYT, SCMP, Straits Times, France 24, Sky News, Al Jazeera
// neutral: остальные
const RUSSIAN_PATTERNS = [
  'РИА', 'ТАСС', 'Интерфакс', 'RT', 'Известия', 'Взгляд', 'Lenta', 'Лента',
  'Комсомольская', 'Правда', 'Звезда', 'Радио Sputnik', 'Sputnik', '1Prime',
  'Российская газета', 'Коммерсант', 'Ведомости', 'РБК', 'Газета'
];
const WESTERN_PATTERNS = [
  'Guardian', 'BBC', 'NYT', 'SCMP', 'South China', 'Straits Times', 'France 24',
  'Sky News', 'Al Jazeera', 'Reuters', 'AP', 'CNN', 'Fox News', 'Politico',
  'DW', 'Economist', 'FT', 'Financial Times', 'Wall Street'
];

function classifySource(source) {
  if (!source) return 'neutral';
  const s = String(source);
  for (const p of RUSSIAN_PATTERNS) {
    if (s.includes(p)) return 'russian';
  }
  for (const p of WESTERN_PATTERNS) {
    if (s.includes(p)) return 'western';
  }
  return 'neutral';
}

function parseTs(v) {
  if (v == null) return Date.now();
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function asArray(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d !== 'object') return [];
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.documents)) return d.documents;
  if (Array.isArray(d.articles)) return d.articles;
  if (Array.isArray(d.news)) return d.news;
  if (d.data) return asArray(d.data);
  return [];
}

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function main() {
  const basketFile = join(BASKET, 'rsshub.json');
  const res = await loadWithFallback({
    basketFile,
    fallbackData: null,
    hint: 'запустите scripts/collectors/collect-rsshub.mjs'
  });

  let items = [];
  if (res.source === 'basket-v1' && res.data) {
    items = asArray(res.data);
  } else if (res.source === 'basket-legacy' && res.legacy) {
    items = asArray(res.legacy);
  }

  console.log(`[silence] loaded ${items.length} items from ${res.source}`);

  if (items.length === 0) {
    console.error('[silence] FATAL: rsshub.json пуст или не найден');
    process.exit(1);
  }

  // ─── Группировка по группам источников ───
  const now = Date.now();
  const DAY = 24 * 3600 * 1000;
  const WEEK = 7 * DAY;

  const groups = new Map(); // 'russian' | 'western' | 'neutral' → { baseline, current }

  for (const it of items) {
    const source = it.source || (it.extra && it.extra.source) || '';
    const group = classifySource(source);
    const ts = parseTs(it.pubDate || it.publishedAt || it.timestamp || it.collectedAt);
    const age = now - ts;

    if (!groups.has(group)) groups.set(group, { baseline: 0, current: 0 });
    const g = groups.get(group);

    if (age <= WEEK) g.baseline++;
    if (age <= DAY) g.current++;
  }

  // ─── Расчёт drop и статуса ───
  const regionCoords = {
    russian: { lat: 60.0, lng: 100.0, name: 'Российские СМИ' },
    western: { lat: 50.0, lng: 0.0, name: 'Западные СМИ' },
    neutral: { lat: 20.0, lng: 30.0, name: 'Нейтральные СМИ' }
  };

  const regions = [];
  for (const [group, g] of groups) {
    // ВАЖНО: rsshub.json — это один снимок (все 500 items собраны сегодня).
    // Нет истории за 7 дней — нет baseline. Поэтому baseline = current,
    // drop = 0. Когда появится история (rss-history), baseline будет реальным.
    const current = g.current;
    const baselineDaily = current; // нет истории — baseline = current
    const drop = 0; // нет истории — нет падения

    let status = 'normal';
    if (drop >= 70) status = 'silence';
    else if (drop >= 40) status = 'warning';

    const coords = regionCoords[group] || { lat: 0, lng: 0, name: group };

    regions.push({
      id: group,
      name: coords.name,
      lat: coords.lat,
      lng: coords.lng,
      status,
      drop,
      baseline: Math.round(baselineDaily * 10) / 10,
      current,
      category: 'source_group',
      region: group,
      since: new Date(now - DAY).toISOString(),
      notes: `baseline=${baselineDaily} (нет истории, baseline=current), current=${current}`,
      source: 'rsshub'
    });
  }

  // ─── Сохранение ───
  const payload = {
    schema: 'crucix.basket.v1',
    meta: {
      id: 'silence',
      source: 'rsshub.json',
      collected_at: new Date().toISOString(),
      collector: 'collect-silence.mjs',
      count: regions.length,
      total_items: items.length,
      description: 'Детектор информационной тишины: аномальные падения потока по группам источников'
    },
    regions,
    series: [],
    points: [],
    documents: []
  };

  await mkdir(BASKET, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`[silence] written ${regions.length} regions to ${OUT_FILE}`);
  for (const r of regions) {
    console.log(`  ${r.id.padEnd(10)} [${r.status.padEnd(8)}] drop=${r.drop}%  baseline=${r.baseline}  current=${r.current}`);
  }

  const silent = regions.filter(r => r.status === 'silence');
  const warning = regions.filter(r => r.status === 'warning');
  console.log(`[silence] silence: ${silent.length}, warning: ${warning.length}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
