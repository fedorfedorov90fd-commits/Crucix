/**
 * scripts/warehouse/quality.mjs
 * Модуль метрик качества склада.
 * Версия 1.1.0. Принят 19.09.2026.
 *
 * Отвечает на вопросы:
 *   - Насколько полны данные? (completeness)
 *   - Насколько свежие? (timeliness)
 *   - Есть ли дубликаты? (duplicates)
 *   - Сколько unmapped регионов?
 *
 * Изменение 1.1.0: учёт catalog-записей (extra.entries) и documents
 *   в total_records. Раньше для catalog-источников (CoinGecko, OFAC SDN)
 *   total_records было 0, потому что считались только series+points+regions.
 *   Теперь total_records = series + points + regions + documents + extra.entries.
 *
 * Контракт:
 *   loadQuality() → {schema, updated_at, items: {id: metrics}}
 *   saveQuality(quality) → атомарная запись
 *   computeCompleteness(data, requiredFields) → 0..1
 *   computeQualityFor(id, normalized, meta) → metrics
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const QUALITY_PATH = join(ROOT, 'data', 'warehouse', 'quality.json');

export async function loadQuality() {
  if (!existsSync(QUALITY_PATH)) {
    return { schema: 'crucix.warehouse.quality.v1', updated_at: null, items: {} };
  }
  try {
    const raw = await readFile(QUALITY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    return { schema: 'crucix.warehouse.quality.v1', updated_at: null, items: {} };
  }
}

export async function saveQuality(quality) {
  quality.updated_at = new Date().toISOString();
  await mkdir(dirname(QUALITY_PATH), { recursive: true });
  const tmp = QUALITY_PATH + '.tmp';
  const payload = JSON.stringify(quality, null, 2);
  await writeFile(tmp, payload, 'utf-8');
  await writeFile(QUALITY_PATH, payload, 'utf-8');
}

function countNonNull(arr, key) {
  let n = 0;
  for (const r of arr) if (r && r[key] !== null && r[key] !== undefined) n++;
  return n;
}

export function computeQualityFor(id, normalized) {
  const series = Array.isArray(normalized.series) ? normalized.series : [];
  const points = Array.isArray(normalized.points) ? normalized.points : [];
  const regions = Array.isArray(normalized.regions) ? normalized.regions : [];
  const documents = Array.isArray(normalized.documents) ? normalized.documents : [];
  const catalogEntries = normalized.extra && Array.isArray(normalized.extra.entries)
    ? normalized.extra.entries.length
    : 0;

  // total_records теперь включает catalog-записи и documents
  const totalRecords = series.length + points.length + regions.length + documents.length + catalogEntries;

  // completeness: доля записей с основными полями
  let seriesComplete = 0;
  for (const s of series) if (s.date && typeof s.value === 'number') seriesComplete++;
  const seriesCompleteness = series.length > 0 ? seriesComplete / series.length : 1;

  let pointsComplete = 0;
  for (const p of points) if (typeof p.lat === 'number' && typeof p.lon === 'number') pointsComplete++;
  const pointsCompleteness = points.length > 0 ? pointsComplete / points.length : 1;

  let regionsComplete = 0;
  for (const r of regions) if (r.region && typeof r.value === 'number') regionsComplete++;
  const regionsCompleteness = regions.length > 0 ? regionsComplete / regions.length : 1;

  const overallCompleteness = (seriesCompleteness + pointsCompleteness + regionsCompleteness) / 3;

  // unmapped из extra
  const unmappedCount = normalized.extra && normalized.extra.unmapped_count
    ? normalized.extra.unmapped_count
    : (normalized.extra && Array.isArray(normalized.extra.unmapped_regions)
      ? normalized.extra.unmapped_regions.length
      : 0);

  // timeliness: возраст в часах от normalized_at
  const now = Date.now();
  const normAt = normalized.meta && normalized.meta.normalized_at
    ? new Date(normalized.meta.normalized_at).getTime()
    : now;
  const ageHours = (now - normAt) / 3600000;

  const graph = normalized.graph && typeof normalized.graph === 'object' ? normalized.graph : null;
  const graphNodes = graph && Array.isArray(graph.nodes) ? graph.nodes.length : 0;
  const graphEdges = graph && Array.isArray(graph.edges) ? graph.edges.length : 0;

  return {
    id,
    total_records: totalRecords,
    series_count: series.length,
    points_count: points.length,
    regions_count: regions.length,
    documents_count: documents.length,
    catalog_entries_count: catalogEntries,
    graph_nodes: graphNodes,
    graph_edges: graphEdges,
    completeness: Math.round(overallCompleteness * 1000) / 1000,
    series_completeness: Math.round(seriesCompleteness * 1000) / 1000,
    points_completeness: Math.round(pointsCompleteness * 1000) / 1000,
    regions_completeness: Math.round(regionsCompleteness * 1000) / 1000,
    unmapped_count: unmappedCount,
    age_hours: Math.round(ageHours * 10) / 10,
    last_normalized_at: normalized.meta ? normalized.meta.normalized_at : null,
    updated_at: new Date().toISOString()
  };
}

export const QUALITY_FILE = QUALITY_PATH;
