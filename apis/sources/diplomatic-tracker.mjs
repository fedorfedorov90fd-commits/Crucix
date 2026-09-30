export default class DiplomaticTracker {
  constructor() { this.events = []; }
  add(e) { this.events.push({ ...e, added: Date.now() }); return this; }
  byCountry(code) { return this.events.filter(e => e.country === code); }
  byType(type) { return this.events.filter(e => e.type === type); }
  summarize() {
    const g = {};
    for (const e of this.events) {
      const c = e.country || 'GLOBAL';
      if (!g[c]) g[c] = { country: c, visits: 0, sanctions: 0, treaties: 0, protests: 0, expulsions: 0 };
      const t = e.type || 'visit';
      if (g[c][t + 's']) g[c][t + 's']++; else g[c][t] = (g[c][t] || 0) + 1;
    }
    return Object.values(g).sort((a, b) => (b.visits || 0) - (a.visits || 0));
  }
  getAll() { return [...this.events]; }
}
