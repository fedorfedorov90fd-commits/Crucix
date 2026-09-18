// tests/property/regime_signature.property.mjs
// Property-based тесты для extractRegimeSignature

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractRegimeSignature } from '../../apis/predict/meta_ensemble.mjs';

function forAll(numCases, generator, assertion) {
  const failures = [];
  for (let i = 0; i < numCases; i++) {
    const input = generator(i);
    try { assertion(input); }
    catch (e) { failures.push({ case: i, input, error: e.message }); }
  }
  return failures;
}

describe('extractRegimeSignature — Properties', () => {
  it('PROPERTY: всегда возвращает 8 значений в [0, 1]', () => {
    const failures = forAll(200, () => ({
      vix: Math.random() * 100 - 20,     // может быть отрицательным
      hySpread: Math.random() * 20 - 5,
      conflicts: Math.floor(Math.random() * 50) - 10,
      sanctions: Math.floor(Math.random() * 30) - 5,
      alerts: Math.floor(Math.random() * 30) - 5,
      escalated: Math.floor(Math.random() * 20) - 5,
    }), ({ vix, hySpread, conflicts, sanctions, alerts, escalated }) => {
      const latest = {
        fred: { vix, hySpread },
        gdelt: { conflictEvents: Array.from({ length: Math.max(0, conflicts) }, () => ({})) },
        sanctions: { count: Math.max(0, sanctions) },
        delta: { newAlerts: Math.max(0, alerts), escalatedAlerts: Math.max(0, escalated) },
      };
      const history = [];
      const sig = extractRegimeSignature(latest, history);

      assert.strictEqual(sig.length, 8, `Got ${sig.length} features`);
      sig.forEach((v, i) => {
        assert.ok(typeof v === 'number', `Feature ${i} not number: ${typeof v}`);
        assert.ok(!isNaN(v), `Feature ${i} is NaN`);
        assert.ok(v >= 0 && v <= 1, `Feature ${i} = ${v} out of [0, 1]`);
      });
    });

    assert.strictEqual(failures.length, 0, `Failures: ${JSON.stringify(failures.slice(0, 3))}`);
  });

  it('PROPERTY: монотонность — рост VIX увеличивает 1-й признак', () => {
    const latest1 = { fred: { vix: 20 }, gdelt: { conflictEvents: [] } };
    const latest2 = { fred: { vix: 40 }, gdelt: { conflictEvents: [] } };

    const sig1 = extractRegimeSignature(latest1, []);
    const sig2 = extractRegimeSignature(latest2, []);

    assert.ok(sig2[0] > sig1[0], `VIX monotonicity violated: ${sig1[0]} vs ${sig2[0]}`);
  });

  it('PROPERTY: пустые данные не приводят к NaN', () => {
    const sig = extractRegimeSignature({}, []);
    sig.forEach(v => assert.ok(!isNaN(v), 'NaN with empty input'));
  });
});
