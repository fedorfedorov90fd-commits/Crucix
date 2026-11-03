#!/usr/bin/env node
// Crucix Collector: TaxonomyGaps v1.0.0
// Читает: rsshub.json (basket.v1, 500 items) + config/taxonomy.json (25 сущностей, 97 aliases)
// Пишет: data/basket/taxonomy-gaps.json — тематические gaps
//
// Назначение: находит темы (страны, персоны, регионы), которые активно
// освещаются одной группой источников и полностью отсутствуют у другой.
// Это «информационные лакуны» — сигнал о замалчивании.
//
// Группировка по группам источников (russian / western / neutral),
// потому что в rsshub.json нет поля group. Маппинг по source.
//
// Формат taxonomy-gaps.json (совместим с taxonomy-multilayer.mjs):
//   { schema, meta, topics: [{ topic, topic_type, russian_count, western_count,
//     neutral_count, total_events, gap_type, severity, sample_titles }] }

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from '../../apis/sources/lib/basket-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_FILE = join(BASKET, 'taxonomy-gaps.json');
const TAXONOMY_PATH = join(ROOT, 'config', 'taxonomy.json');

// ─── Маппинг источников на группы (как в collect-silence.mjs) ───
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
  for (const p of RUSSIAN_PATTERNS) if (s.includes(p)) return 'russian';
  for (const p of WESTERN_PATTERNS) if (s.includes(p)) return 'western';
  return 'neutral';
}

function asArray(d) {
  if (!d) return [];
  if (Array.isArray(d)) return d;
  if (typeof d !== 'object') return [];
  if (Array.isArray(d.items)) return d.items;
  if (Array.isArray(d.documents)) return d.documents;
  if (Array.isArray(d.articles)) return d.articles;
  if (d.data) return asArray(d.data);
  return [];
}

function stripCdata(s) {
  if (!s) return '';
  return String(s).replace(/<!\[CDATA\[|\]\]>/g, '').trim();
}

async function main() {
  // ─── 1. Загружаем таксономию ───
  let taxonomy;
  try {
    taxonomy = JSON.parse(await readFile(TAXONOMY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[taxonomy] FATAL: не удалось прочитать ${TAXONOMY_PATH}: ${e.message}`);
    process.exit(1);
  }

  const entities = taxonomy.entities || {};
  const aliasMap = new Map(); // alias → entityId
  for (const [entityId, entity] of Object.entries(entities)) {
    for (const alias of (entity.aliases || [])) {
      aliasMap.set(alias.toLowerCase(), entityId);
    }
  }

  console.log(`[taxonomy] loaded ${Object.keys(entities).length} entities, ${aliasMap.size} aliases`);

  // ─── 2. Загружаем rsshub.json ───
  const basketFile = join(BASKET, 'rsshub.json');
  const res = await loadWithFallback({
    basketFile,
    fallbackData: null,
    hint: 'запустите scripts/collectors/collect-rsshub.mjs'
  });

  let items = [];
  if (res.source === 'basket-v1' && res.data) items = asArray(res.data);
  else if (res.source === 'basket-legacy' && res.legacy) items = asArray(res.legacy);

  console.log(`[taxonomy] loaded ${items.length} items from ${res.source}`);
  if (items.length === 0) {
    console.error('[taxonomy] FATAL: rsshub.json пуст');
    process.exit(1);
  }

  // ─── 3. Группируем по сущностям ───
  // entityId → { russian: N, western: N, neutral: N, titles: [] }
  const entityMap = new Map();

  for (const it of items) {
    const source = it.source || (it.extra && it.extra.source) || '';
    const group = classifySource(source);
    const text = `${stripCdata(it.title || '')} ${stripCdata(it.description || '')}`.toLowerCase();

    for (const [alias, entityId] of aliasMap) {
      if (text.includes(alias)) {
        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, { russian: 0, western: 0, neutral: 0, titles: [] });
        }
        const e = entityMap.get(entityId);
        e[group]++;
        if (e.titles.length < 5) e.titles.push(stripCdata(it.title || '').slice(0, 100));
      }
    }
  }

  console.log(`[taxonomy] matched ${entityMap.size} unique entities`);

  // ─── 4. Находим gaps ───
  const gaps = [];
  for (const [entityId, counts] of entityMap) {
    const { russian, western, neutral, titles } = counts;
    const total = russian + western + neutral;
    if (total < 3) continue; // игнорируем редкие упоминания

    let gap_type = null;
    let severity = 'normal';

    if (russian >= 3 && western === 0) {
      gap_type = 'western_silence';
      severity = russian >= 10 ? 'high' : 'normal';
    } else if (western >= 3 && russian === 0) {
      gap_type = 'russian_silence';
      severity = western >= 10 ? 'high' : 'normal';
    } else if (russian >= 3 && western >= 1 && russian / western > 5) {
      gap_type = 'western_undercovered';
      severity = russian / western >= 10 ? 'high' : 'normal';
    } else if (western >= 3 && russian >= 1 && western / russian > 5) {
      gap_type = 'russian_undercovered';
      severity = western / russian >= 10 ? 'high' : 'normal';
    }

    if (!gap_type) continue;

    const entity = entities[entityId] || {};
    gaps.push({
      topic: entityId,
      name: entity.ru || entityId,
      topic_type: entity.type || 'unknown',
      russian_count: russian,
      western_count: western,
      neutral_count: neutral,
      total_events: total,
      gap_type,
      severity,
      sample_titles: titles
    });
  }

  // Сортируем: high → normal, потом по total_events
  gaps.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return b.total_events - a.total_events;
  });

  console.log(`[taxonomy] gaps: ${gaps.length}`);
  for (const g of gaps.slice(0, 10)) {
    console.log(`  [${g.gap_type}] ${g.topic}  r=${g.russian_count} w=${g.western_count}  total=${g.total_events}  (${g.severity})`);
  }

  // ─── 5. Сохраняем ───
  const payload = {
    schema: 'crucix.basket.v1',
    meta: {
      id: 'taxonomy-gaps',
      source: 'rsshub.json + taxonomy.json',
      collected_at: new Date().toISOString(),
      collector: 'collect-taxonomy-gaps.mjs',
      count: gaps.length,
      total_items: items.length,
      unique_entities: entityMap.size,
      description: 'Тематические gaps: темы, которые активно освещаются одной группой и отсутствуют у другой'
    },
    topics: gaps,
    series: [],
    points: [],
    documents: []
  };

  await mkdir(BASKET, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');

  console.log(`[taxonomy] written to ${OUT_FILE}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
