// tests/predict/scenario_generator.test.mjs
import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ScenarioGenerator, crucixScenarioGeneration } from '../../apis/predict/scenario_generator.mjs';

describe('ScenarioGenerator', () => {
  it('генерирует fallback-сценарии без LLM', async () => {
    const gen = new ScenarioGenerator();
    const scenarios = await gen.generate({ fred: { vix: 30 }, gdelt: { conflictEvents: [] } });
    assert.ok(Array.isArray(scenarios));
    assert.ok(scenarios.length >= 3);
    const totalProb = scenarios.reduce((s, sc) => s + sc.probability, 0);
    assert.ok(Math.abs(totalProb - 1) < 0.1);
  });

  it('использует LLM при наличии', async () => {
    const mockLLM = {
      chat: async () => JSON.stringify({
        scenarios: [
          { id: 's1', name: 'Test', description: 'Desc', probability: 0.5, severity: 'medium', horizonHours: 72 },
          { id: 's2', name: 'Test2', description: 'Desc2', probability: 0.5, severity: 'low', horizonHours: 48 },
        ],
      }),
    };
    const gen = new ScenarioGenerator({ llm: mockLLM, nScenarios: 2 });
    const scenarios = await gen.generate({ fred: { vix: 20 } });
    assert.strictEqual(scenarios.length, 2);
  });

  it('_describeState формирует строку', () => {
    const gen = new ScenarioGenerator();
    const desc = gen._describeState({ fred: { vix: 25, hySpread: 4 }, gdelt: { conflictEvents: [{}] } }, {});
    assert.ok(desc.includes('VIX: 25'));
    assert.ok(desc.includes('Конфликтных событий: 1'));
  });
});

describe('crucixScenarioGeneration', () => {
  it('возвращает структурированный результат', async () => {
    const result = await crucixScenarioGeneration({ fred: { vix: 30 } }, {});
    assert.strictEqual(result.module, 'scenario_generator');
    assert.ok(result.scenarioCount > 0);
    assert.ok(Array.isArray(result.scenarios));
    assert.ok(typeof result.expectedSeverity === 'number');
  });
});
