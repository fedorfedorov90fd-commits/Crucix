// Crucix — ProgressiveDisclosure
// Прогрессивное раскрытие: от общего к деталям по уровням.

export default class ProgressiveDisclosure {
  constructor() { this.levels = new Map(); }
  define(itemId, levels) {
    // levels = [{ level: 'summary', data: {...} }, { level: 'medium', data: {...} }, { level: 'full', data: {...} }]
    this.levels.set(itemId, levels);
    return this;
  }
  get(itemId, level = 'summary') {
    const item = this.levels.get(itemId);
    if (!item) return null;
    const found = item.find(l => l.level === level);
    return found ? found.data : item[0]?.data || null;
  }
  getDetailLevels(itemId) {
    const item = this.levels.get(itemId);
    if (!item) return [];
    return item.map(l => ({ level: l.level, sizeEstimate: JSON.stringify(l.data).length }));
  }
  getAll() { return [...this.levels.keys()]; }
}
