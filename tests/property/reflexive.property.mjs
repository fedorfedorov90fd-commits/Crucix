// tests/property/reflexive.property.mjs
// Property-based тесты для рефлексивной коррекции

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { modelReflexiveEffect, recursiveReflexiveCorrection, computeActorSensitivity } from '../../apis/predict/reflexive.mjs';

describe('Reflexive — Properties', () => {
  it('PROPERTY: adjusted probability всегда в [0, 1]', () => {
    const actors = {
      markets: { mediaExposure: 0.9, reactivity: 0.8, rationality: 0.6 },
      public: { mediaExposure: 0.7, reactivity: 0.6, rationality: 0.3 },
    };

    for (let i = 0; i < 200; i++) {
      const forecast = {
        probability: Math.random(),
        direction: ['positive', 'negative', 'neutral'][Math.floor(Math.random() * 3)],
        horizonHours: Math.random() * 200,
      };
      const result = modelReflexiveEffect(forecast, actors);
      assert.ok(result.adjustedProb >= 0 && result.adjustedProb <= 1,
        `Out of [0,1]: ${result.adjustedProb}`);
    }
  });

  it('PROPERTY: sensitivity в [0, 1]', () => {
    for (let i = 0; i < 100; i++) {
      const actors = {};
      const n = Math.floor(Math.random() * 5) + 1;
      for (let j = 0; j < n; j++) {
        actors[`actor_${j}`] = {
          mediaExposure: Math.random(),
          reactivity: Math.random(),
          rationality: Math.random(),
        };
      }
      const s = computeActorSensitivity(actors);
      assert.ok(s >= 0 && s <= 1, `Sensitivity out of [0,1]: ${s}`);
    }
  });

  it('PROPERTY: recursive correction сходится', () => {
    const actors = { markets: { mediaExposure: 0.8, reactivity: 0.7, rationality: 0.5 } };
    const forecast = { probability: 0.5, direction: 'negative', horizonHours: 24 };

    for (let i = 0; i < 50; i++) {
      const previous = Array.from({ length: i }, (_, j) => ({
        timestamp: new Date(Date.now() - j * 86400000).toISOString(),
        probability: 0.4 + Math.random() * 0.2,
        direction: 'negative',
      }));

      const result = recursiveReflexiveCorrection(forecast, previous, actors);
      assert.ok(result.finalProb >= 0 && result.finalProb <= 1);
      assert.ok(!isNaN(result.finalProb), 'NaN in finalProb');
    }
  });
});
