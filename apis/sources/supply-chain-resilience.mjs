// Crucix — SupplyChainResilience
export default class SupplyChainResilience {
  constructor() { this.chains = new Map(); }
  addChain(chain) { this.chains.set(chain.id, { ...chain, added: Date.now() }); return this; }
  score(chainId) {
    const c = this.chains.get(chainId);
    if (!c) return null;
    const diversity = Math.min((c.alternatives || []).length * 20, 100);
    const concentration = c.hhiLevel === 'highly_concentrated' ? 20 : c.hhiLevel === 'moderately_concentrated' ? 50 : 80;
    const riskScore = (diversity + concentration) / 2;
    return { chainId, diversity, concentration, resilienceScore: riskScore, level: riskScore >= 70 ? 'high' : riskScore >= 40 ? 'moderate' : 'low' };
  }
  getAll() { return [...this.chains.keys()].map(id => this.score(id)); }
  weakest(n = 5) { return this.getAll().sort((a, b) => a.resilienceScore - b.resilienceScore).slice(0, n); }
}
