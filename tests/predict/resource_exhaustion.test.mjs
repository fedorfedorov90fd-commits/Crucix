// tests/predict/resource_exhaustion.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { MilitaryExhaustionModel, EconomicExhaustionModel, crucixResourceExhaustion } from '../../apis/predict/resource_exhaustion.mjs';

describe('MilitaryExhaustionModel', () => {
  let model;
  beforeEach(() => { model = new MilitaryExhaustionModel(); });

  it('инициализируется с начальными ресурсами', () => {
    assert.strictEqual(model.currentResources.ammunition, 100);
    assert.strictEqual(model.currentResources.fuel, 100);
  });

  it('уменьшает ресурсы при наблюдении', () => {
    model.observe({ ammunition: 10, fuel: 5 }, 1);
    assert.ok(model.currentResources.ammunition < 100);
    assert.ok(model.currentResources.fuel < 100);
  });

  it('прогнозирует истощение', () => {
    for (let i = 0; i < 10; i++) {
      model.observe({ ammunition: 5, fuel: 3, equipment: 2, personnel: 1, logistics: 2 }, 1);
    }
    const forecast = model.predictExhaustion(20);
    assert.ok(forecast.aggregateExhaustion > 0);
    assert.ok(forecast.aggregateExhaustion <= 1);
    assert.ok(['stable', 'warning', 'urgent', 'critical'].includes(forecast.overallStatus));
    assert.ok(forecast.criticalResource);
  });

  it('симулирует сценарий с остановкой поставок', () => {
    for (let i = 0; i < 5; i++) {
      model.observe({ ammunition: 5, fuel: 3, equipment: 2, personnel: 1, logistics: 2 }, 1);
    }
    const scenario = model.simulateScenario({ stoppedSupplies: true, increasedConsumption: 1.5 });
    assert.ok(scenario.daysUntilDepletion > 0);
    assert.ok(scenario.limitingResource);
  });

  it('сериализуется и десериализуется', () => {
    model.observe({ ammunition: 10 }, 1);
    const json = model.serialize();
    const m2 = MilitaryExhaustionModel.deserialize(json);
    assert.strictEqual(m2.currentResources.ammunition, model.currentResources.ammunition);
  });
});

describe('EconomicExhaustionModel', () => {
  it('прогнозирует истощение резервов', () => {
    const m = new EconomicExhaustionModel();
    m.sanctions = { exportRestrictions: 0.8, importRestrictions: 0.7, financialRestrictions: 0.9, technologyRestrictions: 0.9 };
    m.budget = { revenue: 50, expenses: 150 };
    const forecast = m.predictExhaustion();
    assert.ok(forecast.economicPressure > 0.5);
    assert.ok(forecast.daysUntilCritical !== undefined);
  });

  it('симулирует ужесточение санкций', () => {
    const m = new EconomicExhaustionModel();
    const result = m.simulateTightening({ exportRestrictions: 0.3 });
    assert.ok(result.result);
    assert.ok(typeof result.deltaDaysUntilCritical === 'number');
  });
});

describe('crucixResourceExhaustion', () => {
  it('обрабатывает sweep', () => {
    const latest = {
      fred: { vix: 30, hySpread: 5 },
      gdelt: { conflictEvents: Array.from({ length: 10 }, () => ({})) },
      sanctions: { count: 6 },
    };
    const result = crucixResourceExhaustion(latest, [{ timestamp: new Date().toISOString(), gdelt: { conflictEvents: [{}] } }]);
    assert.strictEqual(result.module, 'resource_exhaustion');
    assert.ok(result.military);
    assert.ok(result.economic);
    assert.ok(result.scenarios);
  });
});
