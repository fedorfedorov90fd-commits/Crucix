#!/usr/bin/env node
// Crucix Collector: NarrativeFraming v1.0.0
// Читает: rsshub.json (basket.v1, 500 items) + config/taxonomy.json
// Пишет: data/basket/narrative-framing.json — polarity + latency по темам
//
// Назначение: находит темы, где russian и western источники:
//   1) пишут с разной тональностью (framing_gap) — |polarity_delta| > 0.3
//   2) реагируют с разной скоростью (reaction_gap) — |latency| > 6h
//
// Polarity — сентимент-словарь (~100 слов). Грубо, но даёт сигнал.
// Latency — медиана разницы pubDate между russian и western (общие события).
//
// Формат narrative-framing.json (совместим с narrative-framing-api.mjs):
//   { schema, meta, topics: [{ topic, topic_type, polarity_russian, polarity_western,
//     polarity_delta, russian_count, western_count, latency_hours,
//     gap_type, severity, sample_titles }] }

import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadWithFallback } from '../../apis/sources/lib/basket-loader.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET = join(ROOT, 'data', 'basket');
const OUT_FILE = join(BASKET, 'narrative-framing.json');
const TAXONOMY_PATH = join(ROOT, 'config', 'taxonomy.json');

// ─── Сентимент-словарь ───
const POSITIVE = new Set([
  'успех', 'успешный', 'рост', 'растёт', 'победа', 'победил', 'победила', 'улучшение',
  'развитие', 'прогресс', 'достижение', 'рекорд', 'стабильность', 'поддержка',
  'соглашение', 'мир', 'переговоры', 'сотрудничество', 'инвестиции', 'восстановление',
  'growth', 'success', 'win', 'victory', 'agreement', 'deal', 'peace', 'improvement',
  'positive', 'recovery', 'support', 'cooperation', 'investment', 'record', 'progress',
]);
const NEGATIVE = new Set([
  'кризис', 'провал', 'катастрофа', 'авария', 'крушение', 'столкновение', 'обстрел',
  'удар', 'атака', 'взрыв', 'пожар', 'теракт', 'убийство', 'смерть', 'погибли',
  'санкции', 'запрет', 'ограничения', 'эмбарго', 'конфликт', 'война', 'эскалация',
  'угроза', 'проблема', 'ошибка', 'сбой', 'утечка', 'взлом', 'мошенничество',
  'коррупция', 'арест', 'задержан', 'протест', 'беспорядки', 'инфляция',
  'crisis', 'failure', 'disaster', 'crash', 'attack', 'explosion', 'fire', 'war',
  'conflict', 'sanctions', 'threat', 'problem', 'error', 'leak', 'hack', 'fraud',
  'corruption', 'arrest', 'protest', 'riot', 'inflation', 'recession',
]);

const NEGATIONS = new Set(['не', 'нет', 'ни', 'без', 'not', 'no', 'never']);

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

function parseTs(v) {
  if (v == null) return Date.now();
  if (typeof v === 'number') return v;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

function sentimentScore(title) {
  if (!title) return 0;
  const words = title.toLowerCase().replace(/ё/g, 'е').split(/[^а-яa-z\-]+/);
  let pos = 0, neg = 0;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (!w) continue;
    const isNegated = i > 0 && NEGATIONS.has(words[i - 1]);
    if (POSITIVE.has(w)) {
      if (isNegated) neg++; else pos++;
    } else if (NEGATIVE.has(w)) {
      if (isNegated) pos++; else neg++;
    }
  }
  const total = pos + neg;
  if (total === 0) return 0;
  return Math.max(-1, Math.min(1, (pos - neg) / total));
}

async function main() {
  // ─── 1. Загружаем таксономию ───
  let taxonomy;
  try {
    taxonomy = JSON.parse(await readFile(TAXONOMY_PATH, 'utf-8'));
  } catch (e) {
    console.error(`[framing] FATAL: не удалось прочитать ${TAXONOMY_PATH}: ${e.message}`);
    process.exit(1);
  }

  const entities = taxonomy.entities || {};
  const aliasMap = new Map();
  for (const [entityId, entity] of Object.entries(entities)) {
    for (const alias of (entity.aliases || [])) {
      aliasMap.set(alias.toLowerCase(), entityId);
    }
  }

  console.log(`[framing] loaded ${Object.keys(entities).length} entities, ${aliasMap.size} aliases`);

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

  console.log(`[framing] loaded ${items.length} items from ${res.source}`);
  if (items.length === 0) {
    console.error('[framing] FATAL: rsshub.json пуст');
    process.exit(1);
  }

  // ─── 3. Группируем по сущностям ───
  // entityId → { russian: [{title, ts}], western: [{title, ts}], neutral: [...] }
  const entityMap = new Map();

  for (const it of items) {
    const source = it.source || (it.extra && it.extra.source) || '';
    const group = classifySource(source);
    const text = `${stripCdata(it.title || '')} ${stripCdata(it.description || '')}`.toLowerCase();
    const title = stripCdata(it.title || '');
    const ts = parseTs(it.pubDate || it.publishedAt || it.timestamp || it.collectedAt);

    for (const [alias, entityId] of aliasMap) {
      if (text.includes(alias)) {
        if (!entityMap.has(entityId)) {
          entityMap.set(entityId, { russian: [], western: [], neutral: [] });
        }
        entityMap.get(entityId)[group].push({ title, ts });
      }
    }
  }

  console.log(`[framing] matched ${entityMap.size} unique entities`);

  // ─── 4. Анализ по темам ───
  const topics = [];
  for (const [entityId, data] of entityMap) {
    const { russian, western, neutral } = data;
    if (russian.length + western.length + neutral.length < 3) continue;

    // Polarity
    const polRus = russian.length > 0
      ? russian.reduce((s, x) => s + sentimentScore(x.title), 0) / russian.length
      : null;
    const polWest = western.length > 0
      ? western.reduce((s, x) => s + sentimentScore(x.title), 0) / western.length
      : null;
    const polarityDelta = (polRus !== null && polWest !== null)
      ? Math.abs(polRus - polWest)
      : null;

    // Latency (медиана разницы first_published по общим событиям)
    // Группируем по title (упрощённо), берём min ts для russian и western
    const byTitle = new Map();
    for (const x of russian) {
      const k = x.title.toLowerCase().slice(0, 50);
      if (!byTitle.has(k)) byTitle.set(k, { ru: null, we: null });
      const e = byTitle.get(k);
      if (e.ru === null || x.ts < e.ru) e.ru = x.ts;
    }
    for (const x of western) {
      const k = x.title.toLowerCase().slice(0, 50);
      if (!byTitle.has(k)) byTitle.set(k, { ru: null, we: null });
      const e = byTitle.get(k);
      if (e.we === null || x.ts < e.we) e.we = x.ts;
    }
    const latencies = [];
    for (const e of byTitle.values()) {
      if (e.ru !== null && e.we !== null) {
        latencies.push((e.ru - e.we) / 3600000); // часы
      }
    }
    let latencyHours = null;
    if (latencies.length > 0) {
      const sorted = [...latencies].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      latencyHours = sorted.length % 2 === 1
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;
    }

    // Классификация
    const hasFraming = polarityDelta !== null && polarityDelta > 0.3;
    const hasReaction = latencyHours !== null && Math.abs(latencyHours) > 6;

    let gapType = 'none';
    if (hasFraming && hasReaction) gapType = 'both';
    else if (hasFraming) gapType = 'framing_gap';
    else if (hasReaction) gapType = 'reaction_gap';
    if (gapType === 'none') continue;

    let severity = 'normal';
    if ((polarityDelta !== null && polarityDelta > 0.5) ||
        (latencyHours !== null && Math.abs(latencyHours) > 12)) {
      severity = 'high';
    }

    const entity = entities[entityId] || {};
    topics.push({
      topic: entityId,
      name: entity.ru || entityId,
      topic_type: entity.type || 'unknown',
      polarity_russian: polRus,
      polarity_western: polWest,
      polarity_delta: polarityDelta,
      russian_count: russian.length,
      western_count: western.length,
      neutral_count: neutral.length,
      latency_hours: latencyHours,
      gap_type: gapType,
      severity,
      sample_titles: [...russian.slice(0, 2), ...western.slice(0, 2)].map(x => x.title.slice(0, 100)),
    });
  }

  topics.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'high' ? -1 : 1;
    return (b.polarity_delta || 0) - (a.polarity_delta || 0);
  });

  console.log(`[framing] gaps: ${topics.length}`);
  for (const t of topics.slice(0, 10)) {
    const pr = t.polarity_russian !== null ? t.polarity_russian.toFixed(2) : '—';
    const pw = t.polarity_western !== null ? t.polarity_western.toFixed(2) : '—';
    const pd = t.polarity_delta !== null ? t.polarity_delta.toFixed(2) : '—';
    const lat = t.latency_hours !== null ? t.latency_hours.toFixed(1) : '—';
    console.log(`  [${t.gap_type}] ${t.topic}  pr=${pr} pw=${pw} Δ=${pd} lat=${lat}h  (${t.severity})`);
  }

  // ─── 5. Сохраняем ───
  const payload = {
    schema: 'crucix.basket.v1',
    meta: {
      id: 'narrative-framing',
      source: 'rsshub.json + taxonomy.json',
      collected_at: new Date().toISOString(),
      collector: 'collect-narrative-framing.mjs',
      count: topics.length,
      total_items: items.length,
      unique_entities: entityMap.size,
      description: 'Поляризация фреймингов + скорость реакции по темам'
    },
    topics,
    series: [],
    points: [],
    documents: []
  };

  await mkdir(BASKET, { recursive: true });
  await writeFile(OUT_FILE, JSON.stringify(payload, null, 2), 'utf-8');
  console.log(`[framing] written to ${OUT_FILE}`);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
