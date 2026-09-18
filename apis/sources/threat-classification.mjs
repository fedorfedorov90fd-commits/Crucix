// Crucix — ThreatClassification (класс-вычислитель)
// Классификация угроз по типам и уровням опасности.

const THREAT_LEVELS = [
  { id: 'minimal', min: 0, max: 20 },
  { id: 'low', min: 20, max: 40 },
  { id: 'moderate', min: 40, max: 60 },
  { id: 'high', min: 60, max: 80 },
  { id: 'critical', min: 80, max: 101 },
];

const THREAT_TYPES = {
  military:     { weight: 1.0, label: 'Военная' },
  cyber:        { weight: 0.85, label: 'Кибер' },
  terrorism:    { weight: 0.95, label: 'Терроризм' },
  economic:     { weight: 0.70, label: 'Экономическая' },
  nuclear:      { weight: 1.0, label: 'Ядерная' },
  biological:   { weight: 0.95, label: 'Биологическая' },
  political:    { weight: 0.65, label: 'Политическая' },
  natural:      { weight: 0.60, label: 'Природная' },
};

export default class ThreatClassification {
  constructor() { this.classifications = new Map(); }

  classify(input) {
    const types = input.types || ['political'];
    const severity = Math.min(Math.max(input.severity ?? 0.5, 0), 1);

    const weightedSeverity = types.reduce((sum, t) => {
      return sum + (THREAT_TYPES[t]?.weight || 0.5);
    }, 0) / types.length * severity * 100;

    const level = THREAT_LEVELS.find(l => weightedSeverity >= l.min && weightedSeverity < l.max)?.id || 'critical';

    const record = {
      id: input.id,
      region: input.region || 'GLOBAL',
      types,
      severity,
      weightedSeverity: Math.round(weightedSeverity * 100) / 100,
      level,
      labels: types.map(t => THREAT_TYPES[t]?.label || t),
      timestamp: input.timestamp || Date.now(),
    };
    this.classifications.set(input.id, record);
    return record;
  }

  getAll() { return [...this.classifications.values()]; }
  topN(n = 10) { return this.getAll().sort((a,b) => b.weightedSeverity - a.weightedSeverity).slice(0, n); }
  byLevel(level) { return this.getAll().filter(c => c.level === level); }
}
