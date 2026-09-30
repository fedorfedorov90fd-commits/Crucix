// Crucix — MultiSourceCorroboration
// Проверка фактов через несколько независимых источников.

export default class MultiSourceCorroboration {
  constructor(opts = {}) {
    this.claims = new Map();
    this.trustThreshold = opts.trustThreshold ?? 0.6;
    this.minSources = opts.minSources ?? 2;
  }

  addClaim(claim) {
    const id = claim.id;
    if (!this.claims.has(id)) this.claims.set(id, { id, text: claim.text, sources: [], verifications: [] });
    const c = this.claims.get(id);
    c.sources.push({ source: claim.source, credibility: claim.credibility ?? 0.5, timestamp: claim.timestamp ?? Date.now(), supports: claim.supports ?? true });
    return this.verify(id);
  }

  verify(claimId) {
    const c = this.claims.get(claimId);
    if (!c) return null;
    const supporting = c.sources.filter(s => s.supports && s.credibility >= this.trustThreshold);
    const opposing = c.sources.filter(s => !s.supports && s.credibility >= this.trustThreshold);
    const netSupport = supporting.length - opposing.length;
    const verdict = netSupport >= this.minSources ? 'confirmed'
                  : netSupport >= 1 ? 'likely'
                  : netSupport <= -this.minSources ? 'refuted'
                  : netSupport <= -1 ? 'unlikely'
                  : 'unverified';
    return {
      id: claimId,
      text: c.text,
      verdict,
      supportingCount: supporting.length,
      opposingCount: opposing.length,
      totalSources: c.sources.length,
      avgCredibility: c.sources.reduce((s, x) => s + x.credibility, 0) / c.sources.length,
      confidence: Math.min(supporting.length / 5, 1),
      sources: c.sources,
    };
  }

  getAll() { return [...this.claims.keys()].map(id => this.verify(id)); }
  getConfirmed() { return this.getAll().filter(c => c.verdict === 'confirmed'); }
}
