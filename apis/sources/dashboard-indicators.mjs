// Crucix — DashboardIndicators
// Сборка индикаторов для дашборда из всех анализаторов.

export default class DashboardIndicators {
  constructor() { this.indicators = new Map(); }
  addIndicator(key, value, metadata = {}) {
    this.indicators.set(key, { key, value, metadata, added: Date.now() });
    return this;
  }
  getAll() { return [...this.indicators.values()]; }
  byCategory(category) { return this.getAll().filter(i => i.metadata.category === category); }
  toDashboard() {
    const grouped = {};
    for (const i of this.indicators.values()) {
      const cat = i.metadata.category || 'other';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push({ key: i.key, value: i.value, unit: i.metadata.unit });
    }
    return grouped;
  }
}
