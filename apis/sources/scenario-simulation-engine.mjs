// Crucix — ScenarioSimulationEngine
// Симуляция сценариев с распространением эффектов через граф.

export default class ScenarioSimulationEngine {
  constructor(opts = {}) { this.nodes = new Map(); this.scenarios = new Map(); this.decayFactor = opts.decayFactor ?? 0.7; }
  addNode(id, data) { this.nodes.set(id, { id, ...data }); return this; }
  defineScenario(id, config) { this.scenarios.set(id, { id, ...config }); return this; }
  async run(scenarioId) {
    const sc = this.scenarios.get(scenarioId);
    if (!sc) return { error: 'Scenario not found' };
    const affected = [];
    const visited = new Set();
    const queue = (sc.initialNodes || []).map(n => ({ id: n, impact: 1.0, depth: 0 }));
    while (queue.length > 0) {
      const { id, impact, depth } = queue.shift();
      if (visited.has(id) || depth > 10) continue;
      visited.add(id);
      const node = this.nodes.get(id);
      if (!node) continue;
      affected.push({ id, impact: Math.round(impact * 100) / 100, depth });
      const neighbors = node.cascade || [];
      for (const n of neighbors) {
        if (!visited.has(n)) queue.push({ id: n, impact: impact * this.decayFactor, depth: depth + 1 });
      }
    }
    return {
      scenarioId,
      name: sc.name,
      severity: sc.severity,
      nodesAffected: affected.length,
      affected,
    };
  }
  getAll() { return [...this.scenarios.values()]; }
  stats() { return { nodes: this.nodes.size, scenarios: this.scenarios.size }; }
}
