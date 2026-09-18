export default class ArmsTransferTracker {
  constructor() { this.transfers = []; }
  add(t) { this.transfers.push({ ...t, added: Date.now() }); return this; }
  bySupplier(code) { return this.transfers.filter(t => t.supplier === code); }
  byRecipient(code) { return this.transfers.filter(t => t.recipient === code); }
  topFlows(n = 10) {
    const g = {};
    for (const t of this.transfers) {
      const k = `${t.supplier}_${t.recipient}`;
      if (!g[k]) g[k] = { supplier: t.supplier, recipient: t.recipient, totalValue: 0, count: 0 };
      g[k].totalValue += t.valueUSD || 0;
      g[k].count++;
    }
    return Object.values(g).sort((a, b) => b.totalValue - a.totalValue).slice(0, n);
  }
  getAll() { return [...this.transfers]; }
}
