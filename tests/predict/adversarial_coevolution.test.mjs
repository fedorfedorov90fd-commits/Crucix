// tests/predict/adversarial_coevolution.test.mjs
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import { OpponentModel, AdversarialCoEvolution, crucixAdversarialCoEvolution } from '../../apis/predict/adversarial_coevolution.mjs';

describe('OpponentModel — базовые операции', () => {
  let om;
  beforeEach(() => { om = new OpponentModel({ opponentId: 'test' }); });

  it('инициализируется равномерным распределением', () => {
    assert.strictEqual(om.strategyProbabilities.size, 4);
    for (const p of om.strategyProbabilities.values()) {
      assert.ok(Math.abs(p - 0.25) < 1e-9);
    }
  });

  it('обновляет вероятности после наблюдения', () => {
    // Многократно наблюдаем escalate
    for (let i = 0; i < 20; i++) om.observe('escalate');

    const pEscalate = om.strategyProbabilities.get('escalate');
    assert.ok(pEscalate > 0.7, `Expected escalate > 0.7, got ${pEscalate}`);
  });

  it('нормализует вероятности к 1', () => {
    om.observe('escalate');
    om.observe('hold');
    om.observe('deceive');
    const sum = [...om.strategyProbabilities.values()].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9);
  });

  it('predictNextStrategy возвращает наиболее вероятную', () => {
    for (let i = 0; i < 30; i++) om.observe('deceive');
    const prediction = om.predictNextStrategy();
    assert.strictEqual(prediction.strategy, 'deceive');
    assert.ok(prediction.probability > 0.5);
  });
});

describe('OpponentModel — detectAdaptation', () => {
  it('возвращает insufficient_data при малом числе наблюдений', () => {
    om.observe('escalate', { ourPrediction: 'escalation' });
    const result = om.detectAdaptation();
    assert.strictEqual(result.adapted, false);
    assert.strictEqual(result.reason, 'insufficient_data');
  });

  it('детектирует адаптацию при разных стратегиях', () => {
    // Когда мы предсказывали escalation → противник escalate
    for (let i = 0; i < 10; i++) {
      om.observe('escalate', { ourPrediction: 'escalation' });
    }
    // Когда мы предсказывали de-escalation → противник deceive
    for (let i = 0; i < 10; i++) {
      om.observe('deceive', { ourPrediction: 'de-escalation' });
    }

    const result = om.detectAdaptation();
    assert.strictEqual(result.adapted, true);
    assert.ok(result.klDivergence > 0.3);
  });

  it('не детектирует адаптацию при одинаковых стратегиях', () => {
    for (let i = 0; i < 10; i++) {
      om.observe('hold', { ourPrediction: 'escalation' });
    }
    for (let i = 0; i < 10; i++) {
      om.observe('hold', { ourPrediction: 'de-escalation' });
    }

    const result = om.detectAdaptation();
    assert.strictEqual(result.adapted, false);
  });
});

describe('AdversarialCoEvolution — раунды', () => {
  it('добавляет противников', () => {
    const ace = new AdversarialCoEvolution();
    ace.addOpponent('russia');
    ace.addOpponent('china');

    assert.strictEqual(ace.opponents.size, 2);
  });

  it('round обновляет модели противников', () => {
    const ace = new AdversarialCoEvolution();
    ace.addOpponent('russia');

    const roundData = ace.round('forecast_high', {
      russia: { strategy: 'escalate', context: {} },
    });

    assert.strictEqual(roundData.round, 1);
    assert.strictEqual(roundData.actions.length, 1);
    assert.strictEqual(roundData.actions[0].opponent, 'russia');
    assert.strictEqual(roundData.actions[0].observed, 'escalate');
  });

  it('simulateCoEvolution запускает N раундов', () => {
    const ace = new AdversarialCoEvolution();
    ace.addOpponent('russia');

    const results = ace.simulateCoEvolution(10);
    assert.strictEqual(results.length, 10);
    assert.strictEqual(ace.evolutionHistory.length, 10);
  });

  it('toJSON возвращает сериализуемое состояние', () => {
    const ace = new AdversarialCoEvolution();
    ace.addOpponent('russia');
    ace.round('forecast_high', { russia: { strategy: 'escalate', context: {} } });

    const json = ace.toJSON();
    assert.ok(Array.isArray(json.opponents));
    assert.strictEqual(json.opponents.length, 1);
    assert.ok(json.opponents[0].adaptation);
  });
});

describe('crucixAdversarialCoEvolution — интеграция', () => {
  it('обрабатывает sweep', () => {
    const result = crucixAdversarialCoEvolution({}, []);
    assert.strictEqual(result.module, 'adversarial_coevolution');
    assert.ok(result.opponentsCount > 0);
    assert.ok(Array.isArray(result.adaptations));
  });

  it('возвращает keyInsight', () => {
    const result = crucixAdversarialCoEvolution({}, []);
    assert.ok(typeof result.keyInsight === 'string');
    assert.ok(result.keyInsight.length > 0);
  });
});
