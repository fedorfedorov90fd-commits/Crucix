// apis/predict/resource_exhaustion.mjs
// Слой 4: Resource Exhaustion Modeling — моделирование исчерпания ресурсов.
//
// Две модели:
//   1. Военное истощение (MilitaryExhaustionModel):
//      пять категорий ресурсов (техника, боеприпасы, топливо, личный состав,
//      логистика), наблюдение расхода, прогноз истощения, симуляция сценариев.
//   2. Экономическое истощение (EconomicExhaustionModel):
//      резервы, торговля, бюджет, санкции, прогноз дней до истощения,
//      симуляция ужесточения санкций.
//
// Прогноз: «при текущем темпе критическое истощение через X дней».
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких дефолтных экспортов.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'resource_exhaustion',
  name: 'Моделирование исчерпания ресурсов (Resource Exhaustion Modeling)',
  layer: 4,
  category: 'resource',
  description: 'Военное и экономическое истощение. Прогноз дней до критического истощения, симуляция сценариев прекращения поставок и ужесточения санкций.',
  version: '2.0.0',
  depends: [],
  exports: [
    'MilitaryExhaustionModel',
    'EconomicExhaustionModel',
    'crucixResourceExhaustion',
  ],
};

// ─── МОДЕЛЬ ВОЕННОГО ИСТОЩЕНИЯ ──────────────────────────────────

export class MilitaryExhaustionModel {
  constructor(config = {}) {
    this.initialResources = config.initialResources || {
      equipment: 100,
      ammunition: 100,
      fuel: 100,
      personnel: 100,
      logistics: 100,
    };
    this.weights = config.weights || {
      equipment: 0.25,
      ammunition: 0.30,
      fuel: 0.20,
      personnel: 0.15,
      logistics: 0.10,
    };
    this.currentResources = { ...this.initialResources };
    this.consumptionRates = {
      equipment: 0,
      ammunition: 0,
      fuel: 0,
      personnel: 0,
      logistics: 0,
    };
    this.observations = [];
  }

  /**
   * Наблюдение: оценка расхода за период.
   * @param {Object} consumption — сколько потрачено за период
   * @param {number} periodDays — за сколько дней
   */
  observe(consumption, periodDays) {
    for (const [key, value] of Object.entries(consumption)) {
      if (!(key in this.currentResources)) continue;
      this.currentResources[key] = Math.max(0, this.currentResources[key] - value);
      const newRate = value / Math.max(periodDays, 0.1);
      this.consumptionRates[key] = this.consumptionRates[key] * 0.7 + newRate * 0.3;
    }
    this.observations.push({
      timestamp: Date.now(),
      consumption,
      periodDays,
      remaining: { ...this.currentResources },
    });
  }

  /**
   * Прогноз истощения: когда ресурс достигнет критического уровня.
   * @param {number} criticalLevel — критический порог (в % от начального)
   */
  predictExhaustion(criticalLevel = 20) {
    const forecast = {};
    for (const [key, current] of Object.entries(this.currentResources)) {
      const rate = this.consumptionRates[key];
      const critical = this.initialResources[key] * (criticalLevel / 100);
      if (rate <= 0) {
        forecast[key] = { daysUntilCritical: Infinity, status: 'stable' };
        continue;
      }
      const daysUntil = (current - critical) / rate;
      forecast[key] = {
        current,
        criticalLevel: critical,
        consumptionRate: rate,
        daysUntilCritical: Math.max(0, daysUntil),
        status: daysUntil <= 0 ? 'critical'
              : daysUntil <= 7 ? 'urgent'
              : daysUntil <= 30 ? 'warning'
              : daysUntil <= 90 ? 'monitoring'
              : 'stable',
      };
    }

    let aggregateExhaustion = 0;
    for (const [key, weight] of Object.entries(this.weights)) {
      const f = forecast[key];
      if (!f) continue;
      const depletion = 1 - (f.current / this.initialResources[key]);
      aggregateExhaustion += depletion * weight;
    }

    const avgConsumptionRate = Object.entries(this.weights)
      .reduce((s, [k, w]) => s + this.consumptionRates[k] * w, 0);
    const currentAgg = Object.entries(this.weights)
      .reduce((s, [k, w]) => s + this.currentResources[k] * w, 0);
    const initialAgg = Object.entries(this.weights)
      .reduce((s, [k, w]) => s + this.initialResources[k] * w, 0);
    const aggregateDays = avgConsumptionRate > 0
      ? (currentAgg - initialAgg * 0.5) / avgConsumptionRate
      : Infinity;

    return {
      resources: forecast,
      aggregateExhaustion,
      aggregateDaysUntil50: aggregateDays,
      overallStatus: aggregateExhaustion > 0.7 ? 'critical'
                   : aggregateExhaustion > 0.5 ? 'urgent'
                   : aggregateExhaustion > 0.3 ? 'warning'
                   : 'stable',
      criticalResource: this._findCritical(forecast),
    };
  }

  _findCritical(forecast) {
    let minDays = Infinity;
    let criticalKey = null;
    for (const [key, f] of Object.entries(forecast)) {
      if (f.daysUntilCritical < minDays) {
        minDays = f.daysUntilCritical;
        criticalKey = key;
      }
    }
    return { resource: criticalKey, daysUntilCritical: minDays };
  }

  /**
   * Симуляция альтернативного сценария.
   */
  simulateScenario({ stoppedSupplies = false, increasedConsumption = 1.0, extraDays = 30 }) {
    const forecast = {};
    for (const [key, current] of Object.entries(this.currentResources)) {
      let rate = this.consumptionRates[key] * increasedConsumption;
      if (stoppedSupplies) rate *= 1.2;
      if (rate <= 0) { forecast[key] = Infinity; continue; }
      forecast[key] = current / rate;
    }
    const finiteValues = Object.values(forecast).filter(v => v !== Infinity);
    const minDays = finiteValues.length > 0 ? Math.min(...finiteValues) : Infinity;
    const limitingResource = Object.entries(forecast)
      .filter(([_, v]) => v !== Infinity)
      .sort((a, b) => a[1] - b[1])[0]?.[0] || null;

    return {
      scenario: { stoppedSupplies, increasedConsumption, extraDays },
      daysUntilDepletion: minDays,
      limitingResource,
      perResource: forecast,
      interpretation: minDays < 30
        ? `КРИТИЧНО: при данном сценарии истощение через ${minDays.toFixed(0)} дней (${limitingResource})`
        : minDays === Infinity
        ? 'Истощение не наступает на данном горизонте'
        : `Сценарий выдерживается ${minDays.toFixed(0)} дней до истощения (${limitingResource})`,
    };
  }

  serialize() {
    return JSON.stringify({
      initialResources: this.initialResources,
      currentResources: this.currentResources,
      consumptionRates: this.consumptionRates,
      observations: this.observations.slice(-50),
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const m = new MilitaryExhaustionModel({ initialResources: data.initialResources });
    m.currentResources = data.currentResources;
    m.consumptionRates = data.consumptionRates;
    m.observations = data.observations || [];
    return m;
  }
}

// ─── МОДЕЛЬ ЭКОНОМИЧЕСКОГО ИСТОЩЕНИЯ ОТ САНКЦИЙ ──────────────────

export class EconomicExhaustionModel {
  constructor(config = {}) {
    this.reserves = config.reserves || {
      foreignCurrency: 500,
      sovereignFund: 200,
      goldReserves: 100,
    };
    this.trade = config.trade || {
      exports: { oil: 0.4, gas: 0.2, minerals: 0.15, other: 0.25 },
      imports: { tech: 0.3, consumer: 0.4, industrial: 0.3 },
    };
    this.budget = config.budget || {
      revenue: 100,
      expenses: 120,
    };
    this.sanctions = config.sanctions || {
      exportRestrictions: 0.3,
      importRestrictions: 0.4,
      financialRestrictions: 0.5,
      technologyRestrictions: 0.6,
    };
    this.history = [];
  }

  observe(economicData, periodDays) {
    this.history.push({
      timestamp: Date.now(),
      economicData,
      periodDays,
    });
  }

  predictExhaustion() {
    const dailyDeficit = this.budget.expenses - this.budget.revenue;
    const exportLoss = Object.values(this.sanctions).reduce((s, v) => s + v, 0) / 4;
    const exportRevenue = this.budget.revenue * (1 - exportLoss * 0.8);
    const dailyReserveChange = exportRevenue - this.budget.expenses;
    const totalReserves = Object.values(this.reserves).reduce((s, v) => s + v, 0);
    const daysUntilReserves = dailyReserveChange < 0
      ? totalReserves / Math.abs(dailyReserveChange)
      : Infinity;
    const criticalReserves = totalReserves * 0.2;
    const daysUntilCritical = dailyReserveChange < 0
      ? (totalReserves - criticalReserves) / Math.abs(dailyReserveChange)
      : Infinity;
    const sanctionPressure = Object.values(this.sanctions).reduce((s, v) => s + v, 0) / 4;
    const reserveDepletion = 1 - (totalReserves / (totalReserves + 1000));
    const deficitPressure = Math.max(0, -dailyReserveChange / 100);

    const economicPressure = Math.min(1,
      sanctionPressure * 0.4 + reserveDepletion * 0.3 + deficitPressure * 0.3
    );

    return {
      totalReserves,
      dailyReserveChange,
      dailyDeficit,
      exportLoss,
      daysUntilReservesExhausted: daysUntilReserves,
      daysUntilCritical,
      sanctionPressure,
      economicPressure,
      status: economicPressure > 0.7 ? 'critical'
            : economicPressure > 0.5 ? 'urgent'
            : economicPressure > 0.3 ? 'warning'
            : 'stable',
      breakingPoint: daysUntilCritical < 180
        ? `Экономический перелом через ${daysUntilCritical.toFixed(0)} дней`
        : 'Экономика устойчива на текущий горизонт',
    };
  }

  simulateTightening(additionalRestrictions) {
    const snapshot = { ...this.sanctions };
    for (const [key, value] of Object.entries(additionalRestrictions)) {
      if (key in this.sanctions) {
        this.sanctions[key] = Math.min(1, this.sanctions[key] + value);
      }
    }
    const result = this.predictExhaustion();
    Object.assign(this.sanctions, snapshot);
    return {
      tightenedSanctions: additionalRestrictions,
      result,
      deltaDaysUntilCritical: result.daysUntilCritical,
    };
  }

  serialize() {
    return JSON.stringify({
      reserves: this.reserves,
      trade: this.trade,
      budget: this.budget,
      sanctions: this.sanctions,
      history: this.history.slice(-30),
    });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const m = new EconomicExhaustionModel({
      reserves: data.reserves,
      trade: data.trade,
      budget: data.budget,
      sanctions: data.sanctions,
    });
    m.history = data.history || [];
    return m;
  }
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────────────────

export function crucixResourceExhaustion(latest, history) {
  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[resource_exhaustion] Не удалось создать PRED_DIR:', e.message); }
  }

  const milFile = join(PRED_DIR, 'military_exhaustion.json');
  const econFile = join(PRED_DIR, 'economic_exhaustion.json');

  let milModel, econModel;
  try {
    milModel = existsSync(milFile)
      ? MilitaryExhaustionModel.deserialize(readFileSync(milFile, 'utf-8'))
      : new MilitaryExhaustionModel();
    econModel = existsSync(econFile)
      ? EconomicExhaustionModel.deserialize(readFileSync(econFile, 'utf-8'))
      : new EconomicExhaustionModel();
  } catch (e) {
    console.warn('[resource_exhaustion] Ошибка загрузки моделей, создаём заново:', e.message);
    milModel = new MilitaryExhaustionModel();
    econModel = new EconomicExhaustionModel();
  }

  if (latest.gdelt?.conflictEvents) {
    const conflictCount = latest.gdelt.conflictEvents.length;
    const consumption = {
      ammunition: conflictCount * 0.1,
      fuel: conflictCount * 0.05,
      equipment: conflictCount * 0.02,
      personnel: conflictCount * 0.01,
      logistics: conflictCount * 0.03,
    };
    const periodDays = history.length > 1 ? 1 : 1;
    milModel.observe(consumption, periodDays);
  }

  const vix = latest.fred?.vix || 20;
  const hySpread = latest.fred?.hySpread || 3;
  const sanctionsCount = latest.sanctions?.count || 0;

  econModel.sanctions = {
    exportRestrictions: Math.min(1, sanctionsCount / 15),
    importRestrictions: Math.min(1, sanctionsCount / 12),
    financialRestrictions: Math.min(1, sanctionsCount / 10),
    technologyRestrictions: Math.min(1, sanctionsCount / 8),
  };

  econModel.budget.revenue = Math.max(50, 100 - vix * 0.5);
  econModel.budget.expenses = 120 + hySpread * 2;

  const milForecast = milModel.predictExhaustion(20);
  const econForecast = econModel.predictExhaustion();

  const scenarios = {
    militaryStopSupplies: milModel.simulateScenario({ stoppedSupplies: true, increasedConsumption: 1.2 }),
    economicTightening: econModel.simulateTightening({
      exportRestrictions: 0.2,
      financialRestrictions: 0.15,
    }),
  };

  try {
    writeFileSync(milFile, milModel.serialize());
    writeFileSync(econFile, econModel.serialize());
  } catch (e) {
    console.warn('[resource_exhaustion] Не удалось сохранить состояние моделей:', e.message);
  }

  const overallPressure = (milForecast.aggregateExhaustion + econForecast.economicPressure) / 2;

  return {
    module: 'resource_exhaustion',
    military: milForecast,
    economic: econForecast,
    scenarios,
    overallPressure,
    overallStatus: overallPressure > 0.7 ? 'critical'
                 : overallPressure > 0.5 ? 'urgent'
                 : overallPressure > 0.3 ? 'warning'
                 : 'stable',
    interpretation: overallPressure > 0.5
      ? `Критическое истощение ресурсов. Военное: ${milForecast.criticalResource?.resource} (${(milForecast.criticalResource?.daysUntilCritical || 0).toFixed(0)}д). Экономическое: перелом через ${(econForecast.daysUntilCritical || 0).toFixed(0)}д.`
      : 'Ресурсы достаточны на текущий горизонт.',
    timestamp: new Date().toISOString(),
  };
}
