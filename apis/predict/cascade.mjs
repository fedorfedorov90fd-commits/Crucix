// apis/predict/cascade.mjs
// Каскадное распространение вероятностей по графу событий.
//
// Теоретическая основа:
//   Pearl, J. (1988). "Probabilistic Reasoning in Intelligent Systems".
//   Morgan Kaufmann. Глава 4.
//   Koller, D., & Friedman, N. (2009). "Probabilistic Graphical Models".
//   MIT Press. Глава 3.
//
//   Идея: события образуют причинно-следственный граф. Когда вероятность
//   узла меняется, изменение распространяется по исходящим рёбрам с
//   коэффициентом условной вероятности (Bayes factor) и задержкой (lag).
//
// Применение в Crucix:
//   Эскалация конфликта → рост цен на энергоносители → рост VIX →
//   расширение кредитных спредов → риск-офф. Каждое ребро имеет силу
//   (conditional probability multiplier) и задержку (в часах).
//
// Особенности реализации:
//   * BFS-обход с защитой от циклов
//   * Ограничение сдвига (maxShift) на каждом узле
//   * Отложенные эффекты (lag > 0) собираются отдельно
//   * Предустановленный граф buildCrucixCascadeGraph() с типовыми связями

// ============================================================
// Граф каскадов
// ============================================================

class CascadeGraph {
  constructor() {
    this.nodes = new Map();   // id -> {id, name, baseProb, currentProb, updated}
    this.edges = new Map();   // from -> [{target, conditionalProb, lag, description}]
  }

  /**
   * Добавление узла.
   * @param {string} id
   * @param {string} name
   * @param {number} baseProb — априорная вероятность (0..1)
   */
  addNode(id, name, baseProb = 0.1) {
    this.nodes.set(id, {
      id,
      name,
      baseProb: Math.max(0.001, Math.min(0.999, baseProb)),
      currentProb: Math.max(0.001, Math.min(0.999, baseProb)),
      updated: false,
    });
    if (!this.edges.has(id)) this.edges.set(id, []);
    return this;
  }

  /**
   * Добавление причинно-следственной связи.
   * @param {string} from — ID причины
   * @param {string} to — ID следствия
   * @param {number} conditionalProb — множитель (Bayes factor). >1 усиливает, <1 ослабляет.
   * @param {number} lag — задержка в часах (0 = мгновенная связь)
   * @param {string} description
   */
  addEdge(from, to, conditionalProb = 1.5, lag = 0, description = '') {
    if (!this.nodes.has(from) || !this.nodes.has(to)) {
      throw new Error(`Cascade edge ${from} -> ${to}: node not found`);
    }
    if (!this.edges.has(from)) this.edges.set(from, []);
    this.edges.get(from).push({
      target: to,
      conditionalProb: Math.max(0.01, conditionalProb),
      lag: Math.max(0, lag),
      description,
    });
    return this;
  }

  /**
   * Обновление вероятности узла и распространение по графу (BFS).
   *
   * @param {string} startId — ID узла-источника
   * @param {number} newProb — новая вероятность
   * @param {number} maxShift — максимальный сдвиг на один узел
   * @returns {Object} — {changes: {id: {old, new, shift}}, delayed: [...]}
   */
  update(startId, newProb, maxShift = 0.15) {
    const changes = {};
    const visited = new Set();
    const queue = [{ id: startId, prob: newProb, depth: 0 }];
    const delayed = [];

    while (queue.length > 0) {
      const { id, prob, depth } = queue.shift();
      if (visited.has(id)) continue;
      if (depth > 6) continue; // защита от слишком глубоких обходов
      visited.add(id);

      const node = this.nodes.get(id);
      if (!node) continue;

      const oldProb = node.currentProb;
      let adjusted = prob;

      // Ограничение сдвига
      const shift = adjusted - oldProb;
      if (Math.abs(shift) > maxShift) {
        adjusted = oldProb + Math.sign(shift) * maxShift;
      }
      adjusted = Math.max(0.001, Math.min(0.999, adjusted));
      node.currentProb = adjusted;
      node.updated = true;

      changes[id] = {
        old: oldProb,
        new: adjusted,
        shift: adjusted - oldProb,
        name: node.name,
      };

      // Распространение по исходящим рёбрам
      const outEdges = this.edges.get(id) || [];
      for (const edge of outEdges) {
        const targetNode = this.nodes.get(edge.target);
        if (!targetNode) continue;

        if (edge.lag > 0) {
          // Отложенный эффект — сохраняем отдельно, не применяем сразу
          delayed.push({
            from: id,
            to: edge.target,
            lag: edge.lag,
            conditionalProb: edge.conditionalProb,
            fromProb: adjusted,
            description: edge.description,
          });
          continue;
        }

        // Мгновенное распространение
        const propagated = targetNode.currentProb * edge.conditionalProb;
        queue.push({ id: edge.target, prob: propagated, depth: depth + 1 });
      }
    }

    return { changes, delayed };
  }

  /**
   * Получить все отложенные эффекты (для планирования).
   */
  getDelayedEffects() {
    const delayed = [];
    for (const [from, edges] of this.edges) {
      for (const edge of edges) {
        if (edge.lag > 0) {
          delayed.push({ from, ...edge });
        }
      }
    }
    return delayed;
  }

  /**
   * Сброс всех вероятностей к базовым.
   */
  reset() {
    for (const node of this.nodes.values()) {
      node.currentProb = node.baseProb;
      node.updated = false;
    }
  }

  /**
   * Все узлы в виде Map с текущими вероятностями.
   */
  getAllNodes() {
    const result = new Map();
    for (const [id, node] of this.nodes) {
      result.set(id, { ...node });
    }
    return result;
  }

  /**
   * Топ-узлы по отклонению от базовой вероятности.
   */
  topDeviations(limit = 10) {
    const all = [...this.nodes.values()];
    all.sort(
      (a, b) =>
        Math.abs(b.currentProb - b.baseProb) -
        Math.abs(a.currentProb - a.baseProb)
    );
    return all.slice(0, limit).map((n) => ({
      id: n.id,
      name: n.name,
      baseProb: n.baseProb,
      currentProb: n.currentProb,
      shift: n.currentProb - n.baseProb,
    }));
  }

  /**
   * Сериализация графа.
   */
  serialize() {
    const nodesArr = [];
    for (const [id, node] of this.nodes) {
      nodesArr.push({ ...node });
    }
    const edgesArr = [];
    for (const [from, edges] of this.edges) {
      for (const e of edges) {
        edgesArr.push({ from, ...e });
      }
    }
    return JSON.stringify({ nodes: nodesArr, edges: edgesArr });
  }

  static deserialize(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    const g = new CascadeGraph();
    for (const n of data.nodes || []) {
      g.nodes.set(n.id, {
        id: n.id,
        name: n.name,
        baseProb: n.baseProb,
        currentProb: n.currentProb,
        updated: false,
      });
      g.edges.set(n.id, []);
    }
    for (const e of data.edges || []) {
      if (g.edges.has(e.from)) {
        g.edges.get(e.from).push({
          target: e.target,
          conditionalProb: e.conditionalProb,
          lag: e.lag,
          description: e.description,
        });
      }
    }
    return g;
  }
}

// ============================================================
// Предустановленный граф Crucix
// ============================================================

/**
 * Построение графа каскадов с типовыми геополитико-экономическими
 * связями. Сила рёбер и задержки подобраны эмпирически.
 *
 * @returns {CascadeGraph}
 */
function buildCrucixCascadeGraph() {
  const g = new CascadeGraph();

  // --- Узлы ---
  g.addNode('conflict_escalation', 'Эскалация конфликта', 0.05);
  g.addNode('energy_price_spike', 'Рост цен на энергоносители', 0.10);
  g.addNode('vix_spike', 'Рост VIX > 30', 0.08);
  g.addNode('hy_spread_widen', 'Расширение HY-спредов', 0.12);
  g.addNode('risk_off', 'Режим risk-off', 0.15);
  g.addNode('sanctions_expansion', 'Расширение санкций', 0.10);
  g.addNode('ruble_depreciation', 'Ослабление рубля', 0.20);
  g.addNode('supply_chain_disruption', 'Разрыв цепочек поставок', 0.08);
  g.addNode('radiation_anomaly', 'Радиационная аномалия', 0.02);

  // --- Рёбра (conditionalProb > 1 — усиливает, < 1 — ослабляет) ---
  g.addEdge('conflict_escalation', 'energy_price_spike', 3.5, 6, 'Конфликт → цены на нефть/газ');
  g.addEdge('conflict_escalation', 'vix_spike', 4.0, 0, 'VIX реагирует мгновенно');
  g.addEdge('conflict_escalation', 'sanctions_expansion', 5.0, 12, 'Санкции в течение суток');
  g.addEdge('conflict_escalation', 'risk_off', 3.0, 0, 'Немедленный risk-off');

  g.addEdge('energy_price_spike', 'vix_spike', 2.0, 0, 'Энергетический шок → VIX');
  g.addEdge('vix_spike', 'hy_spread_widen', 2.5, 3, 'VIX → расширение спредов');
  g.addEdge('hy_spread_widen', 'risk_off', 2.0, 0, 'Спреды → risk-off');

  g.addEdge('sanctions_expansion', 'ruble_depreciation', 3.0, 24, 'Санкции → weakening рубля');
  g.addEdge('sanctions_expansion', 'supply_chain_disruption', 2.5, 48, 'Санкции → цепочки поставок');

  g.addEdge('radiation_anomaly', 'vix_spike', 2.0, 0, 'Радиация → паника');
  g.addEdge('radiation_anomaly', 'risk_off', 3.0, 0, 'Радиация → массовый risk-off');

  g.addEdge('risk_off', 'hy_spread_widen', 1.8, 0, 'Risk-off усиливает спреды');
  g.addEdge('supply_chain_disruption', 'energy_price_spike', 1.5, 48, 'Разрыв поставок → цены');

  return g;
}

// ============================================================
// Утилиты
// ============================================================

/**
 * Применение отложенных эффектов через N часов.
 * @param {CascadeGraph} graph
 * @param {Array} delayed — эффекты из update()
 * @param {number} hoursElapsed — сколько часов прошло
 * @returns {Object} — {applied: [...], pending: [...]}
 */
function applyDelayedEffects(graph, delayed, hoursElapsed) {
  const applied = [];
  const pending = [];

  for (const effect of delayed) {
    if (effect.lag <= hoursElapsed) {
      const targetNode = graph.nodes.get(effect.to);
      if (targetNode) {
        const delta = (effect.fromProb - targetNode.baseProb) *
          (effect.conditionalProb - 1) * 0.5;
        const newProb = Math.max(0.001, Math.min(0.999,
          targetNode.currentProb + delta));
        targetNode.currentProb = newProb;
        applied.push({
          from: effect.from,
          to: effect.to,
          delta: newProb - targetNode.currentProb + delta,
        });
      }
    } else {
      pending.push({ ...effect, remainingLag: effect.lag - hoursElapsed });
    }
  }

  return { applied, pending };
}

export {
  CascadeGraph,
  buildCrucixCascadeGraph,
  applyDelayedEffects,
};
