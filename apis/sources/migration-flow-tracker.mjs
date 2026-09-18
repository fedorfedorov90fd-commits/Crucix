export default class MigrationFlowTracker {
  constructor() { this.flows = []; }
  add(flow) { this.flows.push({ ...flow, added: Date.now() }); return this; }
  byOrigin(code) { return this.flows.filter(f => f.origin === code); }
  byDestination(code) { return this.flows.filter(f => f.destination === code); }
  topCorridors(n = 10) {
    const g = {};
    for (const f of this.flows) {
      const k = `${f.origin}_${f.destination}`;
      if (!g[k]) g[k] = { origin: f.origin, destination: f.destination, totalPeople: 0, count: 0 };
      g[k].totalPeople += f.people || 0;
      g[k].count++;
    }
    return Object.values(g).sort((a, b) => b.totalPeople - a.totalPeople).slice(0, n);
  }
  getAll() { return [...this.flows]; }
}
