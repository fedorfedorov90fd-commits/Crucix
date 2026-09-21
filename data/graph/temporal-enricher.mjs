#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  temporal-enricher.mjs — Temporal Layer for Knowledge Graph
//  Crucix / data/graph/
//
//  Читает entity-graph.json (после сборки build-graph.mjs) и добавляет
//  temporal-поля на узлы и рёбра. НЕ трогает entity-resolution.mjs.
//
//  Логика temporal:
//    Узел:  active_from  — самая ранняя дата из sources/provenance
//           active_to    — null (активен) или явный конец, если есть
//    Ребро: valid_from   — когда факт стал истинным в реальности
//           valid_to     — null (действует) или явный конец
//           observed_at  — когда мы впервые увидели в basket
//
//  Источники дат (по приоритету):
//    1. Явные поля в объекте: date, timestamp, event_date, fetched_at
//    2. provenance[].fetched_at — для рёбер
//    3. first_seen / last_seen — для узлов (fallback)
//
//  Использование в build-graph.mjs:
//    import { enrichTemporal } from './temporal-enricher.mjs';
//    ...
//    const entityGraph = engine.toJSON();
//    enrichTemporal(entityGraph);
//    fs.writeFileSync(graphPath, JSON.stringify(entityGraph, null, 2));
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GRAPH_FILE = path.join(__dirname, 'entity-graph.json');

// ─────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────

function toISO(v) {
  if (!v) return null;
  if (typeof v === 'string') {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString();
  return null;
}

function earliest(dates) {
  let min = null;
  for (const d of dates) {
    const iso = toISO(d);
    if (!iso) continue;
    if (!min || iso < min) min = iso;
  }
  return min;
}

function latest(dates) {
  let max = null;
  for (const d of dates) {
    const iso = toISO(d);
    if (!iso) continue;
    if (!max || iso > max) max = iso;
  }
  return max;
}

function pickExplicitDate(obj) {
  if (!obj || typeof obj !== 'object') return null;
  const candidates = [
    obj.valid_from, obj.valid_to,
    obj.event_date, obj.eventDate,
    obj.date, obj.timestamp,
    obj.fetched_at, obj.fetchedAt,
  ];
  for (const c of candidates) {
    const iso = toISO(c);
    if (iso) return iso;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────
//  ENRICH: УЗЛЫ
// ─────────────────────────────────────────────────────────────────────

function enrichNode(node) {
  const candidates = [
    node.first_seen,
    node.last_seen,
    node.active_from,
    node.properties?.timestamp,
    node.properties?.date,
    node.properties?.fetched_at,
    node.properties?.firstSeen,
  ];
  const from = earliest(candidates) || node.first_seen || new Date().toISOString();
  const to = node.active_to || null;

  node.active_from = from;
  node.active_to = to;

  // observed_at: когда узел впервые записан в граф (first_seen)
  if (!node.observed_at) {
    node.observed_at = node.first_seen || from;
  }

  return node;
}

// ─────────────────────────────────────────────────────────────────────
//  ENRICH: РЁБРА
// ─────────────────────────────────────────────────────────────────────

function enrichEdge(edge) {
  const provDates = (edge.provenance || [])
    .map(p => p.fetched_at || p.observed_at || p.date)
    .filter(Boolean);

  // observed_at: самая ранняя дата наблюдения из provenance
  const observedAt = earliest(provDates) || new Date().toISOString();

  // valid_from: явное поле ребра или observed_at (факт стал истинным тогда же, когда наблюдён)
  const validFrom = edge.valid_from
    || pickExplicitDate(edge)
    || observedAt;

  // valid_to: null = действует, иначе — явное
  const validTo = edge.valid_to || null;

  edge.valid_from = validFrom;
  edge.valid_to = validTo;
  edge.observed_at = observedAt;

  return edge;
}

// ─────────────────────────────────────────────────────────────────────
//  ГЛАВНАЯ ФУНКЦИЯ
// ─────────────────────────────────────────────────────────────────────

export function enrichTemporal(graph) {
  if (!graph || typeof graph !== 'object') return graph;

  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  let nodesEnriched = 0;
  let edgesEnriched = 0;

  for (const node of nodes) {
    enrichNode(node);
    nodesEnriched++;
  }

  for (const edge of edges) {
    enrichEdge(edge);
    edgesEnriched++;
  }

  // Обновление meta
  if (!graph.meta) graph.meta = {};
  graph.meta.temporal_enriched_at = new Date().toISOString();
  graph.meta.temporal_nodes = nodesEnriched;
  graph.meta.temporal_edges = edgesEnriched;

  return graph;
}

// ─────────────────────────────────────────────────────────────────────
//  CLI: обогатить существующий entity-graph.json без пересборки
// ─────────────────────────────────────────────────────────────────────

function isMainModule() {
  if (!process.argv[1]) return false;
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const invokedFile = path.resolve(process.argv[1]);
    return thisFile === invokedFile;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  const targetFile = process.argv[2] || GRAPH_FILE;
  if (!fs.existsSync(targetFile)) {
    console.error(`✗ File not found: ${targetFile}`);
    process.exit(1);
  }
  const graph = JSON.parse(fs.readFileSync(targetFile, 'utf-8'));
  enrichTemporal(graph);
  const bak = targetFile.replace(/\.json$/, '.pretemporal.bak.json');
  fs.copyFileSync(targetFile, bak);
  fs.writeFileSync(targetFile, JSON.stringify(graph, null, 2), 'utf-8');
  console.log(`✓ Enriched: ${targetFile}`);
  console.log(`  Backup:   ${bak}`);
  console.log(`  Nodes:    ${graph.meta.temporal_nodes}`);
  console.log(`  Edges:    ${graph.meta.temporal_edges}`);
  console.log(`  At:       ${graph.meta.temporal_enriched_at}`);
}
