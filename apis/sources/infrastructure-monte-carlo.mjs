// Crucix — Infrastructure Monte Carlo Simulator v2.0
// Имитационное моделирование отказов инфраструктуры.
//
// ИСПОЛЬЗУЕТСЯ В:
// - /api/layers/infrastructure-api/simulate — прогноз отказов
// - /api/layers/infrastructure-api/sensitivity — анализ чувствительности
//
// ОБНОВЛЕНО 12.09.2026:
// - Добавлен метод sensitivityAnalysis(vulnScores, options) для API.
// - Агрегированный анализ по всем узлам (не только по одному).

export class MonteCarloSimulator {
  constructor(graph, options = {}) {
    this.graph = graph;
    this.propagation = options.propagation || null;
    this.runs = options.runs || 1000;
    this.seed = options.seed || Date.now();
  }

  /**
   * Симуляция отказов узла.
   * @param {string} startNodeId — начальный отказ
   * @param {Object} options — { runs, depth, threshold }
   */
  simulate(startNodeId, options = {}) {
    const runs = options.runs || this.runs;
    const maxDepth = options.depth || 5;
    const threshold = options.threshold ?? 0.5;

    const results = {
      startNode: startNodeId,
      runs,
      affectedCounts: {},
      totalAffected: [],
      cascadeSize: [],
      probabilityOfFailure: {}
    };

    for (let run = 0; run < runs; run++) {
      const affected = this._simulateRun(startNodeId, maxDepth, threshold);
      results.cascadeSize.push(affected.size);
      for (const nodeId of affected) {
        results.affectedCounts[nodeId] = (results.affectedCounts[nodeId] || 0) + 1;
      }
    }

    for (const [nodeId, count] of Object.entries(results.affectedCounts)) {
      results.probabilityOfFailure[nodeId] = count / runs;
    }

    results.meanCascadeSize = results.cascadeSize.reduce((s, x) => s + x, 0) / runs;
    results.maxCascadeSize = Math.max(...results.cascadeSize);
    results.minCascadeSize = Math.min(...results.cascadeSize);

    return results;
  }

  /**
   * Анализ чувствительности — какой фактор сильнее влияет на отказ.
   * @param {string} nodeId
   * @param {Object} factors — { baseline, exposure, degradation } — веса
   */
  sensitivity(nodeId, factors = {}) {
    const results = {};
    const baseline = factors.baseline ?? 0.5;

    // Базовая сумма всех факторов (без обнуления)
    const baselineSum = this._singleRunScore(nodeId, { ...factors });

    for (const [factorName, factorValue] of Object.entries(factors)) {
      if (factorName === 'baseline') continue;

      // Обнуляем ОДИН фактор — считаем, насколько уменьшилась сумма.
      // Это и есть вклад фактора в общий отклик.
      const testFactors = { ...factors };
      testFactors[factorName] = 0;

      const testSum = this._singleRunScore(nodeId, testFactors);
      const delta = Math.abs(baselineSum - testSum);

      results[factorName] = {
        value: factorValue,
        impact: delta,
        impactPct: factorValue > 0 ? (delta / baselineSum) * 100 : 0
      };
    }

    const sorted = Object.entries(results)
      .sort((a, b) => b[1].impact - a[1].impact);

    return {
      nodeId,
      factors: Object.fromEntries(sorted),
      mostInfluential: sorted[0]?.[0] || null,
      leastInfluential: sorted[sorted.length - 1]?.[0] || null
    };
  }

  /**
   * АГРЕГИРОВАННЫЙ АНАЛИЗ ЧУВСТВИТЕЛЬНОСТИ ПО ВСЕМ УЗЛАМ.
   * Вызывается из API: mc.sensitivityAnalysis(vulnScores, { runs: 200 })
   *
   * @param {Object} vulnScores — карта { nodeId: score } от API
   * @param {Object} options — { runs, top }
   * @returns {Object} агрегированный анализ
   */
  sensitivityAnalysis(vulnScores = {}, options = {}) {
    const runs = options.runs || 200;
    const topN = options.top || 5;

    const nodeIds = Object.keys(vulnScores);
    if (nodeIds.length === 0) {
      return {
        runs,
        analyzed: 0,
        factorImpacts: {},
        mostInfluentialOverall: null,
        topSensitiveNodes: []
      };
    }

    // Агрегаторы по факторам
    const factorImpacts = {};
    const nodeResults = [];

    for (const nodeId of nodeIds) {
      const vuln = vulnScores[nodeId];
      const node = this.graph && typeof this.graph.getNode === 'function'
        ? this.graph.getNode(nodeId)
        : null;

      // Формируем факторы из реальных свойств узла
      const factors = {
        baseline: vuln,
        criticality: node ? this._criticalityFromType(node.type) : 0.5,
        exposure: vuln,                     // exposure коррелирует с vuln
        degradation: node?.status === 'critical' ? 0.9
                   : node?.status === 'warning'  ? 0.6
                   : node?.status === 'destroyed' ? 1.0
                   : 0.3,
        redundancy: 0.5
      };

      try {
        const r = this.sensitivity(nodeId, factors);

        // Накапливаем impact по каждому фактору
        for (const [factorName, data] of Object.entries(r.factors)) {
          if (!factorImpacts[factorName]) {
            factorImpacts[factorName] = { sum: 0, max: 0, count: 0 };
          }
          factorImpacts[factorName].sum += data.impact;
          factorImpacts[factorName].max = Math.max(factorImpacts[factorName].max, data.impact);
          factorImpacts[factorName].count++;
        }

        nodeResults.push({
          nodeId,
          mostInfluential: r.mostInfluential,
          leastInfluential: r.leastInfluential,
          impacts: Object.fromEntries(
            Object.entries(r.factors).map(([k, v]) => [k, v.impact])
          )
        });
      } catch (e) {
        // Пропускаем узел при ошибке — не валим весь анализ
        nodeResults.push({ nodeId, error: e.message });
      }
    }

    // Средние impact по факторам
    const averagedFactors = {};
    for (const [factorName, agg] of Object.entries(factorImpacts)) {
      averagedFactors[factorName] = {
        mean: agg.count > 0 ? agg.sum / agg.count : 0,
        max: agg.max,
        samples: agg.count
      };
    }

    // Самый влиятельный фактор (по среднему impact)
    const sortedFactors = Object.entries(averagedFactors)
      .sort((a, b) => b[1].mean - a[1].mean);
    const mostInfluentialOverall = sortedFactors[0]?.[0] || null;

    // Топ-N самых чувствительных узлов (по максимальному impact любого фактора)
    const scored = nodeResults
      .filter(r => !r.error)
      .map(r => ({
        nodeId: r.nodeId,
        mostInfluential: r.mostInfluential,
        maxImpact: Math.max(...Object.values(r.impacts || {}), 0)
      }));
    scored.sort((a, b) => b.maxImpact - a.maxImpact);
    const topSensitiveNodes = scored.slice(0, topN);

    return {
      runs,
      analyzed: nodeResults.filter(r => !r.error).length,
      failed: nodeResults.filter(r => r.error).length,
      factorImpacts: averagedFactors,
      mostInfluentialOverall,
      topSensitiveNodes
    };
  }

  /**
   * Топ-N узлов по каскадному эффекту.
   */
  topCascadeNodes(n = 10, options = {}) {
    // Используем getAllNodes().map(id) — getAllNodeIds() в InfrastructureGraph нет
    const nodeIds = this.graph.getAllNodes
      ? this.graph.getAllNodes().map(n => n.id)
      : [];
    const sizes = [];
    for (const nodeId of nodeIds) {
      const r = this.simulate(nodeId, { runs: 100, depth: 3 });
      sizes.push({ nodeId, meanCascade: r.meanCascadeSize, maxCascade: r.maxCascadeSize });
    }
    sizes.sort((a, b) => b.meanCascade - a.meanCascade);
    return sizes.slice(0, n);
  }

  // === ПРИВАТНЫЕ ===

  _simulateRun(startNodeId, maxDepth, threshold) {
    const affected = new Set();
    const queue = [{ nodeId: startNodeId, depth: 0 }];

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();
      if (affected.has(nodeId)) continue;
      affected.add(nodeId);
      if (depth >= maxDepth) continue;

      const neighbors = this.graph.getNeighbors ? this.graph.getNeighbors(nodeId) : [];
      for (const neighbor of neighbors) {
        if (affected.has(neighbor)) continue;
        if (Math.random() < threshold) {
          queue.push({ nodeId: neighbor, depth: depth + 1 });
        }
      }
    }

    return affected;
  }

  _singleRunScore(nodeId, factors) {
    // Сумма всех числовых факторов. БЕЗ капа Math.min(sum, 1) —
    // иначе при 4-5 факторах сумма всегда > 1, и sensitivity delta = 0.
    const values = Object.values(factors).filter(v => typeof v === 'number');
    if (values.length === 0) return 0;
    return values.reduce((s, v) => s + v, 0);
  }

  _criticalityFromType(type) {
    const map = {
      'nuclear_power_plant': 1.0,
      'dam': 0.95,
      'power_grid': 0.90,
      'chokepoint': 0.95,
      'seaport': 0.75,
      'default': 0.50
    };
    return map[type] ?? map.default;
  }
}

export default MonteCarloSimulator;
