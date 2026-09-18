// tests/fuzz/scenario_generator.fuzz.mjs
// Fuzz-тесты для ScenarioGenerator
// Цель: найти входные данные, которые ломают парсер или логику

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScenarioGenerator, crucixScenarioGeneration } from '../../apis/predict/scenario_generator.mjs';

function fuzzCases(numCases, generator) {
  return Array.from({ length: numCases }, (_, i) => generator(i));
}

describe('ScenarioGenerator — Fuzz Tests', () => {
  it('FUZZ: не падает на произвольных строках от LLM', async () => {
    const malformedResponses = [
      '',
      'not json',
      '{}',
      '{"scenarios": null}',
      '{"scenarios": []}',
      '{"scenarios": "string"}',
      '{"scenarios": [null]}',
      '{"scenarios": [{}]}',
      '{"scenarios": [{"name": null}]}',
      '{"scenarios": [{"probability": "high"}]}',
      '{"scenarios": [{"probability": -5}]}',
      '{"scenarios": [{"probability": 100}]}',
      '{"scenarios": [{"horizonHours": -10}]}',
      '{"scenarios": [{"severity": "unknown"}]}',
      '["array", "instead", "of", "object"]',
      '{invalid json',
      '{"scenarios": ' + '[' .repeat(100) + '}',
      '{"scenarios": [' + '{}'.repeat(1000).split('').join(',') + ']}',
      '💥🔴not json 💥',
      '\u0000\u0001\u0002',
      '{"scenarios": [{"name": "' + 'A'.repeat(100000) + '"}]}',
    ];

    const latest = { fred: { vix: 25 }, gdelt: { conflictEvents: [{}] } };

    for (const response of malformedResponses) {
      const mockLLM = { chat: async () => response };
      const gen = new ScenarioGenerator({ llm: mockLLM });

      try {
        const scenarios = await gen.generate(latest);
        assert.ok(Array.isArray(scenarios), `Not array for response: ${response.slice(0, 50)}`);
        scenarios.forEach((s, i) => {
          assert.ok(typeof s === 'object', `Scenario ${i} not object`);
          assert.ok(typeof s.probability === 'number' || s.probability === undefined,
            `Scenario ${i} probability not number: ${s.probability}`);
        });
      } catch (e) {
        assert.fail(`Threw on response "${response.slice(0, 50)}": ${e.message}`);
      }
    }
  });

  it('FUZZ: обрабатывает 1000 случайных Latest', async () => {
    const gen = new ScenarioGenerator();

    for (let i = 0; i < 1000; i++) {
      const latest = {};
      if (Math.random() > 0.5) latest.fred = { vix: Math.random() * 100 };
      if (Math.random() > 0.5) latest.gdelt = { conflictEvents: Array.from({ length: Math.floor(Math.random() * 30) }, () => ({})) };
      if (Math.random() > 0.5) latest.sanctions = { count: Math.floor(Math.random() * 20) };

      try {
        const scenarios = await gen.generate(latest);
        assert.ok(Array.isArray(scenarios));
        const totalProb = scenarios.reduce((s, sc) => s + (sc.probability || 0), 0);
        if (scenarios.length > 0) {
          assert.ok(Math.abs(totalProb - 1) < 0.5 || totalProb === 0,
            `Total probability anomalous: ${totalProb}`);
        }
      } catch (e) {
        assert.fail(`Crash on iteration ${i} with ${JSON.stringify(latest)}: ${e.message}`);
      }
    }
  });

  it('FUZZ: crucixScenarioGeneration не падает на null/undefined', async () => {
    const cases = [
      null,
      undefined,
      {},
      { fred: null },
      { fred: { vix: null } },
      { gdelt: { conflictEvents: null } },
      { gdelt: { conflictEvents: 'not array' } },
      { gdelt: { conflictEvents: [null, undefined] } },
      { sanctions: { count: -100 } },
      { fred: { vix: Infinity } },
      { fred: { vix: -Infinity } },
      { fred: { vix: NaN } },
    ];

    for (const latest of cases) {
      try {
        const result = await crucixScenarioGeneration(latest, {});
        assert.ok(result, `Null result for ${JSON.stringify(latest)}`);
        assert.strictEqual(result.module, 'scenario_generator');
      } catch (e) {
        // Ошибки допустимы только для null/undefined
        if (latest === null || latest === undefined) continue;
        assert.fail(`Crash on ${JSON.stringify(latest)}: ${e.message}`);
      }
    }
  });
});
