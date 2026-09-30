// Crucix — Infrastructure Scenario Engine
// Сценарный движок для анализа инфраструктурных сценариев.
//
// ИСПОЛЬЗУЕТСЯ В:
// - /api/layers/infrastructure-api/scenarios — список сценариев
// - /api/layers/infrastructure-api/scenarios?run=NAME — запуск сценария

const SCENARIOS = {
  'black-sea-blockade': {
    name: 'Черноморская блокада',
    description: 'Полная блокада Черноморских портов — прекращение морской торговли',
    nodes: ['port-001', 'port-002'],
    factor: 'supply_chain_disruption',
    severity: 0.9
  },
  'taiwan-strait-crisis': {
    name: 'Тайваньский пролив',
    description: 'Кризис в Тайваньском проливе — блокада морских путей',
    nodes: ['port-singapore', 'port-shanghai'],
    factor: 'maritime_blockade',
    severity: 0.95
  },
  'nuclear-incident': {
    name: 'Инцидент на АЭС',
    description: 'Авария на крупной АЭС с зоной отчуждения 30+ км',
    nodes: ['npp-001'],
    factor: 'radioactive_contamination',
    severity: 0.85
  },
  'hormuz-closure': {
    name: 'Закрытие Ормузского пролива',
    description: 'Иран закрывает Ормузский пролив — 20% мировой нефти',
    nodes: ['chokepoint-hormuz'],
    factor: 'oil_flow_disruption',
    severity: 0.98
  },
  'suez-blockage': {
    name: 'Блокировка Суэца',
    description: 'Блокировка Суэцкого канала — 12% мировой торговли',
    nodes: ['chokepoint-suez'],
    factor: 'trade_route_disruption',
    severity: 0.80
  },
  'cascading-grid-failure': {
    name: 'Каскадный сбой энергосети',
    description: 'Каскадное отключение электроэнергии через перегруженные сети',
    nodes: ['grid-001'],
    factor: 'grid_cascade',
    severity: 0.75
  },
  'global-cyber-attack': {
    name: 'Глобальная кибератака',
    description: 'Скоординированная кибератака на критическую инфраструктуру',
    nodes: ['telecom-001', 'substation-001'],
    factor: 'cyber_warfare',
    severity: 0.70
  },
  'climate-cascade': {
    name: 'Климатический каскад',
    description: 'Землетрясение + цунами + наводнение — каскад природных катастроф',
    nodes: ['dam-001', 'port-001'],
    factor: 'natural_disaster',
    severity: 0.85
  }
};

/**
 * Сценарный движок.
 */
export class ScenarioEngine {
  constructor(graph, options = {}) {
    this.graph = graph;
    this.monteCarlo = options.monteCarlo || null;
    this.vulnerability = options.vulnerability || null;
  }

  /**
   * Список всех сценариев.
   */
  listScenarios() {
    return Object.entries(SCENARIOS).map(([id, s]) => ({
      id,
      name: s.name,
      description: s.description,
      severity: s.severity,
      factor: s.factor,
      nodesCount: s.nodes.length
    }));
  }

  /**
   * Информация о конкретном сценарии.
   */
  getScenario(id) {
    return SCENARIOS[id] ? { id, ...SCENARIOS[id] } : null;
  }

  /**
   * Запуск сценария.
   * @param {string} id — ID сценария
   * @param {Object} vulnScores — карта уязвимостей по узлам
   * @param {Object} options — { runs, region }
   */
  runScenario(id, vulnScores = {}, options = {}) {
    const scenario = SCENARIOS[id];
    if (!scenario) {
      throw new Error(`Сценарий ${id} не найден`);
    }

    const runs = options.runs || 500;
    const region = options.region || null;

    // Запускаем Monte Carlo по каждому узлу сценария
    const nodeResults = {};
    for (const nodeId of scenario.nodes) {
      if (region && !this._nodeInRegion(nodeId, region)) continue;

      if (this.monteCarlo) {
        const mc = this.monteCarlo.simulate(nodeId, { runs, depth: 4 });
        nodeResults[nodeId] = {
          nodeId,
          meanCascade: mc.meanCascadeSize,
          maxCascade: mc.maxCascadeSize,
          probabilityOfFailure: mc.probabilityOfFailure
        };
      } else {
        const vuln = vulnScores[nodeId] || 50;
        nodeResults[nodeId] = {
          nodeId,
          vuln,
          estimatedCascade: vuln * scenario.severity
        };
      }
    }

    // Итоговая оценка
    const totalImpact = Object.values(nodeResults)
      .reduce((s, r) => s + (r.meanCascade || r.estimatedCascade || 0), 0);

    return {
      scenarioId: id,
      scenarioName: scenario.name,
      description: scenario.description,
      severity: scenario.severity,
      factor: scenario.factor,
      runs,
      region: region || 'global',
      nodes: nodeResults,
      totalImpact,
      estimatedAffectedNodes: totalImpact,
      runAt: new Date().toISOString()
    };
  }

  /**
   * Пакетный запуск всех сценариев — рейтинг опасности.
   */
  runAll(vulnScores = {}, options = {}) {
    const results = [];
    for (const id of Object.keys(SCENARIOS)) {
      try {
        const r = this.runScenario(id, vulnScores, { ...options, runs: 100 });
        results.push({
          scenarioId: id,
          scenarioName: r.scenarioName,
          severity: r.severity,
          totalImpact: r.totalImpact,
          estimatedAffectedNodes: r.estimatedAffectedNodes
        });
      } catch (e) {
        results.push({ scenarioId: id, error: e.message });
      }
    }
    results.sort((a, b) => (b.totalImpact || 0) - (a.totalImpact || 0));
    return results;
  }

  // === ПРИВАТНЫЕ ===

  _nodeInRegion(nodeId, region) {
    if (!this.graph.getNode) return true;
    const node = this.graph.getNode(nodeId);
    if (!node) return false;
    return String(node.region || '').toLowerCase() === String(region).toLowerCase();
  }
}

export default ScenarioEngine;
export { SCENARIOS };
