// Crucix — StrategicRiskComposite (класс-вычислитель)
// Композитный стратегический риск: объединяет CII + ResilienceIndex + InfrastructureCascade.
//
// Используется анализатором scripts/analyzers/strategic-risk-composite.mjs.
// Читает из data/analytics/index/ (resilience-index, country-instability)
// и data/infrastructure/objects.json (объекты инфраструктуры).

const DOMAIN_WEIGHTS = {
  instability:       0.30,   // из CII (чем выше CII — тем выше риск)
  resilienceDeficit: 0.25,   // 100 - ResilienceIndex
  infrastructure:    0.25,   // из InfrastructureCascade — критичные объекты в стране
  geopolitical:      0.20,   // из regime/baseRisk (топ-сигналы)
};

const TIER_MULTIPLIER = { 1: 1.0, 2: 0.7, 3: 0.5 };

export default class StrategicRiskComposite {
  constructor() {
    this.store = new Map();
  }

  /**
   * Расчёт для одной страны.
   * @param {Object} input
   * @param {string} input.countryCode
   * @param {string} input.countryName
   * @param {number} input.instabilityScore         — 0..100 (из CII)
   * @param {number} input.resilienceScore          — 0..100 (из ResilienceIndex)
   * @param {number} input.infrastructureRisk       — 0..100 (из infra-cascade)
   * @param {number} input.baseRisk                 — 0..100 (из country-characteristics)
   * @param {number} input.tier                     — 1..3
   * @param {string} input.regime
   * @returns {Object}
   */
  compute(input) {
    const {
      countryCode, countryName,
      instabilityScore = 50,
      resilienceScore = 50,
      infrastructureRisk = 50,
      baseRisk = 50,
      tier = 2,
      regime = 'hybrid',
    } = input || {};

    // 1. Инстабильность (0-100)
    const instability = Math.max(0, Math.min(instabilityScore, 100));

    // 2. Дефицит устойчивости = 100 - resilience
    const resilienceDeficit = Math.max(0, Math.min(100 - resilienceScore, 100));

    // 3. Инфраструктурный риск (0-100)
    const infrastructure = Math.max(0, Math.min(infrastructureRisk, 100));

    // 4. Геополитический риск = комбинация baseRisk + штраф за regime
    const regimePenalty = regime === 'authoritarian' ? 20
                       : regime === 'hybrid' ? 10 : 0;
    const geopolitical = Math.max(0, Math.min(baseRisk + regimePenalty, 100));

    // 5. Взвешенная сумма
    const raw = (
      DOMAIN_WEIGHTS.instability       * instability +
      DOMAIN_WEIGHTS.resilienceDeficit * resilienceDeficit +
      DOMAIN_WEIGHTS.infrastructure    * infrastructure +
      DOMAIN_WEIGHTS.geopolitical      * geopolitical
    );

    // 6. Множитель по tier (страны 1-го уровня влияют сильнее)
    const tierMult = TIER_MULTIPLIER[tier] ?? 0.7;

    // 7. Нормализация: raw 0-100, домножаем на 0.5+tierMult
    const score = Math.min(raw * (0.5 + tierMult * 0.5), 100);

    const record = {
      countryCode,
      countryName,
      score: Math.round(score * 100) / 100,
      tier,
      regime,
      components: {
        instability,
        resilienceDeficit,
        infrastructure,
        geopolitical,
      },
      weights: DOMAIN_WEIGHTS,
    };

    this.store.set(countryCode, record);
    return record;
  }

  get(code) {
    return this.store.get(code) || null;
  }

  topN(n = 10) {
    return [...this.store.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  bottomN(n = 10) {
    return [...this.store.values()]
      .sort((a, b) => a.score - b.score)
      .slice(0, n);
  }

  getAll() {
    return [...this.store.values()];
  }
}
