export default class SupplyChainCascadeEngine {
  constructor() { this.chains = new Map(); this.cascades = []; }
  register(chain) { this.chains.set(chain.id, chain); return this; }
  propagate(chainId, severity = 0.8) {
    const chain = this.chains.get(chainId);
    if (!chain) return null;
    const affected = [];
    const queue = [{ node: chainId, level: 0, impact: severity }];
    const visited = new Set();
    while (queue.length > 0) {
      const { node, level, impact } = queue.shift();
      if (visited.has(node)) continue;
      visited.add(node);
      affected.push({ node, level, impact });
      if (level >= 5) continue;
      const next = (chain.dependencies || []).filter(d => !visited.has(d));
      for (const dep of next) {
        queue.push({ node: dep, level: level + 1, impact: impact * 0.7 });
      }
    }
    return { chainId, severity, affectedNodes: affected.length, impactTrail: affected };
  }
  getAll() { return [...this.chains.values()]; }
}
