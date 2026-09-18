// Crucix — ConflictEscalationTracker (класс-вычислитель)
// Отслеживание эскалации конфликтов: 6-уровневая шкала, тренды интенсивности,
// прогноз следующего уровня.
//
// Используется анализатором scripts/analyzers/conflict-escalation-tracker.mjs.

const LEVELS = [
  { id: 0, name: 'peace',       label: 'Мир',              threshold: 0 },
  { id: 1, name: 'tension',     label: 'Напряжённость',    threshold: 15 },
  { id: 2, name: 'confrontation', label: 'Противостояние', threshold: 30 },
  { id: 3, name: 'clashes',     label: 'Столкновения',     threshold: 50 },
  { id: 4, name: 'war',         label: 'Война',            threshold: 70 },
  { id: 5, name: 'total_war',   label: 'Тотальная война',  threshold: 90 },
];

const INTENSITY_WEIGHTS = {
  fatalities:    0.35,
  events:        0.25,
  civilianImpact: 0.20,
  geography:     0.20,
};

export default class ConflictEscalationTracker {
  constructor() {
    this.conflicts = new Map();
  }

  /**
   * @param {Object} input
   * @param {string} input.conflictId
   * @param {string} input.region
   * @param {number} input.fatalities           — жертвы за период
   * @param {number} input.events               — число событий
   * @param {number} input.civilianCasualties   — потери среди гражданских
   * @param {number} input.geographicSpreadKm   — радиус распространения
   * @param {number} input.previousLevel        — предыдущий уровень
   * @param {number} [input.daysObserved]
   */
  compute(input) {
    const now = Date.now();
    const days = input.daysObserved || 30;

    // 1. Интенсивность: fatalities за 30 дней, нормированные
    const fatalitiesIntensity = Math.min(Math.log10((input.fatalities || 0) + 1) / 4 * 100, 100);
    const eventsIntensity     = Math.min((input.events || 0) / 3, 100);
    const civilianIntensity   = Math.min(Math.log10((input.civilianCasualties || 0) + 1) / 3.5 * 100, 100);
    const geographyIntensity  = Math.min((input.geographicSpreadKm || 0) / 10, 100);

    const intensity =
      INTENSITY_WEIGHTS.fatalities      * fatalitiesIntensity +
      INTENSITY_WEIGHTS.events          * eventsIntensity +
      INTENSITY_WEIGHTS.civilianImpact  * civilianIntensity +
      INTENSITY_WEIGHTS.geography       * geographyIntensity;

    // 2. Уровень
    let currentLevel = 0;
    for (const lvl of LEVELS) {
      if (intensity >= lvl.threshold) currentLevel = lvl.id;
    }

    // 3. Траектория
    const prev = typeof input.previousLevel === 'number' ? input.previousLevel : currentLevel;
    const delta = currentLevel - prev;
    const trajectory = delta > 0 ? 'escalating' : delta < 0 ? 'de-escalating' : 'stable';

    // 4. Прогноз следующего уровня (риск)
    const nextLevel = Math.min(currentLevel + 1, 5);
    const nextThreshold = LEVELS[nextLevel].threshold;
    const gap = nextThreshold - intensity;
    const nextLevelRisk = Math.max(0, Math.min(1 - gap / 30, 1));

    const record = {
      conflictId: input.conflictId,
      region: input.region || 'GLOBAL',
      intensity: Math.round(intensity * 100) / 100,
      currentLevel,
      currentLevelName: LEVELS[currentLevel].name,
      currentLevelLabel: LEVELS[currentLevel].label,
      previousLevel: prev,
      trajectory,
      nextLevel,
      nextLevelName: LEVELS[nextLevel]?.name || 'total_war',
      nextLevelRisk: Math.round(nextLevelRisk * 100) / 100,
      components: {
        fatalities: Math.round(fatalitiesIntensity * 100) / 100,
        events: Math.round(eventsIntensity * 100) / 100,
        civilian: Math.round(civilianIntensity * 100) / 100,
        geography: Math.round(geographyIntensity * 100) / 100,
      },
      observedDays: days,
      timestamp: now,
    };

    this.conflicts.set(input.conflictId, record);
    return record;
  }

  getAll() { return [...this.conflicts.values()]; }
  get(id) { return this.conflicts.get(id) || null; }
  topN(n = 10) {
    return [...this.conflicts.values()].sort((a, b) => b.intensity - a.intensity).slice(0, n);
  }
}
