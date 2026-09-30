// Crucix — LangGraphOrchestrator
// Оркестратор графа анализаторов: последовательный/параллельный запуск.

export default class LangGraphOrchestrator {
  constructor() { this.nodes = new Map(); this.edges = new Map(); }
  addNode(id, handler, opts = {}) {
    this.nodes.set(id, { id, handler, opts, added: Date.now() });
    return this;
  }
  addEdge(from, to) {
    if (!this.edges.has(from)) this.edges.set(from, []);
    this.edges.get(from).push(to);
    return this;
  }
  async execute(startNode, initialState = {}) {
    const visited = new Set();
    const results = {};
    const queue = [startNode];
    while (queue.length > 0) {
      const nodeId = queue.shift();
      if (visited.has(nodeId)) continue;
      visited.add(nodeId);
      const node = this.nodes.get(nodeId);
      if (!node) continue;
      try {
        results[nodeId] = await node.handler(initialState, results);
      } catch (e) {
        results[nodeId] = { error: e.message };
      }
      const next = this.edges.get(nodeId) || [];
      for (const n of next) if (!visited.has(n)) queue.push(n);
    }
    return results;
  }
  stats() { return { nodes: this.nodes.size, edges: [...this.edges.values()].reduce((s, v) => s + v.length, 0) }; }
}
