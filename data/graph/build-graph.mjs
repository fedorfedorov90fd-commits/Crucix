#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
//  build-graph.mjs — Knowledge Graph Builder (orchestrator)
//  Crucix / data/graph/  ·  v4.1  (temporal-aware)
//
//  Тонкий оркестратор: читает basket → вызывает EntityResolutionEngine →
//  обогащает temporal → пишет три выходных файла.
//
//  GRAPH_SOURCES: 'structured' (default) | 'all'
//  SCORING_MODE:  'weighted' (default) | 'fellegi-sunter'
// ═══════════════════════════════════════════════════════════════════════

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EntityResolutionEngine,
  nowISO,
  round4,
} from './entity-resolution.mjs';
import { enrichTemporal } from './temporal-enricher.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASKET_DIR = path.join(ROOT, 'data', 'basket');

const GRAPH_SOURCES = process.env.GRAPH_SOURCES || 'structured';
const SCORING_MODE = process.env.SCORING_MODE || 'weighted';

// ─────────────────────────────────────────────────────────────────────
//  ЭКСТРАКТОРЫ
// ─────────────────────────────────────────────────────────────────────

const EXTRACTORS = {
  acled: {
    entityFields: [
      { source: 'actor1',     type: 'Actor',    role: 'source' },
      { source: 'actor2',     type: 'Actor',    role: 'target' },
      { source: 'country',    type: 'Location', role: 'country' },
      { source: 'region',     type: 'Location', role: 'region' },
      { source: 'location',   type: 'Location', role: 'city' },
      { source: 'event_type', type: 'Event',    role: 'event_type' },
    ],
    edgeFromItem: (item) => {
      const e = [];
      if (item.actor1 && item.actor2)
        e.push({ s: 'actor1', t: 'actor2', type: 'conflicted_with' });
      if (item.actor1 && item.location)
        e.push({ s: 'actor1', t: 'location', type: 'located_in' });
      if (item.actor2 && item.location)
        e.push({ s: 'actor2', t: 'location', type: 'located_in' });
      if (item.actor1 && item.event_type)
        e.push({ s: 'actor1', t: 'event_type', type: 'involved_in' });
      if (item.actor2 && item.event_type)
        e.push({ s: 'actor2', t: 'event_type', type: 'involved_in' });
      if (item.actor1 && item.country)
        e.push({ s: 'actor1', t: 'country', type: 'based_in' });
      if (item.actor2 && item.country)
        e.push({ s: 'actor2', t: 'country', type: 'based_in' });
      if (item.location && item.country)
        e.push({ s: 'location', t: 'country', type: 'part_of' });
      if (item.region && item.country)
        e.push({ s: 'region', t: 'country', type: 'part_of' });
      return e;
    },
    propertiesFromItem: (item) => {
      const p = {};
      if (item.country) p.country = item.country;
      if (item.region) p.region = item.region;
      if (item.fatalities != null) p.fatalities = item.fatalities;
      if (item.lat != null) p.lat = item.lat;
      if (item.lon != null) p.lon = item.lon;
      if (item.lng != null && p.lon == null) p.lon = item.lng;
      if (item.event_date) p.event_date = item.event_date;
      if (item.timestamp) p.timestamp = item.timestamp;
      return p;
    },
  },

  gdelt: {
    entityFields: [
      { source: '_gdelt.sourcecountry', type: 'Location',     role: 'source_country' },
      { source: '_gdelt.domain',        type: 'Organization', role: 'domain' },
      { source: 'source',               type: 'Organization', role: 'publisher' },
      { source: 'category',             type: 'Event',        role: 'category' },
      { source: 'country',              type: 'Location',     role: 'country' },
      { source: 'region',               type: 'Location',     role: 'region' },
    ],
    edgeFromItem: (item) => {
      const e = [];
      if (item.source && item._gdelt && item._gdelt.sourcecountry)
        e.push({ s: 'source', t: '_gdelt.sourcecountry', type: 'publishes_in' });
      if (item._gdelt && item._gdelt.domain && item._gdelt.sourcecountry)
        e.push({ s: '_gdelt.domain', t: '_gdelt.sourcecountry', type: 'publishes_in' });
      if (item.source && item.country)
        e.push({ s: 'source', t: 'country', type: 'publishes_in' });
      return e;
    },
    propertiesFromItem: (item) => {
      const p = {};
      if (item._gdelt && item._gdelt.language) p.language = item._gdelt.language;
      if (item.lat != null) p.lat = item.lat;
      if (item.lon != null) p.lon = item.lon;
      if (item.lng != null && p.lon == null) p.lon = item.lng;
      if (item.timestamp) p.timestamp = item.timestamp;
      return p;
    },
  },

  'ofac-sdn': {
    entityFields: [
      { source: 'region', type: 'Location', role: 'country_code' },
    ],
    edgeFromItem: () => [],
    propertiesFromItem: (item) => {
      const p = {};
      if (item.value != null) p.sanction_count = item.value;
      if (item.count != null) p.record_count = item.count;
      return p;
    },
  },

  satellite: {
    entityFields: [
      { source: 'label',         type: 'Asset',    role: 'satellite' },
      { source: 'name',          type: 'Asset',    role: 'satellite' },
      { source: 'location_name', type: 'Location', role: 'area' },
      { source: 'coordinates',   type: 'Location', role: 'coords' },
    ],
    edgeFromItem: (item) => {
      const e = [];
      if (item.label && (item.lat != null) && (item.lon != null || item.lng != null))
        e.push({ s: 'label', t: '_coords', type: 'has_coordinates' });
      if (item.name && (item.lat != null) && (item.lon != null || item.lng != null))
        e.push({ s: 'name', t: '_coords', type: 'has_coordinates' });
      return e;
    },
    propertiesFromItem: (item) => {
      const p = {};
      if (item.lat != null) p.lat = item.lat;
      if (item.lon != null) p.lon = item.lon;
      if (item.lng != null) p.lng = item.lng;
      if (item.resolution) p.resolution = item.resolution;
      if (item.timestamp) p.timestamp = item.timestamp;
      if (item.date) p.date = item.date;
      return p;
    },
  },

  universal: {
    entityFields: null,
    edgeFromItem: null,
    propertiesFromItem: () => ({}),
  },
};

const STRUCTURED_KEYS = ['gdelt', 'acled', 'ofac-sdn', 'satellite'];

// ─────────────────────────────────────────────────────────────────────
//  ЗАГРУЗЧИК МАССИВОВ — распознавание 5 форматов
// ─────────────────────────────────────────────────────────────────────

const ARRAY_KEYS = [
  'items', 'data', 'records', 'events', 'articles',
  'points', 'regions', 'results', 'entries',
];

function extractItems(raw) {
  if (Array.isArray(raw)) return raw;

  if (raw && typeof raw === 'object') {
    const objKeys = Object.keys(raw);
    if (objKeys.length > 0 && objKeys.every(k => /^\d+$/.test(k))) {
      return objKeys
        .sort((a, b) => Number(a) - Number(b))
        .map(k => raw[k]);
    }

    for (const key of ARRAY_KEYS) {
      if (Array.isArray(raw[key]) && raw[key].length > 0) return raw[key];
    }

    if (raw.schema && String(raw.schema).includes('crucix.basket')) {
      const combined = [];
      if (Array.isArray(raw.points)) {
        for (const p of raw.points) {
          combined.push({ ...p, _source_array: 'points' });
        }
      }
      if (Array.isArray(raw.regions)) {
        for (const r of raw.regions) {
          combined.push({ ...r, _source_array: 'regions' });
        }
      }
      if (combined.length > 0) return combined;
    }

    return [raw];
  }

  return [];
}

// ─────────────────────────────────────────────────────────────────────
//  УТИЛИТЫ
// ─────────────────────────────────────────────────────────────────────

function getExtractorForFile(filename) {
  const base = path.basename(filename, '.json').toLowerCase();
  for (const key of Object.keys(EXTRACTORS)) {
    if (key === 'universal') continue;
    if (base.startsWith(key) || base.includes(key))
      return { name: key, config: EXTRACTORS[key] };
  }
  return { name: 'universal', config: EXTRACTORS.universal };
}

function isStructuredFile(filename) {
  const base = path.basename(filename, '.json').toLowerCase();
  return STRUCTURED_KEYS.some(k => base.startsWith(k) || base.includes(k));
}

function getNestedValue(obj, dotPath) {
  if (!dotPath.includes('.')) return obj[dotPath];
  return dotPath.split('.').reduce((acc, key) => acc && acc[key], obj);
}

function autoDetectEntityFields(item) {
  const fields = [];
  const typeMap = [
    ['actor', 'Actor'], ['name', 'Actor'], ['person', 'Actor'], ['author', 'Actor'],
    ['country', 'Location'], ['city', 'Location'], ['location', 'Location'],
    ['region', 'Location'], ['address', 'Location'],
    ['organization', 'Organization'], ['org', 'Organization'], ['company', 'Organization'],
    ['event', 'Event'], ['event_type', 'Event'], ['action', 'Event'],
    ['asset', 'Asset'], ['object', 'Asset'], ['satellite', 'Asset'],
    ['document', 'Document'], ['url', 'Document'], ['source', 'Document'], ['title', 'Document'],
  ];
  const seen = new Set();
  for (const [pattern, type] of typeMap) {
    for (const key of Object.keys(item)) {
      const lk = key.toLowerCase();
      if ((lk === pattern || lk.includes(pattern)) && !seen.has(key)) {
        const val = item[key];
        if (val && typeof val === 'string' && val.trim().length > 1) {
          fields.push({ source: key, type, role: lk });
          seen.add(key);
        }
        break;
      }
    }
  }
  return fields;
}

function autoDetectEdges(item, entityFields) {
  const edges = [];
  const extracted = entityFields.filter(f => {
    const v = getNestedValue(item, f.source);
    return v && typeof v === 'string';
  });
  for (let i = 0; i < extracted.length; i++) {
    for (let j = i + 1; j < extracted.length; j++) {
      edges.push({
        s: extracted[i].source,
        t: extracted[j].source,
        type: 'co_occurs_in',
      });
    }
  }
  return edges;
}

// ─────────────────────────────────────────────────────────────────────
//  MAIN
// ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══ Crucix Knowledge Graph Builder (v4.1 temporal-aware) ═══\n');
  console.log(`  GRAPH_SOURCES:  ${GRAPH_SOURCES}`);
  console.log(`  SCORING_MODE:   ${SCORING_MODE}\n`);

  if (!fs.existsSync(BASKET_DIR)) {
    console.error(`✗ Basket directory not found: ${BASKET_DIR}`);
    process.exit(1);
  }

  let basketFiles = fs.readdirSync(BASKET_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => path.join(BASKET_DIR, f));

  if (GRAPH_SOURCES === 'structured') {
    basketFiles = basketFiles.filter(f => isStructuredFile(f));
  }

  if (basketFiles.length === 0) {
    console.error(`✗ No JSON files in data/basket/ (mode: ${GRAPH_SOURCES})`);
    process.exit(1);
  }

  console.log(`Found ${basketFiles.length} basket file(s) [mode: ${GRAPH_SOURCES}]:`);
  basketFiles.forEach(f => console.log(`  • ${path.basename(f)}`));
  console.log();

  const engine = new EntityResolutionEngine({ scoringMode: SCORING_MODE });
  let totalItems = 0;

  for (const filePath of basketFiles) {
    const filename = path.basename(filePath);
    const extractor = getExtractorForFile(filename);
    console.log(`Processing ${filename} (extractor: ${extractor.name})...`);

    let raw;
    try {
      raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
      console.warn(`  ⚠ Skipping (invalid JSON): ${e.message}`);
      continue;
    }

    const items = extractItems(raw);

    let fileEntities = 0, fileEdges = 0;

    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      totalItems++;

      let entityFields = extractor.config.entityFields;
      if (!entityFields) entityFields = autoDetectEntityFields(item);

      const itemProperties = extractor.config.propertiesFromItem(item);
      const itemEntityResults = {};

      for (const field of entityFields) {
        const val = getNestedValue(item, field.source);
        if (!val || typeof val !== 'string') continue;
        const result = engine.resolveEntity(field.type, val, filename, itemProperties);
        if (result && result.id) {
          itemEntityResults[field.source] = result;
          const node = engine.nodes.get(result.id);
          if (field.role) {
            if (!node.properties.roles) node.properties.roles = [];
            if (!node.properties.roles.includes(field.role)) {
              node.properties.roles.push(field.role);
            }
          }
          fileEntities++;
        }
      }

      // Спец-обработка координат для satellite (поддержка lon и lng)
      if (extractor.name === 'satellite') {
        const lonVal = item.lon != null ? item.lon : item.lng;
        if (item.lat != null && lonVal != null) {
          const coordsLabel = `${item.lat},${lonVal}`;
          const coordsResult = engine.resolveEntity('Location', coordsLabel, filename, itemProperties);
          if (coordsResult && coordsResult.id) {
            itemEntityResults['_coords'] = coordsResult;
            fileEntities++;
          }
        }
      }

      let edgeDefs = extractor.config.edgeFromItem
        ? extractor.config.edgeFromItem(item)
        : null;
      if (!edgeDefs) edgeDefs = autoDetectEdges(item, entityFields);

      for (const edge of edgeDefs) {
        const sRes = itemEntityResults[edge.s];
        const tRes = itemEntityResults[edge.t];
        if (sRes && tRes && sRes.id && tRes.id) {
          const confidence = Math.min(sRes.score, tRes.score);
          const provenance = {
            source_file: filePath,
            collector: filename.replace('.json', ''),
            fetched_at: item.fetched_at || item.timestamp || item.date || item.event_date || nowISO(),
            confidence: round4(confidence),
            source_action: sRes.action,
            target_action: tRes.action,
          };
          engine.addEdge(sRes.id, tRes.id, edge.type, provenance);
          fileEdges++;
        }
      }
    }

    console.log(`  → ${items.length} items, ${fileEntities} entities, ${fileEdges} edges`);
  }

  console.log('\n── Writing output ──');

  const entityGraph = engine.toJSON();
  const entityResolution = engine.resolutionToJSON();
  const provenance = engine.provenanceToJSON();

  // ─── Temporal Enrichment ───
  enrichTemporal(entityGraph);
  console.log(`  Temporal: ${entityGraph.meta.temporal_nodes} nodes, ${entityGraph.meta.temporal_edges} edges enriched`);

  const graphPath = path.join(__dirname, 'entity-graph.json');
  const resPath = path.join(__dirname, 'entity-resolution.json');
  const provPath = path.join(__dirname, 'provenance.json');

  for (const f of [graphPath, resPath, provPath]) {
    if (fs.existsSync(f)) {
      const bak = f.replace('.json', '.bak.json');
      fs.copyFileSync(f, bak);
      console.log(`  Backup: ${path.basename(bak)}`);
    }
  }

  fs.writeFileSync(graphPath, JSON.stringify(entityGraph, null, 2), 'utf-8');
  fs.writeFileSync(resPath, JSON.stringify(entityResolution, null, 2), 'utf-8');
  fs.writeFileSync(provPath, JSON.stringify(provenance, null, 2), 'utf-8');

  console.log('\n═══ Summary ═══');
  console.log(`  Items processed:    ${totalItems}`);
  console.log(`  Unique entities:    ${entityGraph.meta.node_count}`);
  console.log(`  Edges:              ${entityGraph.meta.edge_count}`);
  console.log(`  Provenance records: ${provenance.meta.total_provenance_records}`);
  console.log(`  Resolution actions: ${entityResolution.meta.total_resolutions}`);
  console.log(`    Exact matches:    ${entityResolution.meta.exact_matches}`);
  console.log(`    Auto-merges:      ${entityResolution.meta.auto_merges}`);
  console.log(`    Reviews:          ${entityResolution.meta.reviews}`);
  console.log(`    New entities:     ${entityResolution.meta.new_entities}`);
  console.log(`  Review queue:       ${entityResolution.meta.review_queue_size}`);
  console.log(`  Types:`);
  for (const [type, count] of Object.entries(entityGraph.meta.types)) {
    console.log(`    ${type}: ${count}`);
  }
  console.log('\nOutput:');
  console.log(`  ${graphPath}`);
  console.log(`  ${resPath}`);
  console.log(`  ${provPath}`);
  console.log('\n✓ Done.');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
