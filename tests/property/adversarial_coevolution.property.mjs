// tests/property/adversarial_coevolution.property.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OpponentModel, AdversarialCoEvolution } from '../../apis/predict/adversarial_coevolution.mjs';

const PROPERTY_CASES = parseInt(process.env.PROPERTY_CASES || '100', 10);

function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    try { assertion(generator(i)); }
    catch (e) { failures.push({ case: i, error: e.message }); }
  }
  return failures;
}

describe('AdversarialCoEvolution — Property Tests', () => {
  it('PROPERTY: strategyProbabilities суммируются к 1', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const om = new OpponentModel({ opponentId: 'test' });
      const numObs = Math.floor(Math.random() * 30);
      const obs = [];
      for (let i = 0; i < numObs; i++) {
        obs.push(['escalate', 'hold', 'deescalate', 'deceive'][Math.floor(Math.random() * 4)]);
      }
      return { om, obs };
    }, ({ om, obs }) => {
      for (const o of obs) om.observe(o);
      const sum = [...om.strategyProbabilities.values()].reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(sum - 1) < 1e-6, `Sum = ${sum}`);
    });
    assert.strictEqual(failures.length, 0, JSON.stringify(failures.slice(0, 3)));
  });

  it('PROPERTY: все вероятности в [0, 1]', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const om = new OpponentModel({ opponentId: 'test' });
      for (let i = 0; i < 50; i++) {
        om.observe(['escalate', 'hold', 'deescalate', 'deceive'][Math.floor(Math.random() * 4)]);
      }
      return om;
    }, (om) => {
      for (const [s, p] of om.strategyProbabilities) {
        assert.ok(p >= 0 && p <= 1, `P(${s}) = ${p}`);
        assert.ok(!isNaN(p), `NaN probability`);
      }
    });
    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: detectAdaptation не падает при любых входах', () => {
    const failures = forAll(PROPERTY_CASES, () => {
      const om = new OpponentModel({ opponentId: 'test' });
      const numObs = Math.floor(Math.random() * 40);
      const observations = [];
      for (let i = 0; i < numObs; i++) {
        observations.push({
          strategy: ['escalate', 'hold', 'deescalate', 'deceive'][Math.floor(Math.random() * 4)],
          ourPrediction: ['escalation', 'de-escalation', 'unknown'][Math.floor(Math.random() * 3)],
        });
      }
      return { om, observations };
    }, ({ om, observations }) => {
      for (const o of observations) om.observe(o.strategy, { ourPrediction: o.ourPrediction });
      const result = om.detectAdaptation();
      assert.ok(typeof result.adapted === 'boolean', `adapted not boolean: ${result.adapted}`);
    });
    assert.strictEqual(failures.length, 0);
  });

  it('PROPERTY: simulateCoEvolution сохраняет историю', () => {
    const failures = forAll(Math.min(PROPERTY_CASES, 30), () => {
      const ace = new AdversarialCoEvolution();
      ace.addOpponent('opp1');
      return ace;
    }, (ace) => {
      const rounds = Math.floor(Math.random() * 20) + 1;
      ace.simulateCoEvolution(rounds);
      assert.strictEqual(ace.evolutionHistory.length, rounds);
    });
    assert.strictEqual(failures.length, 0);
  });
});
