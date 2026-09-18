// tests/fuzz/attention_dynamics.fuzz.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { AttentionDynamics, crucixAttentionDynamics, extractTopicsFromSweep } from '../../apis/predict/attention_dynamics.mjs';

describe('AttentionDynamics — Fuzz Tests', () => {
  it('FUZZ: не падает на произвольные inputs', () => {
    for (let trial = 0; trial < 200; trial++) {
      const ad = new AttentionDynamics({ halfLifeHours: 1 + Math.random() * 100 });
      const numUpdates = Math.floor(Math.random() * 30);

      for (let i = 0; i < numUpdates; i++) {
        const topicId = `topic_${Math.floor(Math.random() * 10)}`;
        const mentions = Math.random() < 0.1 ? [0, -1, 1e9, NaN, Infinity][Math.floor(Math.random() * 5)] : Math.random() * 20;
        const hours = Math.random() < 0.1 ? -1 : Math.random() * 24;

        try {
          ad.update(topicId, mentions, hours);
        } catch (e) {
          // Допустимо для NaN, но не должно крашить
        }
      }

      try {
        ad.getAttentionAllocation();
        ad.detectShifts();
        ad.predictExplosive(5, 24);
      } catch (e) {
        assert.fail(`Trial ${trial} crash: ${e.message}`);
      }
    }
  });

  it('FUZZ: extractTopicsFromSweep на некорректных событиях', () => {
    const cases = [
      {},
      { gdelt: {} },
      { gdelt: { conflictEvents: null } },
      { gdelt: { conflictEvents: [] } },
      { gdelt: { conflictEvents: [null] } },
      { gdelt: { conflictEvents: [{}] } },
      { gdelt: { conflictEvents: [{ summary: null }] } },
      { gdelt: { conflictEvents: [{ summary: 'a'.repeat(100000) }] } },
      { gdelt: { conflictEvents: [{ summary: '💥🔴test💥' }] } },
    ];

    for (const latest of cases) {
      try {
        const topics = extractTopicsFromSweep(latest);
        assert.ok(topics instanceof Map);
      } catch (e) {
        assert.fail(`Crash: ${e.message}`);
      }
    }
  });

  it('FUZZ: crucixAttentionDynamics на 50 случайных sweep', () => {
    for (let trial = 0; trial < 50; trial++) {
      const latest = {};
      if (Math.random() > 0.5) {
        latest.gdelt = {
          conflictEvents: Array.from({ length: Math.floor(Math.random() * 20) }, () => ({
            summary: `word${Math.floor(Math.random() * 20)} word${Math.floor(Math.random() * 20)} word${Math.floor(Math.random() * 20)}`,
          })),
        };
      }

      try {
        const result = crucixAttentionDynamics(latest, []);
        assert.strictEqual(result.module, 'attention_dynamics');
      } catch (e) {
        assert.fail(`Trial ${trial} crash: ${e.message}`);
      }
    }
  });
});
