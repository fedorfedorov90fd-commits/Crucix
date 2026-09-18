// apis/predict/sources/cascade.mjs
// Источник каскадных цепочек для прогностического ядра Crucix.
//
// Назначение:
//   32-й источник. Данные о каскадных эффектах в критической инфраструктуре,
//   supply chain, цепочках поставок энергоносителей, финансовых contagion.
//   Используется для моделирования domino effects в прогностическом ядре.
//
// Источники данных:
//   - World Bank WGI (Worldwide Governance Indicators) — supply chain risk
//   - UN Comtrade — торговые потоки
//   - EIA — энергетические зависимости
//   - Официальные релизы центральных банков — финансовый contagion
//
// Ключевые сигналы:
//   - Нарушение supply chain (задержки, блокировки портов, перекрытие проливов)
//   - Зависимости между странами по критичным товарам (редкоземельные, чипы, нефть)
//   - Каскадные эффекты в финансах (ликвидность, credit spreads)
//
// Экспортирует:
//   - fetchCascadeData() — главная функция получения данных
//   - buildCascadeGraph() — построение графа каскадов
//   - computeDominoScore() — оценка domino-эффекта для события
//   - CASCADE_TYPES — типы каскадов
//
// Версия: 1.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..', '..', '..');
const BASKET_DIR = join(PROJECT_ROOT, 'data', 'basket');
const RUNS_DIR = join(PROJECT_ROOT, 'runs', 'predictions');

// --- ТИПЫ КАСКАДОВ --------------------------------

export const CASCADE_TYPES = {
  supply_chain: {
    name: 'Supply Chain',
    description: 'Нарушения в цепочках поставок (порты, проливы, ж/д)',
    weight: 0.25,
    signals: ['port_blockade', 'canal_closure', 'rail_disruption', 'chip_shortage'],
  },
  energy: {
    name: 'Energy Dependency',
    description: 'Зависимости по нефти, газу, электричеству',
    weight: 0.30,
    signals: ['pipeline_shutdown', 'lng_shortage', 'grid_failure', 'refinery_outage'],
  },
  financial: {
    name: 'Financial Contagion',
    description: 'Распространение финансового стресса',
    weight: 0.25,
    signals: ['credit_spread_widening', 'liquidity_crunch', 'bank_run', 'currency_crisis'],
  },
  critical_infrastructure: {
    name: 'Critical Infrastructure',
    description: 'Каскады в критической инфраструктуре',
    weight: 0.20,
    signals: ['submarine_cable_cut', 'satellite_disruption', 'dns_attack', 'gps_jamming'],
  },
};

// --- КОНФИГУРАЦИЯ ИСТОЧНИКОВ ----------------------

const SOURCES = {
  worldbank_wgi: {
    name: 'World Bank WGI',
    apiUrl: 'https://api.worldbank.org/v2/country',
    freeAccess: true,
    authRequired: false,
  },
  un_comtrade: {
    name: 'UN Comtrade',
    apiUrl: 'https://comtradeapi.un.org/public/v1',
    freeAccess: true,
    authRequired: false,
  },
  eia: {
    name: 'US Energy Information Administration',
    apiUrl: 'https://api.eia.gov/v2',
    freeAccess: true,
    authRequired: true,
  },
};

// --- FETCH-ФУНКЦИИ --------------------------------

/**
 * Получение данных о торговых потоках UN Comtrade.
 * @param {string} reporter — код страны-отправителя (например, '156' — Китай)
 * @param {string} partner — код страны-получателя (например, '842' — США)
 * @param {string} commodity — код товара HS (например, '8542' — чипы)
 * @returns {Promise<Object[]>} массив торговых потоков
 */
export async function fetchComtradeFlows(reporter = '156', partner = '842', commodity = '8542') {
  try {
    const url = `${SOURCES.un_comtrade.apiUrl}/preview/C/A/HS?reporterCode=${reporter}&partnerCode=${partner}&cmdCode=${commodity}&period=2024`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Comtrade API: ${response.status}`);

    const data = await response.json();
    const rows = Array.isArray(data.data) ? data.data : [];

    return rows.map(r => ({
      reporter: r.reporterDesc,
      partner: r.partnerDesc,
      commodity: r.cmdDesc,
      value: parseFloat(r.primaryValue || 0),
      year: r.period,
      flow: r.flowDesc,
    }));
  } catch (e) {
    console.error('[cascade] Comtrade error:', e.message);
    return [];
  }
}

/**
 * Получение данных о governance indicators World Bank.
 * @param {string} country — ISO-код страны (например, 'RUS')
 * @returns {Promise<Object>} индикаторы управления
 */
export async function fetchWorldBankGovernance(country = 'RUS') {
  try {
    const indicators = [
      'GE.EST', // Government Effectiveness
      'RQ.EST', // Regulatory Quality
      'RL.EST', // Rule of Law
      'CC.EST', // Control of Corruption
    ];
    const results = {};
    for (const ind of indicators) {
      const url = `${SOURCES.worldbank_wgi.apiUrl}/${country}/indicator/${ind}?format=json&date=2020:2024`;
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = await response.json();
      const values = Array.isArray(data[1]) ? data[1] : [];
      results[ind] = values.map(v => ({ year: v.date, value: v.value }));
    }
    return results;
  } catch (e) {
    console.error('[cascade] World Bank governance error:', e.message);
    return {};
  }
}

// --- АНАЛИЗ ---------------------------------------

/**
 * Построение графа каскадов из данных корзины.
 * @param {Object} basketData — данные из data/basket/*.json
 * @returns {Object} граф каскадов с узлами и рёбрами
 */
export function buildCascadeGraph(basketData = {}) {
  const nodes = new Map();
  const edges = [];

  // Узлы — страны/регионы/секторы
  for (const [type, config] of Object.entries(CASCADE_TYPES)) {
    for (const signal of config.signals) {
      if (basketData[signal]) {
        nodes.set(signal, {
          id: signal,
          type,
          weight: config.weight,
          severity: basketData[signal].severity || 0,
          timestamp: basketData[signal].timestamp || new Date().toISOString(),
        });
      }
    }
  }

  // Рёбра — зависимости между сигналами
  const dependencies = [
    { from: 'pipeline_shutdown', to: 'lng_shortage', weight: 0.8 },
    { from: 'port_blockade', to: 'chip_shortage', weight: 0.6 },
    { from: 'credit_spread_widening', to: 'liquidity_crunch', weight: 0.7 },
    { from: 'submarine_cable_cut', to: 'dns_attack', weight: 0.5 },
    { from: 'gps_jamming', to: 'satellite_disruption', weight: 0.6 },
  ];

  for (const dep of dependencies) {
    if (nodes.has(dep.from) && nodes.has(dep.to)) {
      edges.push({
        from: dep.from,
        to: dep.to,
        weight: dep.weight,
        cascadeType: CASCADE_TYPES[nodes.get(dep.from).type]?.name || 'unknown',
      });
    }
  }

  return {
    nodes: Array.from(nodes.values()),
    edges,
    summary: {
      totalNodes: nodes.size,
      totalEdges: edges.length,
      byType: Object.fromEntries(
        Object.keys(CASCADE_TYPES).map(t => [
          t,
          Array.from(nodes.values()).filter(n => n.type === t).length,
        ])
      ),
    },
  };
}

/**
 * Оценка domino-эффекта для события.
 * @param {Object} event — событие с полями type, severity, region
 * @param {Object} graph — граф каскадов
 * @returns {Object} оценка с распространением по цепочке
 */
export function computeDominoScore(event, graph) {
  if (!event || !event.type) return { score: 0, chain: [] };

  const config = CASCADE_TYPES[event.type];
  if (!config) return { score: 0, chain: [] };

  const chain = [];
  let currentScore = event.severity || 0.5;
  let visited = new Set([event.type]);

  // BFS по цепочке каскадов
  const queue = [{ node: event.type, score: currentScore, depth: 0 }];
  while (queue.length > 0 && chain.length < 10) {
    const { node, score, depth } = queue.shift();
    if (depth > 3) continue;

    const outgoing = graph.edges.filter(e => e.from === node || e.to === node);
    for (const edge of outgoing) {
      const nextNode = edge.from === node ? edge.to : edge.from;
      if (visited.has(nextNode)) continue;
      visited.add(nextNode);

      const nextScore = score * edge.weight * config.weight;
      chain.push({
        node: nextNode,
        score: nextScore,
        depth: depth + 1,
        cascadeType: edge.cascadeType,
      });

      if (nextScore > 0.1) {
        queue.push({ node: nextNode, score: nextScore, depth: depth + 1 });
      }
    }
  }

  const finalScore = chain.reduce((acc, c) => acc + c.score, currentScore);
  return {
    score: Math.min(1.0, finalScore),
    chain: chain.sort((a, b) => b.score - a.score),
    depth: Math.max(...chain.map(c => c.depth), 0),
  };
}

/**
 * Главная функция — получить данные о каскадах и сохранить в runs/predictions/.
 * @param {Object} basketData — данные корзины
 * @returns {Promise<Object>} результат с графом и анализом
 */
export async function fetchCascadeData(basketData = null) {
  const result = {
    timestamp: new Date().toISOString(),
    source: 'cascade',
    version: '1.0.0',
    graph: null,
    dominoScores: [],
    alerts: [],
  };

  try {
    // Загружаем данные корзины если не переданы
    if (!basketData) {
      const basketFile = join(BASKET_DIR, 'latest.json');
      if (existsSync(basketFile)) {
        basketData = JSON.parse(readFileSync(basketFile, 'utf-8'));
      } else {
        basketData = {};
      }
    }

    // Строим граф
    result.graph = buildCascadeGraph(basketData);

    // Оцениваем domino для каждого узла
    for (const node of result.graph.nodes) {
      const domino = computeDominoScore({ type: node.type, severity: node.severity }, result.graph);
      if (domino.score > 0.3) {
        result.dominoScores.push({ node: node.id, ...domino });
        result.alerts.push({
          severity: domino.score > 0.7 ? 'high' : 'medium',
          message: `Каскадный эффект ${node.id}: оценка ${domino.score.toFixed(2)}`,
          chain: domino.chain.slice(0, 3),
        });
      }
    }

    // Сохраняем результат
    mkdirSync(RUNS_DIR, { recursive: true });
    writeFileSync(
      join(RUNS_DIR, 'cascade_latest.json'),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    result.error = e.message;
    console.error('[cascade] fetchCascadeData error:', e.message);
  }

  return result;
}

export { SOURCES };

export default fetchCascadeData;
