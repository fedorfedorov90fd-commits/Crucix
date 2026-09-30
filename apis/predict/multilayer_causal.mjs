// apis/predict/multilayer_causal.mjs
// Слой 2: Multi-Layer Causal DAG — единый причинный граф через четыре слоя реальности.
//
// Четыре слоя:
//   CYBER    — кибератаки, утечки, ransomware, взлом инфраструктуры, DDoS.
//   INFO     — дезинформация, смена нарратива, пропаганда, паника, медиаблокировка.
//   FINANCE  — VIX, обвал рынка, санкции, валютный кризис, отток капитала, кредит.
//   PHYSICAL — спутниковые аномалии, морское движение, наращивание, эскалация,
//              радиация, повреждение инфраструктуры.
//
// Возможности:
//   1. Кросс-слойные связи (инфраструктура → рынок, дезинформация → паника).
//   2. Bayesian propagation — распространение вероятностей по графу на глубину 3-5.
//   3. Do-intervention — «что если установить X = 0.8?» и увидеть каскад по слоям.
//   4. Рекурсивный counterfactual — цепочки «A → B → C → D».
//   5. Cross-layer influence — оценка «заражения» между слоями.
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких дефолтных экспортов.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'multilayer_causal',
  name: 'Многослойный причинный граф (Multi-Layer Causal DAG)',
  layer: 2,
  category: 'causal',
  description: 'Единый причинный граф через четыре слоя реальности: кибер, информация, финансы, физический. Кросс-слойные связи, do-intervention, рекурсивный counterfactual.',
  version: '2.0.0',
  depends: [],
  exports: [
    'LAYERS',
    'NODE_DEFINITIONS',
    'CAUSAL_EDGES',
    'MultiLayerCausalGraph',
    'crucixMultiLayerCausal',
  ],
};

// ─── КОНФИГУРАЦИЯ СЛОЁВ ─────────────────────────────────────────

export const LAYERS = {
  CYBER: 'cyber',
  INFO: 'info',
  FINANCE: 'finance',
  PHYSICAL: 'physical',
};

// ─── УЗЛЫ ПО СЛОЯМ ─────────────────────────────────────────────

export const NODE_DEFINITIONS = {
  // Слой 1: Кибер
  cyberAttack:          { layer: LAYERS.CYBER,    name: 'Кибератака',              category: 'event' },
  dataLeak:             { layer: LAYERS.CYBER,    name: 'Утечка данных',           category: 'event' },
  ransomwareWave:       { layer: LAYERS.CYBER,    name: 'Волна ransomware',        category: 'event' },
  infrastructureBreach: { layer: LAYERS.CYBER,    name: 'Взлом инфраструктуры',    category: 'event' },
  ddosCampaign:         { layer: LAYERS.CYBER,    name: 'DDoS-кампания',           category: 'event' },

  // Слой 2: Информация
  disinformation:       { layer: LAYERS.INFO,     name: 'Дезинформация',           category: 'event' },
  narrativeShift:       { layer: LAYERS.INFO,     name: 'Смена нарратива',         category: 'event' },
  propagandaSpike:      { layer: LAYERS.INFO,     name: 'Всплеск пропаганды',      category: 'event' },
  mediaBlackout:        { layer: LAYERS.INFO,     name: 'Медиаблокировка',         category: 'event' },
  panicSelling:         { layer: LAYERS.INFO,     name: 'Панические настроения',   category: 'state' },

  // Слой 3: Финансы
  vixSpike:             { layer: LAYERS.FINANCE,  name: 'Скачок VIX',              category: 'market' },
  marketCrash:          { layer: LAYERS.FINANCE,  name: 'Обвал рынка',             category: 'market' },
  sanctionsExpansion:   { layer: LAYERS.FINANCE,  name: 'Расширение санкций',      category: 'policy' },
  currencyCrisis:       { layer: LAYERS.FINANCE,  name: 'Валютный кризис',         category: 'market' },
  capitalFlight:        { layer: LAYERS.FINANCE,  name: 'Отток капитала',          category: 'market' },
  creditFreeze:         { layer: LAYERS.FINANCE,  name: 'Кредитное сжатие',        category: 'market' },

  // Слой 4: Физический
  satelliteAnomaly:     { layer: LAYERS.PHYSICAL, name: 'Спутниковая аномалия',    category: 'observation' },
  navalMovement:        { layer: LAYERS.PHYSICAL, name: 'Морское движение',        category: 'observation' },
  militaryBuildUp:      { layer: LAYERS.PHYSICAL, name: 'Военное наращивание',     category: 'observation' },
  conflictEscalation:   { layer: LAYERS.PHYSICAL, name: 'Эскалация конфликта',     category: 'event' },
  radiationAnomaly:     { layer: LAYERS.PHYSICAL, name: 'Радиационная аномалия',   category: 'observation' },
  infrastructureDamage: { layer: LAYERS.PHYSICAL, name: 'Повреждение инфраструктуры', category: 'event' },
};

// ─── КРОСС-СЛОЙНЫЕ СВЯЗИ ────────────────────────────────────────

export const CAUSAL_EDGES = [
  // Кибер → Финансы
  { from: 'cyberAttack',          to: 'vixSpike',             strength: 1.5, lagHours: 2,   crossLayer: true,  description: 'Кибератака → рост волатильности' },
  { from: 'infrastructureBreach', to: 'marketCrash',          strength: 2.2, lagHours: 6,   crossLayer: true,  description: 'Взлом инфраструктуры → обвал' },
  { from: 'ransomwareWave',       to: 'creditFreeze',         strength: 1.8, lagHours: 12,  crossLayer: true,  description: 'Ransomware → кредитное сжатие' },
  { from: 'dataLeak',             to: 'capitalFlight',        strength: 1.4, lagHours: 24,  crossLayer: true,  description: 'Утечка → отток капитала' },

  // Кибер → Информация
  { from: 'cyberAttack',          to: 'disinformation',       strength: 1.6, lagHours: 1,   crossLayer: true,  description: 'Атака → волна дезинформации' },
  { from: 'dataLeak',             to: 'propagandaSpike',      strength: 1.8, lagHours: 3,   crossLayer: true,  description: 'Утечка → пропагандистский всплеск' },

  // Информация → Финансы
  { from: 'disinformation',       to: 'panicSelling',         strength: 2.0, lagHours: 4,   crossLayer: true,  description: 'Дезинформация → паника' },
  { from: 'panicSelling',         to: 'vixSpike',             strength: 2.5, lagHours: 1,   crossLayer: true,  description: 'Паника → VIX' },
  { from: 'narrativeShift',       to: 'capitalFlight',        strength: 1.5, lagHours: 12,  crossLayer: true,  description: 'Смена нарратива → отток' },

  // Финансы → Физический
  { from: 'sanctionsExpansion',   to: 'militaryBuildUp',      strength: 1.7, lagHours: 168, crossLayer: true,  description: 'Санкции → военная эскалация' },
  { from: 'marketCrash',          to: 'infrastructureDamage', strength: 1.2, lagHours: 240, crossLayer: true,  description: 'Обвал → деградация инфраструктуры' },

  // Физический → Финансы
  { from: 'conflictEscalation',   to: 'vixSpike',             strength: 2.8, lagHours: 2,   crossLayer: true,  description: 'Конфликт → VIX' },
  { from: 'navalMovement',        to: 'vixSpike',             strength: 1.4, lagHours: 6,   crossLayer: true,  description: 'Флот → нервозность рынков' },
  { from: 'radiationAnomaly',     to: 'vixSpike',             strength: 3.0, lagHours: 1,   crossLayer: true,  description: 'Радиация → паника' },
  { from: 'militaryBuildUp',      to: 'sanctionsExpansion',   strength: 1.9, lagHours: 72,  crossLayer: true,  description: 'Наращивание → санкции' },

  // Внутри слоя Финансы
  { from: 'vixSpike',             to: 'marketCrash',          strength: 2.4, lagHours: 4,   crossLayer: false, description: 'VIX → обвал' },
  { from: 'marketCrash',          to: 'creditFreeze',         strength: 2.0, lagHours: 8,   crossLayer: false, description: 'Обвал → сжатие' },
  { from: 'currencyCrisis',       to: 'capitalFlight',        strength: 2.2, lagHours: 2,   crossLayer: false, description: 'Валютный кризис → отток' },

  // Внутри слоя Физический
  { from: 'militaryBuildUp',      to: 'conflictEscalation',   strength: 2.5, lagHours: 48,  crossLayer: false, description: 'Наращивание → эскалация' },
  { from: 'satelliteAnomaly',     to: 'militaryBuildUp',      strength: 1.8, lagHours: 24,  crossLayer: false, description: 'Спутник → наращивание' },

  // Внутри слоя Информация
  { from: 'propagandaSpike',      to: 'narrativeShift',       strength: 1.6, lagHours: 8,   crossLayer: false, description: 'Пропаганда → смена нарратива' },
  { from: 'mediaBlackout',        to: 'disinformation',       strength: 1.9, lagHours: 4,   crossLayer: false, description: 'Блокировка → рост дезинформации' },
];

// ─── ГРАФ ──────────────────────────────────────────────────────

export class MultiLayerCausalGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map();
    this.crossLayerEdges = [];
    this._initializeGraph();
  }

  _initializeGraph() {
    for (const [id, def] of Object.entries(NODE_DEFINITIONS)) {
      this.nodes.set(id, { id, ...def, currentProb: 0.5, baseProb: 0.5 });
    }
    for (const [id] of this.nodes) this.edges.set(id, []);
    for (const edge of CAUSAL_EDGES) {
      if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) continue;
      this.edges.get(edge.from).push(edge);
      if (edge.crossLayer) this.crossLayerEdges.push(edge);
    }
  }

  observe(nodeId, probability, confidence = 1.0) {
    const node = this.nodes.get(nodeId);
    if (!node) return;
    node.currentProb = node.currentProb * (1 - confidence) + probability * confidence;
    node.currentProb = Math.max(0.001, Math.min(0.999, node.currentProb));
    node.lastObservation = Date.now();
  }

  propagate(maxDepth = 3) {
    const visited = new Set();
    const queue = [];
    for (const [id, node] of this.nodes) {
      if (node.lastObservation && Date.now() - node.lastObservation < 3600000) {
        queue.push({ id, depth: 0, prob: node.currentProb });
        visited.add(id);
      }
    }
    const updates = [];
    while (queue.length) {
      const { id, depth, prob } = queue.shift();
      if (depth >= maxDepth) continue;
      const outEdges = this.edges.get(id) || [];
      for (const edge of outEdges) {
        const targetNode = this.nodes.get(edge.to);
        if (!targetNode) continue;
        const delta = (prob - 0.5) * (edge.strength - 1) * 0.3;
        const newProb = Math.max(0.001, Math.min(0.999, targetNode.currentProb + delta));
        if (Math.abs(newProb - targetNode.currentProb) > 0.001) {
          updates.push({
            from: id, to: edge.to,
            oldProb: targetNode.currentProb, newProb,
            delta: newProb - targetNode.currentProb,
            strength: edge.strength,
            lagHours: edge.lagHours,
            crossLayer: edge.crossLayer,
            description: edge.description,
          });
          targetNode.currentProb = newProb;
        }
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          queue.push({ id: edge.to, depth: depth + 1, prob: newProb });
        }
      }
    }
    return updates;
  }

  doIntervention(nodeId, newProb) {
    const node = this.nodes.get(nodeId);
    if (!node) return null;
    const snapshot = new Map();
    for (const [id, n] of this.nodes) snapshot.set(id, n.currentProb);
    node.currentProb = newProb;
    node.lastObservation = Date.now();
    const updates = this.propagate(5);
    const layerImpact = {};
    for (const u of updates) {
      const targetNode = this.nodes.get(u.to);
      if (!targetNode) continue;
      const layer = targetNode.layer;
      if (!layerImpact[layer]) layerImpact[layer] = [];
      layerImpact[layer].push(u);
    }
    for (const [id, n] of this.nodes) {
      if (id !== nodeId) n.currentProb = snapshot.get(id);
    }
    return {
      intervention: { nodeId, newProb },
      directUpdates: updates.length,
      crossLayerUpdates: updates.filter(u => u.crossLayer).length,
      layerImpact,
      totalImpact: updates.reduce((s, u) => s + Math.abs(u.delta), 0),
      timestamp: new Date().toISOString(),
    };
  }

  crossLayerInfluence() {
    const influence = {};
    for (const edge of this.crossLayerEdges) {
      const fromNode = this.nodes.get(edge.from);
      const toNode = this.nodes.get(edge.to);
      if (!fromNode || !toNode) continue;
      const key = `${fromNode.layer} → ${toNode.layer}`;
      if (!influence[key]) influence[key] = { count: 0, totalStrength: 0, edges: [] };
      influence[key].count++;
      influence[key].totalStrength += edge.strength;
      influence[key].edges.push(edge.description);
    }
    for (const key of Object.keys(influence)) {
      influence[key].avgStrength = influence[key].totalStrength / influence[key].count;
    }
    return influence;
  }

  recursiveCounterfactual(startNode, newProb, chainLength = 3) {
    const chains = [];
    const visited = new Set();
    const explore = (nodeId, prob, depth, path) => {
      if (depth >= chainLength || visited.has(nodeId)) {
        chains.push([...path]);
        return;
      }
      visited.add(nodeId);
      const outEdges = this.edges.get(nodeId) || [];
      for (const edge of outEdges) {
        const targetNode = this.nodes.get(edge.to);
        if (!targetNode) continue;
        const delta = (prob - 0.5) * (edge.strength - 1) * 0.3;
        const newTargetProb = Math.max(0.001, Math.min(0.999, targetNode.currentProb + delta));
        path.push({
          from: nodeId, to: edge.to,
          probability: newTargetProb,
          lagHours: edge.lagHours,
          crossLayer: edge.crossLayer,
        });
        explore(edge.to, newTargetProb, depth + 1, path);
        path.pop();
      }
      visited.delete(nodeId);
    };
    explore(startNode, newProb, 0, []);
    chains.sort((a, b) => {
      const aEffect = a.length > 0 ? Math.abs(a[a.length - 1].probability - 0.5) : 0;
      const bEffect = b.length > 0 ? Math.abs(b[b.length - 1].probability - 0.5) : 0;
      return bEffect - aEffect;
    });
    return chains.slice(0, 5);
  }

  toJSON() {
    return {
      nodes: [...this.nodes.values()].map(n => ({
        id: n.id, name: n.name, layer: n.layer,
        category: n.category, currentProb: n.currentProb,
      })),
      edges: [...this.edges.entries()].flatMap(([from, edges]) =>
        edges.map(e => ({
          from, to: e.to, strength: e.strength,
          lagHours: e.lagHours, crossLayer: e.crossLayer,
          description: e.description,
        }))
      ),
      crossLayerInfluence: this.crossLayerInfluence(),
      stats: {
        nodeCount: this.nodes.size,
        edgeCount: [...this.edges.values()].reduce((s, e) => s + e.length, 0),
        crossLayerEdgeCount: this.crossLayerEdges.length,
        layers: Object.values(LAYERS).length,
      },
    };
  }
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────────────────

export function crucixMultiLayerCausal(latest, history) {
  const graph = new MultiLayerCausalGraph();

  if (latest.fred?.vix > 25) {
    graph.observe('vixSpike', Math.min(0.95, (latest.fred.vix - 20) / 20), 0.9);
  }
  if (latest.gdelt?.conflictEvents?.length > 8) {
    graph.observe('conflictEscalation', Math.min(0.95, latest.gdelt.conflictEvents.length / 20), 0.85);
  }
  if (latest.sanctions?.count > 3) {
    graph.observe('sanctionsExpansion', Math.min(0.9, latest.sanctions.count / 10), 0.9);
  }
  if (latest.radiation?.max > 150) {
    graph.observe('radiationAnomaly', 0.8, 0.95);
  }
  if (latest.delta?.escalatedAlerts > 2) {
    graph.observe('panicSelling', Math.min(0.9, latest.delta.escalatedAlerts / 8), 0.7);
  }

  const propagation = graph.propagate(4);
  const crossLayer = graph.crossLayerInfluence();
  const scenario1 = graph.doIntervention('infrastructureBreach', 0.8);
  const scenario2 = graph.doIntervention('radiationAnomaly', 0.7);
  const scenario3 = graph.doIntervention('sanctionsExpansion', 0.9);
  const counterfactualChains = graph.recursiveCounterfactual('militaryBuildUp', 0.85, 4);

  const result = {
    module: 'multilayer_causal',
    graphStats: graph.toJSON().stats,
    crossLayerInfluence: crossLayer,
    propagation: {
      totalUpdates: propagation.length,
      crossLayerUpdates: propagation.filter(u => u.crossLayer).length,
      updates: propagation.slice(0, 20),
    },
    scenarios: { scenario1, scenario2, scenario3 },
    counterfactualChains,
    timestamp: new Date().toISOString(),
  };

  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[multilayer_causal] Не удалось создать PRED_DIR:', e.message); }
  }
  try {
    writeFileSync(
      join(PRED_DIR, `multilayer_causal_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.warn('[multilayer_causal] Не удалось сохранить результат:', e.message);
  }

  return result;
}
