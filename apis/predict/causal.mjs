// apis/predict/causal.mjs
// Причинный вывод по Джуде Перлу: do-calculus, counterfactual reasoning.
//
// Теоретическая основа:
//   Pearl, J. (2000). "Causality: Models, Reasoning, and Inference".
//   Cambridge University Press.
//   Pearl, J. (1995). "Causal diagrams for empirical research". Biometrika.
//   Spirtes, P., Glymour, C., & Scheines, R. (2000). "Causation, Prediction,
//   and Search" (2nd ed.). MIT Press.
//
// Ключевые идеи:
//   1. Наблюдение P(Y|X) не равно интервенции P(Y|do(X)) при наличии конфаундеров.
//   2. Backdoor adjustment: P(Y|do(X=x)) = Sum_Z P(Y|X=x, Z) * P(Z),
//      где Z — множество для блокирования backdoor-путей.
//   3. Counterfactual (Ladder of Causation, Level 3):
//      "что было бы, если бы X было другим, при прочих равных?"
//   4. Causal discovery из данных через тесты условной независимости.
//
// Применение в Crucix:
//   Ответы на вопросы: "что если бы VIX был 15 вместо 25?",
//   "какой вклад конфликта в итоговую эскалацию?".

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Causal DAG
// ============================================================

class CausalDAG {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
  }

  addNode(id, name, type = 'variable') {
    this.nodes.set(id, { id, name, type });
  }

  addEdge(from, to, strength = 1.0) {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Node not found: ${from} or ${to}`);
    }
    if (this._createsCycle(from, to)) {
      throw new Error(`Edge ${from} -> ${to} creates a cycle`);
    }
    this.edges.push({ from, to, strength });
  }

  _createsCycle(from, to) {
    const visited = new Set();
    const queue = [to];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === from) return true;
      if (visited.has(node)) continue;
      visited.add(node);
      for (const e of this.edges) {
        if (e.from === node) queue.push(e.to);
      }
    }
    return false;
  }

  getParents(nodeId) {
    return this.edges.filter((e) => e.to === nodeId).map((e) => e.from);
  }

  getChildren(nodeId) {
    return this.edges.filter((e) => e.from === nodeId).map((e) => e.to);
  }

  findAllPaths(start, end, maxDepth = 10) {
    const paths = [];
    const dfs = (current, path, visited) => {
      if (path.length > maxDepth) return;
      if (current === end) {
        paths.push([...path]);
        return;
      }
      visited.add(current);
      for (const e of this.edges) {
        const next =
          e.from === current ? e.to : e.to === current ? e.from : null;
        if (next && !visited.has(next)) {
          path.push({
            from: current,
            to: next,
            direction: e.from === current ? 'forward' : 'backward',
          });
          dfs(next, path, visited);
          path.pop();
        }
      }
      visited.delete(current);
    };
    dfs(start, [], new Set());
    return paths;
  }

  findBackdoorPaths(x, y) {
    const allPaths = this.findAllPaths(x, y);
    return allPaths.filter((path) => {
      return path.length > 0 && path[0].to === x;
    });
  }

  findBackdoorAdjustmentSet(x, y) {
    const backdoorPaths = this.findBackdoorPaths(x, y);
    if (backdoorPaths.length === 0) return { set: [], needed: false };

    const xChildren = new Set(this.getChildren(x));
    const candidates = new Set();

    for (const path of backdoorPaths) {
      for (const step of path) {
        for (const node of [step.from, step.to]) {
          if (node !== x && node !== y && !xChildren.has(node)) {
            candidates.add(node);
          }
        }
      }
    }
    return {
      set: [...candidates],
      needed: true,
      pathsBlocked: backdoorPaths.length,
    };
  }

  doIntervention(x, xValue, y, data) {
    const adj = this.findBackdoorAdjustmentSet(x, y);

    if (!adj.needed) {
      return {
        y,
        doX: xValue,
        probability: computeConditionalProb(data, y, { [x]: xValue }),
        adjustmentSet: [],
      };
    }

    const zSet = adj.set;
    const zValues = enumerateValues(data, zSet);

    let total = 0;
    for (const zConfig of zValues) {
      const pYZgivenXZ = computeConditionalProb(data, y, {
        [x]: xValue,
        ...zConfig,
      });
      const pZ = computeMarginalProb(data, zConfig);
      total += pYZgivenXZ * pZ;
    }

    return {
      y,
      doX: xValue,
      probability: total,
      adjustmentSet: zSet,
    };
  }

  counterfactual(x, observedX, hypotheticalX, y, data) {
    const adj = this.findBackdoorAdjustmentSet(x, y);
    const zSet = adj.set;

    const observedZ = {};
    for (const z of zSet) {
      observedZ[z] = data[0] && data[0][z] !== undefined ? data[0][z] : 0;
    }

    const factual = computeConditionalProb(data, y, {
      [x]: observedX,
      ...observedZ,
    });
    const counterfactualProb = computeConditionalProb(data, y, {
      [x]: hypotheticalX,
      ...observedZ,
    });

    return {
      factual: { x: observedX, probability: factual },
      counterfactual: { x: hypotheticalX, probability: counterfactualProb },
      effect: counterfactualProb - factual,
      adjustmentSet: zSet,
    };
  }
}

// ============================================================
// Статистические утилиты
// ============================================================

function computeConditionalProb(data, target, conditions) {
  const matching = (data || []).filter((row) =>
    Object.entries(conditions).every(([k, v]) => {
      const val = row[k];
      if (typeof v === 'number') return val >= v;
      return val === v;
    })
  );
  if (matching.length === 0) return 0;
  const positive = matching.filter(
    (row) => row[target] === 1 || row[target] === true
  ).length;
  return positive / matching.length;
}

function computeMarginalProb(data, conditions) {
  const matching = (data || []).filter((row) =>
    Object.entries(conditions).every(([k, v]) => row[k] === v)
  );
  return matching.length / Math.max((data || []).length, 1);
}

function enumerateValues(data, variables) {
  if (!variables || variables.length === 0) return [{}];
  const valueSets = variables.map((v) => [
    ...new Set((data || []).map((row) => row[v])),
  ]);
  const configs = [];
  const generate = (idx, current) => {
    if (idx === variables.length) {
      configs.push({ ...current });
      return;
    }
    for (const val of valueSets[idx]) {
      current[variables[idx]] = val;
      generate(idx + 1, current);
    }
  };
  generate(0, {});
  return configs;
}

// ============================================================
// Causal Discovery — PC-алгоритм (упрощённый)
// ============================================================

function causalDiscovery(data, variables, alpha = 0.05) {
  const skeleton = new Map();
  for (const v1 of variables) {
    skeleton.set(v1, new Set(variables.filter((v) => v !== v1)));
  }

  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const x = variables[i];
      const y = variables[j];

      if (isIndependent(data, x, y, [])) {
        skeleton.get(x).delete(y);
        skeleton.get(y).delete(x);
        continue;
      }

      for (let k = 0; k < variables.length; k++) {
        if (k === i || k === j) continue;
        const z = variables[k];
        if (isIndependent(data, x, y, [z])) {
          skeleton.get(x).delete(y);
          skeleton.get(y).delete(x);
          break;
        }
      }
    }
  }

  const dag = new CausalDAG();
  for (const v of variables) dag.addNode(v, v);

  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const x = variables[i];
      const y = variables[j];
      if (skeleton.get(x) && skeleton.get(x).has(y)) {
        if (i < j) dag.addEdge(x, y, 0.8);
        else dag.addEdge(y, x, 0.8);
      }
    }
  }

  return {
    skeleton: Object.fromEntries(
      [...skeleton].map(([k, v]) => [k, [...v]])
    ),
    dag,
  };
}

function isIndependent(data, x, y, conditioningSet) {
  const filtered =
    conditioningSet.length === 0
      ? data
      : (data || []).filter((row) =>
          conditioningSet.every((z) => row[z] !== undefined)
        );

  if (filtered.length < 10) return false;

  const xVals = filtered.map((r) => r[x]).filter((v) => typeof v === 'number');
  const yVals = filtered.map((r) => r[y]).filter((v) => typeof v === 'number');

  if (xVals.length < 10 || yVals.length < 10) return false;

  const corr = pearsonCorrelation(xVals, yVals);
  const threshold = 0.1;
  return Math.abs(corr) < threshold;
}

function pearsonCorrelation(x, y) {
  const n = Math.min(x.length, y.length);
  if (n === 0) return 0;
  const mx = x.slice(0, n).reduce((a, b) => a + b, 0) / n;
  const my = y.slice(0, n).reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? 0 : num / denom;
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

function crucixCausalAnalysis(latest, history, intervention) {
  const data = (history || []).map((h) => ({
    vix: (h.fred && h.fred.vix) || 20,
    hySpread: (h.fred && h.fred.hySpread) || 3,
    conflictCount:
      h.gdelt && Array.isArray(h.gdelt.conflictEvents)
        ? h.gdelt.conflictEvents.length
        : 0,
    sanctionsCount: (h.sanctions && h.sanctions.count) || 0,
    newAlerts: (h.delta && h.delta.newAlerts) || 0,
    escalatedAlerts: (h.delta && h.delta.escalatedAlerts) || 0,
  })).filter((row) => Object.values(row).every((v) => v !== undefined));

  if (data.length < 20) {
    return {
      module: 'causal',
      available: false,
      reason: 'insufficient_data',
      count: data.length,
    };
  }

  const variables = [
    'vix', 'hySpread', 'conflictCount', 'sanctionsCount', 'newAlerts', 'escalatedAlerts',
  ];

  const { skeleton, dag } = causalDiscovery(data, variables);

  const iv = intervention || {
    x: 'vix',
    xValue: 35,
    y: 'conflictCount',
  };
  const result = dag.doIntervention(iv.x, iv.xValue, iv.y, data);

  const currentValues = {
    vix: (latest && latest.fred && latest.fred.vix) || 20,
    conflictCount:
      latest && latest.gdelt && Array.isArray(latest.gdelt.conflictEvents)
        ? latest.gdelt.conflictEvents.length
        : 0,
  };

  const counterfactual = dag.counterfactual(
    iv.x,
    currentValues[iv.x] !== undefined ? currentValues[iv.x] : 0,
    iv.xValue,
    iv.y,
    data
  );

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `causal_${Date.now()}.json`),
      JSON.stringify({ intervention: result, counterfactual }, null, 2)
    );
  } catch (e) {
    // Модуль работает даже без диска
  }

  return {
    module: 'causal',
    available: true,
    nSamples: data.length,
    intervention: result,
    counterfactual,
    causalGraph: {
      nodes: [...dag.nodes.keys()],
      edges: dag.edges,
    },
    skeleton,
    timestamp: new Date().toISOString(),
  };
}

export {
  CausalDAG,
  causalDiscovery,
  computeConditionalProb,
  computeMarginalProb,
  enumerateValues,
  isIndependent,
  pearsonCorrelation,
  crucixCausalAnalysis,
};
