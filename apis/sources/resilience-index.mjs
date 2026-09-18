// Crucix — ResilienceIndex (класс-вычислитель)
// Расчёт устойчивости стран: 3 опоры, 6 доменов, 20 параметров.
// Используется анализатором scripts/analyzers/resilience-index.mjs.

/**
 * Resilience Index
 * Оценка 0–100 для ~196 стран, обновление каждые 6 часов.
 *
 * 3 опоры, 6 доменов, 20 параметров.
 */

const SIX_HOURS = 6 * 60 * 60 * 1000;

// Веса доменов (сумма = 1)
const DOMAIN_WEIGHTS = {
  structural: {
    governance:  0.10,
    economic:    0.10,
    social:      0.07,
  },
  shockImpact: {
    conflict:    0.15,
    disaster:    0.10,
    economicShock: 0.08,
  },
  recovery: {
    institutional: 0.20,
    resource:      0.20,
  },
};

export default class ResilienceIndex {

  constructor() {
    /** @type {Map<string, ResilienceRecord>} */
    this.store = new Map();
  }

  /**
   * @param {ResilienceInput} input
   * @typedef {Object} ResilienceInput
   * @property {string} countryCode
   * @property {string} countryName
   * @property {number} governanceScore    — 0..100
   * @property {number} gdpPerCapita        — номинальный ВВП на душу
   * @property {number} giniIndex           — 0..100
   * @property {number} conflictIntensity   — 0..100
   * @property {number} disasterExposure    — 0..100
   * @property {number} economicVolatility  — 0..100
   * @property {number} institutionalCapacity — 0..100
   * @property {number} resourceAdequacy    — 0..100
   * @property {number} [imputedFlags]      — битовая маска импутированных значений
   */
  compute(input) {
    const gdpNorm = Math.min(
      Math.log10(input.gdpPerCapita + 1) / 5 * 100, 100
    );
    const giniScore = 100 - input.giniIndex;

    // Structural readiness
    const structural =
      DOMAIN_WEIGHTS.structural.governance * input.governanceScore +
      DOMAIN_WEIGHTS.structural.economic   * gdpNorm +
      DOMAIN_WEIGHTS.structural.social     * giniScore;

    // Shock impact (инвертируем — меньше шока = больше устойчивость)
    const shockImpact =
      DOMAIN_WEIGHTS.shockImpact.conflict      * (100 - input.conflictIntensity) +
      DOMAIN_WEIGHTS.shockImpact.disaster       * (100 - input.disasterExposure) +
      DOMAIN_WEIGHTS.shockImpact.economicShock * (100 - input.economicVolatility);

    // Recovery capacity
    const recovery =
      DOMAIN_WEIGHTS.recovery.institutional * input.institutionalCapacity +
      DOMAIN_WEIGHTS.recovery.resource      * input.resourceAdequacy;

    const score = Math.round(structural + shockImpact + recovery);
    const clamped = Math.min(Math.max(score, 0), 100);

    const prev = this.store.get(input.countryCode);
    const delta = prev ? clamped - prev.score : 0;

    const record = {
      countryCode: input.countryCode,
      countryName: input.countryName,
      score: clamped,
      delta,
      pillars: {
        structuralReadiness: +structural.toFixed(1),
        shockImpact:         +shockImpact.toFixed(1),
        recoveryCapacity:    +recovery.toFixed(1),
      },
      timestamp: Date.now(),
    };

    this.store.set(input.countryCode, record);
    return record;
  }

  get(countryCode) {
    return this.store.get(countryCode);
  }

  /** Проверка, нужно ли обновление (раз в 6 часов) */
  needsUpdate(countryCode) {
    const rec = this.store.get(countryCode);
    if (!rec) return true;
    return Date.now() - rec.timestamp >= SIX_HOURS;
  }

  bottomN(n = 10) {
    return [...this.store.values()]
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
  }
}
