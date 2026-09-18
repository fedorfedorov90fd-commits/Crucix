// tests/fuzz/adversarial_coevolution.fuzz.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { OpponentModel, AdversarialCoEvolution, crucixAdversarialCoEvolution } from '../../apis/predict/adversarial_coevolution.mjs';

describe('AdversarialCoEvolution — Fuzz Tests', () => {
  it('FUZZ: OpponentModel не падает на произвольные observations', () => {
    for (let trial = 0; trial < 100; trial++) {
      const om = new OpponentModel({ opponentId: 'test' });
      const numObs = Math.floor(Math.random() * 50);

      for (let i = 0; i < numObs; i++) {
        const strategy = Math.random() < 0.1 ? null : ['escalate', 'hold', 'deescalate', 'deceive'][Math.floor(Math.random() * 4)];
        const context = Math.random() < 0.5 ? {} : { ourPrediction: 'escalation' };

        try {
          om.observe(strategy, context);
        } catch (e) {
          // null strategy может быть допустим
        }
      }

      try {
        om.predictNextStrategy();
        om.detectAdaptation();
      } catch (e) {
        assert.fail(`Trial ${trial} crash: ${e.message}`);
      }
    }
  });

  it('FUZZ: AdversarialCoEvolution с произвольными раундами', () => {
    for (let trial = 0; trial < 50; trial++) {
      const ace = new AdversarialCoEvolution();
      const numOpponents = Math.floor(Math.random() * 5) + 1;
      for (let i = 0; i < numOpponents; i++) {
        ace.addOpponent(`opp_${i}`);
      }

      const numRounds = Math.floor(Math.random() * 20);
      for (let r = 0; r < numRounds; r++) {
        const responses = {};
        for (let i = 0; i < numOpponents; i++) {
          if (Math.random() > 0.3) {
            responses[`opp_${i}`] = {
              strategy: ['escalate', 'hold', 'deescalate', 'deceive'][Math.floor(Math.random() * 4)],
              context: {},
            };
          }
        }
        try {
          ace.round(`strategy_${r}`, responses);
        } catch (e) {
          assert.fail(`Round ${r} crash: ${e.message}`);
        }
      }

      try {
        ace.toJSON();
      } catch (e) {
        assert.fail(`toJSON crash: ${e.message}`);
      }
    }
  });

  it('FUZZ: crucixAdversarialCoEvolution на пустых/некорректных inputs', () => {
    const cases = [
      {},
      null,
      undefined,
      [],
      { gdelt: null },
    ];

    for (const latest of cases) {
      try {
        const result = crucixAdversarialCoEvolution(latest || {}, []);
        assert.strictEqual(result.module, 'adversarial_coevolution');
      } catch (e) {
        // Только null/undefined допустимо пропустить
        if (latest === null || latest === undefined) continue;
        assert.fail(`Crash on ${JSON.stringify(latest)}: ${e.message}`);
      }
    }
  });
});
