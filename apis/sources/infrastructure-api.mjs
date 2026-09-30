/**
 * apis/sources/infrastructure-api.mjs — SERVICE-МОДУЛЬ: ИНФРАСТРУКТУРА
 *
 * КОНТРАКТ CRUCIX v2 (SERVICE).
 * ИСТОЧНИК: data/infrastructure/objects.json — { version, lastUpdated, objects: [{ id, name, type, layer, country, coordinates:{lat,lng}, status, capacity, unit, owner, operational, vulnerability, risks[], cascade[], sanctions }] }.
 * ДОПОЛНИТЕЛЬНЫЕ ИСТОЧНИКИ: data/basket/acled.json, earthquakes.json, firms.json, ofac.json, inflation.json, cargo.json.
 * ЗАВИСИМОСТИ: 12 подмодулей (graph-core, propagation, pagerank-critical, temporal, vulnerability-calc, monte-carlo, scenario-engine, military-monitor, chokepoint-monitor, nuclear-monitor, supply-chain, cargo-anomaly).
 *
 * ЭНДПОИНТЫ (внутренние, маппятся от route):
 *   GET  /                                   — сводка (все объекты + vulnerabilities)
 *   GET  /vulnerability                      — оценки уязвимости всех узлов
 *   GET  /cascade?node=&decay=&threshold=    — каскадный эффект от узла
 *   GET  /simulate?node=&runs=&threshold=    — Monte Carlo симуляция
 *   GET  /critical-paths?top=                — критические пути через PageRank
 *   GET  /pagerank?damping=&top=             — PageRank ранжирование
 *   GET  /sensitivity?runs=                  — чувствительность к параметрам
 *   GET  /featurecollection                  — GeoJSON FeatureCollection
 *   GET  /stats                              — сводная статистика
 *   GET  /military                           — военная концентрация
 *   GET  /chokepoints                        — чокпоинты
 *   GET  /nuclear                            — АЭС + риски
 *   GET  /supply-chain                       — анализ цепочек поставок
 *   GET  /cargo-anomalies?z=                 — аномалии грузов
 *   GET  /scenarios?run=&region=&runs=       — сценарии
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 */

import { InfrastructureGraph, haversine } from './infrastructure-graph-core.mjs';
import { CascadePropagation } from './infrastructure-propagation.mjs';
import { PageRankAnalyzer } from './infrastructure-pagerank-critical.mjs';
import { TemporalDecay } from './infrastructure-temporal.mjs';
import { VulnerabilityCalculator } from './infrastructure-vulnerability-calc.mjs';
import { MonteCarloSimulator } from './infrastructure-monte-carlo.mjs';
import { ScenarioEngine } from './infrastructure-scenario-engine.mjs';
import { MilitaryConcentration } from './infrastructure-military-monitor.mjs';
import { ChokepointMonitor } from './infrastructure-chokepoint-monitor.mjs';
import { NuclearFacilityMonitor } from './infrastructure-nuclear-monitor.mjs';
import { SupplyChainAnalysis } from './infrastructure-supply-chain.mjs';
import { CargoAnomalyDetector } from './infrastructure-cargo-anomaly.mjs';

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(PROJECT_ROOT, 'data');
const BASKET_DIR = join(DATA_DIR, 'basket');
const INFRA_FILE = join(DATA_DIR, 'infrastructure', 'objects.json');

// ============================================================
//  КОНТРАКТ
// ============================================================

export const route  = '/api/services/infrastructure';
export const method = 'GET';

export const meta = {
  service: true,
  description: 'Infrastructure analysis service: cascade, PageRank, Monte Carlo, chokepoints, nuclear, supply chain, cargo anomalies, scenarios. Based on data/infrastructure/objects.json (89 critical objects).',
  cache: 60,
  version: '2.0.0',
};

// ============================================================
//  ЗАГРУЗКА ДАННЫХ
// ============================================================

async function readJSON(path, fallback = null) {
  try { return JSON.parse(await fs.readFile(path, 'utf8')); }
  catch (e) {
    if (e.code === 'ENOENT') return fallback;
    throw e;
  }
}

async function loadBasket() {
  const [acled, earthquakes, firms, ofac, inflation] = await Promise.all([
    readJSON(join(BASKET_DIR, 'acled.json'), []),
    readJSON(join(BASKET_DIR, 'earthquakes.json'), []),
    readJSON(join(BASKET_DIR, 'firms.json'), []),
    readJSON(join(BASKET_DIR, 'ofac.json'), []),
    readJSON(join(BASKET_DIR, 'inflation.json'), null),
  ]);
  return {
    acled: acled?.events || acled || [],
    earthquakes: Array.isArray(earthquakes) ? earthquakes : (earthquakes?.features || []),
    fires: Array.isArray(firms) ? firms : (firms?.features || []),
    ofac: Array.isArray(ofac) ? ofac : (ofac?.data || []),
    inflation,
  };
}

async function loadInfrastructure() {
  const data = await readJSON(INFRA_FILE, null);
  if (!data) {
    const err = new Error('no_data');
    err.statusCode = 503;
    err.hint = 'data/infrastructure/objects.json отсутствует';
    throw err;
  }
  if (Array.isArray(data)) return { version: null, lastUpdated: null, objects: data };
  if (!data.objects) return { version: data.version, lastUpdated: data.lastUpdated, objects: [] };
  return data;
}

// ============================================================
//  ЯДРО АНАЛИЗА
// ============================================================

function buildGraph(infraData) {
  const graph = new InfrastructureGraph();
  graph.buildFromData(infraData);
  return graph;
}

function computeVulnerabilities(graph, basket) {
  const vulnCalc = new VulnerabilityCalculator();
  const nodes = graph.getAllNodes();
  const vulnScores = {};
  const vulnDetails = {};

  for (const node of nodes) {
    if (node.vulnerabilityNormalized != null) {
      const adaptive = vulnCalc.calculate(node, basket);
      vulnScores[node.id] = Math.min(node.vulnerabilityNormalized * 0.6 + adaptive.score * 0.4, 1);
      vulnDetails[node.id] = {
        base: node.vulnerabilityNormalized,
        adaptive: adaptive.score,
        combined: vulnScores[node.id],
        components: adaptive.components,
      };
    } else {
      const result = vulnCalc.calculate(node, basket);
      vulnScores[node.id] = result.score;
      vulnDetails[node.id] = result;
    }
  }
  return { vulnScores, vulnDetails, nodes };
}

// ============================================================
//  ЭНДПОИНТЫ
// ============================================================

async function epRoot(infraData, ctx) {
  const { vulnScores } = ctx;
  return {
    total: ctx.nodes.length,
    version: infraData.version || null,
    lastUpdated: infraData.lastUpdated || null,
    objects: ctx.nodes.map((n) => ({ ...n, calculatedVulnerability: vulnScores[n.id] || 0 })),
  };
}

async function epVulnerability(_infra, ctx) {
  const { vulnScores, vulnDetails, nodes } = ctx;
  const values = Object.values(vulnScores);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  return {
    total: nodes.length,
    scores: vulnScores,
    details: vulnDetails,
    summary: {
      mean,
      max: values.length ? Math.max(...values) : 0,
      min: values.length ? Math.min(...values) : 1,
    },
  };
}

async function epCascade(_infra, ctx, query) {
  const { graph, vulnScores, nodes } = ctx;
  const nodeId = query.node || nodes[0]?.id;
  if (!nodeId) { const e = new Error('no_nodes'); e.statusCode = 400; throw e; }
  const propagation = new CascadePropagation(graph);
  return propagation.assessImpact(nodeId, vulnScores, {
    decayFactor: parseFloat(query.decay) || 0.7,
    threshold: parseFloat(query.threshold) || 0.15,
  });
}

async function epSimulate(_infra, ctx, query) {
  const { graph, vulnScores } = ctx;
  const mc = new MonteCarloSimulator(graph);
  const opts = {
    runs: parseInt(query.runs, 10) || 1000,
    threshold: parseFloat(query.threshold) || 0.15,
    decayFactor: parseFloat(query.decay) || 0.7,
  };
  return query.node
    ? mc.simulateFromNode(query.node, vulnScores, opts)
    : mc.simulate(vulnScores, opts);
}

async function epCriticalPaths(_infra, ctx, query) {
  const pr = new PageRankAnalyzer(ctx.graph);
  const paths = pr.criticalPaths(ctx.vulnScores, parseInt(query.top, 10) || 5);
  return { paths, count: paths.length };
}

async function epPagerank(_infra, ctx, query) {
  const pr = new PageRankAnalyzer(ctx.graph);
  const scores = pr.compute({ damping: parseFloat(query.damping) || 0.85 });
  const critical = pr.identifyCriticalNodes(ctx.vulnScores, { topN: parseInt(query.top, 10) || 10 });
  return { pagerank: scores, criticalNodes: critical };
}

async function epSensitivity(_infra, ctx, query) {
  const mc = new MonteCarloSimulator(ctx.graph);
  const result = mc.sensitivityAnalysis(ctx.vulnScores, { runs: parseInt(query.runs, 10) || 200 });
  return { sensitivity: result };
}

async function epFeatureCollection(_infra, ctx) {
  const { nodes, vulnScores, vulnDetails } = ctx;
  const features = nodes.map((node) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [node.lng || 0, node.lat || 0] },
    properties: {
      id: node.id, name: node.name, type: node.type, layer: node.layer,
      country: node.country, status: node.status, operational: node.operational,
      vulnerability: vulnScores[node.id] || 0,
      baseVulnerability: node.vulnerability,
      risks: node.risks, sanctions: node.sanctions, capacity: node.capacity, unit: node.unit,
      components: vulnDetails[node.id]?.components || {},
    },
  }));
  return {
    type: 'FeatureCollection',
    features,
    metadata: { total: features.length, generated: new Date().toISOString() },
  };
}

async function epStats(infra, ctx, _query, basket) {
  const pr = new PageRankAnalyzer(ctx.graph);
  const prResult = pr.compute();
  const supplyChain = new SupplyChainAnalysis(ctx.graph);
  const values = Object.values(ctx.vulnScores);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const topEntry = Object.entries(ctx.vulnScores).sort((a, b) => b[1] - a[1])[0];
  return {
    graph: ctx.graph.size(),
    vulnerability: { mean, max: values.length ? Math.max(...values) : 0, maxNode: topEntry?.[0] },
    pagerank: { topNode: prResult.ranked?.[0]?.id, topScore: prResult.ranked?.[0]?.score },
    supplyChain: supplyChain.analyze().summary,
    basket: {
      acled: basket.acled.length,
      earthquakes: basket.earthquakes.length,
      fires: basket.fires.length,
      ofac: basket.ofac.length,
      inflation: basket.inflation?.features?.length || 0,
    },
    objects: { version: infra.version || null, lastUpdated: infra.lastUpdated || null },
  };
}

async function epMilitary(_infra, _ctx, _query, basket) {
  const monitor = new MilitaryConcentration();
  return monitor.analyze(basket.acled);
}

async function epChokepoints(_infra, ctx, _query, basket) {
  const monitor = new ChokepointMonitor();
  const result = monitor.analyze(basket.acled, ctx.graph);
  return { chokepoints: result, count: result.length };
}

async function epNuclear(_infra, _ctx, _query, basket) {
  const monitor = new NuclearFacilityMonitor();
  const result = monitor.analyze(basket.acled, basket.earthquakes);
  return { facilities: result, count: result.length };
}

async function epSupplyChain(_infra, ctx) {
  const analysis = new SupplyChainAnalysis(ctx.graph);
  return analysis.analyze();
}

async function epCargoAnomalies(_infra, _ctx, query) {
  const detector = new CargoAnomalyDetector({ zThreshold: parseFloat(query.z) || 2.5 });
  const cargoData = await readJSON(join(BASKET_DIR, 'cargo.json'), []);
  return detector.detect(cargoData);
}

async function epScenarios(_infra, ctx, query) {
  const engine = new ScenarioEngine(ctx.graph);
  if (query.run) {
    return engine.runScenario(query.run, ctx.vulnScores, {
      runs: parseInt(query.runs, 10) || 500,
      region: query.region,
    });
  }
  const list = engine.listScenarios();
  return { scenarios: list, count: list.length };
}

const ENDPOINTS = {
  '':                epRoot,
  '/':               epRoot,
  '/vulnerability':  epVulnerability,
  '/cascade':        epCascade,
  '/simulate':       epSimulate,
  '/critical-paths': epCriticalPaths,
  '/pagerank':       epPagerank,
  '/sensitivity':    epSensitivity,
  '/featurecollection': epFeatureCollection,
  '/stats':          epStats,
  '/military':       epMilitary,
  '/chokepoints':    epChokepoints,
  '/nuclear':        epNuclear,
  '/supply-chain':   epSupplyChain,
  '/cargo-anomalies':epCargoAnomalies,
  '/scenarios':      epScenarios,
};

// ============================================================
//  ФОРМАТЫ ОТВЕТА
// ============================================================

function toCSV(data) {
  if (!data || typeof data !== 'object') return null;
  const arr = Array.isArray(data) ? data
    : Array.isArray(data.objects) ? data.objects
    : Array.isArray(data.features) ? data.features.map(f => ({ ...f.properties, lat: f.geometry?.coordinates?.[1], lng: f.geometry?.coordinates?.[0] }))
    : Array.isArray(data.facilities) ? data.facilities
    : Array.isArray(data.chokepoints) ? data.chokepoints
    : null;
  if (!arr || arr.length === 0) return '';
  const keys = new Set();
  for (const row of arr) Object.keys(row || {}).forEach(k => keys.add(k));
  const cols = [...keys];
  const esc = (v) => {
    if (v == null) return '';
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const header = cols.join(',');
  const body = arr.map(row => cols.map(c => esc(row[c])).join(',')).join('\n');
  return header + '\n' + body + '\n';
}

function sendJSON(res, status, payload, extra = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
    ...extra,
  });
  res.end(body);
}

function sendText(res, status, text, ct = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': ct, 'Content-Length': String(Buffer.byteLength(text)) });
  res.end(text);
}

// ============================================================
//  HANDLER
// ============================================================

export async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const query = Object.fromEntries(url.searchParams.entries());
  const format = (query.format || 'json').toLowerCase();

  // Отрезаем префикс route, оставляем только под-путь внутри сервиса
  const subPath = url.pathname.replace(/^\/api\/services\/infrastructure/, '') || '/';

  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    const infraData = await loadInfrastructure();
    const basket = await loadBasket();
    const graph = buildGraph(infraData);
    const { vulnScores, vulnDetails, nodes } = computeVulnerabilities(graph, basket);
    const ctx = { graph, vulnScores, vulnDetails, nodes };

    const ep = ENDPOINTS[subPath];
    if (!ep) {
      return sendJSON(res, 404, {
        error: 'endpoint_not_found',
        path: url.pathname,
        available: Object.keys(ENDPOINTS).filter(k => k && k !== '/'),
      });
    }

    const result = await ep(infraData, ctx, query, basket);

    const extra = {
      'X-Service': 'infrastructure',
      'X-Service-Version': meta.version,
      'Cache-Control': `public, max-age=${meta.cache}`,
    };

    if (format === 'csv') {
      const csv = toCSV(result);
      if (csv === null) return sendJSON(res, 400, { error: 'csv_not_supported_for_endpoint', endpoint: subPath }, extra);
      return sendText(res, 200, csv, 'text/csv; charset=utf-8');
    }
    if (format === 'stats') {
      return sendJSON(res, 200, { stats: await epStats(infraData, ctx, {}, basket) }, extra);
    }
    if (format === 'raw') {
      return sendJSON(res, 200, { data: result }, extra);
    }

    // json (по умолчанию)
    return sendJSON(res, 200, {
      service: 'infrastructure',
      endpoint: subPath,
      meta: {
        version: meta.version,
        generated_at: new Date().toISOString(),
        objects_total: nodes.length,
        objects_version: infraData.version || null,
        objects_lastUpdated: infraData.lastUpdated || null,
      },
      data: result,
    }, extra);

  } catch (e) {
    const status = e.statusCode || 500;
    const payload = {
      error: status === 503 ? 'no_data' : 'service_error',
      message: e.message,
      endpoint: url.pathname,
    };
    if (e.hint) payload.hint = e.hint;
    try { sendJSON(res, status, payload); } catch {}
  }
}
