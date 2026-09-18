// tests/integration/full_pipeline.test.mjs
//
// Интеграционный тест полного прогностического конвейера Crucix v3.0
//
// Проверяет:
//   1. Корректность загрузки синтетических исторических данных
//   2. Работу всех фаз A-M без исключений
//   3. Наличие всех обязательных полей в итоговом прогнозе
//   4. Согласованность фаз J, K, L, M (кросс-проверки)
//   5. Идемпотентность при повторном запуске
//   6. Graceful degradation при падении отдельных модулей
//
// Академический контекст:
//   Данный тест реализует методологию integration testing, описанную в
//   Myers, Sandler, Badgett (2011) "The Art of Software Testing", гл. 7:
//   проверка взаимодействия модулей через системный интерфейс, а не
//   через внутренние детали реализации.

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { writeFileSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const RUNS_DIR = join(ROOT, 'runs');
const MEMORY_DIR = join(RUNS_DIR, 'memory');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// === SYNTHETIC DATA GENERATOR ===

/**
 * Генерирует N синтетических sweep-записей с реалистичной динамикой.
 *
 * Модель данных:
 *   - VIX: Ornstein-Uhlenbeck вокруг базовой линии с шоковыми событиями
 *   - Конфликты: Hawkes-подобный процесс (кластеризация)
 *   - Санкции: редкие события, зависящие от конфликтов
 *   - Радиация: baseline + редкие всплески
 *
 * @param {number} n -- количество sweep-записей
 * @param {object} opts -- параметры генерации
 */
function generateSyntheticHistory(n = 60, opts = {}) {
  const {
    baseVix = 20,
    vixMeanReversion = 0.05,
    vixVolatility = 1.5,
    conflictRate = 0.3,
    startTime = Date.now() - n * 15 * 60 * 1000,
  } = opts;

  const history = [];
  let vix = baseVix;
  let recentConflictCluster = false;

  for (let i = 0; i < n; i++) {
    const timestamp = new Date(startTime + i * 15 * 60 * 1000).toISOString();

    // VIX: OU-процесс
    vix += vixMeanReversion * (baseVix - vix) + (Math.random() - 0.5) * vixVolatility;
    // Шок: 3% вероятность резкого роста
    if (Math.random() < 0.03) vix += 8 + Math.random() * 10;
    vix = Math.max(10, Math.min(80, vix));

    // Конфликты: Hawkes-like (clustering)
    let conflictCount;
    if (recentConflictCluster) {
      conflictCount = Math.floor(Math.random() * 5) + 5;
      recentConflictCluster = Math.random() < 0.6;
    } else {
      conflictCount = Math.random() < conflictRate ? Math.floor(Math.random() * 8) + 2 : Math.floor(Math.random() * 3);
      recentConflictCluster = conflictCount > 8 && Math.random() < 0.4;
    }

    // Санкции: зависят от конфликтов
    const sanctionsCount = conflictCount > 10 ? Math.floor(Math.random() * 3) + 1 : Math.floor(Math.random() * 2);

    // Алерты: зависят от VIX и конфликтов
    const newAlerts = Math.floor((vix - 15) / 5 + conflictCount * 0.3);
    const escalatedAlerts = vix > 30 || conflictCount > 12 ? Math.floor(Math.random() * 3) : 0;

    // Радиация: baseline + редкие всплески
    const radiationMax = Math.random() < 0.02 ? 200 + Math.random() * 300 : 50 + Math.random() * 40;

    history.push({
      sweepId: `sweep_${i}_${Date.now()}`,
      timestamp,
      fred: {
        vix: parseFloat(vix.toFixed(2)),
        hySpread: parseFloat((3 + (vix - 20) * 0.1 + (Math.random() - 0.5) * 0.3).toFixed(2)),
        treasury10y: parseFloat((4 + (Math.random() - 0.5) * 0.3).toFixed(2)),
      },
      gdelt: {
        conflictEvents: Array.from({ length: conflictCount }, (_, j) => ({
          summary: `conflict strategic region escalation event_${i}_${j}`,
          severity: Math.random(),
          countryCode: ['RU', 'UA', 'CN', 'US', 'IR', 'IL'][Math.floor(Math.random() * 6)],
          timestamp,
        })),
        avgGoldsteinScore: -2 - Math.random() * 5,
      },
      sanctions: {
        count: sanctionsCount,
        recentCount: sanctionsCount,
      },
      radiation: {
        max: radiationMax,
        sites: { moscow: radiationMax * (0.8 + Math.random() * 0.4) },
      },
      delta: {
        newAlerts,
        escalatedAlerts,
      },
      energy: {
        oilPrice: 70 + (vix - 20) * 0.5 + (Math.random() - 0.5) * 3,
      },
      gold: {
        price: 1900 + (vix - 20) * 5 + (Math.random() - 0.5) * 20,
      },
      dxy: {
        value: 100 + (vix - 20) * 0.2 + (Math.random() - 0.5) * 0.5,
      },
    });
  }

  return history;
}

// === SETUP / TEARDOWN ===

function setupTestEnvironment(history) {
  if (!existsSync(RUNS_DIR)) mkdirSync(RUNS_DIR, { recursive: true });
  if (!existsSync(MEMORY_DIR)) mkdirSync(MEMORY_DIR, { recursive: true });
  if (!existsSync(PRED_DIR)) mkdirSync(PRED_DIR, { recursive: true });

  // Записываем историю
  writeFileSync(join(RUNS_DIR, 'history.json'), JSON.stringify(history, null, 2));

  // Создаём фиктивные memory-файлы
  for (let i = 0; i < Math.min(history.length, 20); i++) {
    writeFileSync(
      join(MEMORY_DIR, `sweep_${String(i).padStart(4, '0')}.json`),
      JSON.stringify(history[i])
    );
  }
}

function teardownTestEnvironment() {
  // Очищаем созданные файлы прогнозов
  if (existsSync(PRED_DIR)) {
    try {
      const files = ['latest_forecast.json', 'forecast_tracker.json',
                     'active_learner.json', 'meta_ensemble.json',
                     'attention_state.json', 'adversarial_coevolution.json',
                     'temporal_causal.json'];
      for (const f of files) {
        const fp = join(PRED_DIR, f);
        if (existsSync(fp)) rmSync(fp);
      }
    } catch (e) {
      console.warn('[teardown] Error:', e.message);
    }
  }
}

// === TEST SUITE ===

describe('Integration: Full Prediction Pipeline (Phases A-M)', () => {
  let runForecastPipeline;
  let history;

  before(async () => {
    // Импорт динамический -- чтобы тесты не падали при отсутствии WASM
    const engineModule = await import('../../apis/predict/engine.mjs');
    runForecastPipeline = engineModule.runForecastPipeline || engineModule.default;

    history = generateSyntheticHistory(60);
    setupTestEnvironment(history);
  });

  after(() => {
    teardownTestEnvironment();
  });

  // === TEST 1: Полный пайплайн без ошибок ===

  it('запускает полный пайплайн A-M без исключений', async () => {
    const latest = history[history.length - 1];

    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
      skipExplainability: false,
      skipKnowledgeGraph: false,
    });

    assert.ok(result, 'Pipeline returned null');
    assert.ok(typeof result === 'object', 'Result is not object');
    assert.ok(result.timestamp, 'Missing timestamp');
    assert.ok(result.version, 'Missing version');
    assert.ok(typeof result.elapsedMs === 'number', 'Missing elapsedMs');
  });

  // === TEST 2: Все обязательные поля присутствуют ===

  it('содержит все обязательные поля верхнего уровня', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    const requiredFields = [
      'timestamp', 'version', 'elapsedMs', 'events',
      'summary', 'systemState', 'models', 'advanced',
      'sources', 'calibration', 'topRisks',
    ];

    for (const field of requiredFields) {
      assert.ok(field in result, `Missing required field: ${field}`);
    }
  });

  // === TEST 3: Фаза J -- Temporal Causal ===

  it('фаза J: temporal causal produces valid output', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    const tc = result.temporalCausal;
    if (tc) {
      assert.ok(Array.isArray(tc.shiftDetections), 'shiftDetections not array');
      assert.ok(typeof tc.totalEvents === 'number', 'totalEvents not number');
      if (tc.vulnerabilityWindow) {
        assert.ok(tc.vulnerabilityWindow.vulnerability >= 0 &&
                  tc.vulnerabilityWindow.vulnerability <= 1,
          `vulnerability out of [0,1]: ${tc.vulnerabilityWindow.vulnerability}`);
        assert.ok(['low', 'medium', 'high', 'critical'].includes(tc.vulnerabilityWindow.level),
          `invalid vulnerability level: ${tc.vulnerabilityWindow.level}`);
      }
    }
  });

  // === TEST 4: Фаза J -- Multi-Layer Causal ===

  it('фаза J: multi-layer causal produces valid graph', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    const ml = result.multiLayerCausal;
    if (ml) {
      assert.ok(ml.graphStats, 'Missing graphStats');
      assert.ok(ml.graphStats.nodeCount > 0, 'No nodes in graph');
      assert.ok(ml.graphStats.layerCount === 4,
        `Expected 4 layers, got ${ml.graphStats.layerCount}`);

      if (ml.propagation) {
        assert.ok(typeof ml.propagation.totalUpdates === 'number');
        assert.ok(typeof ml.propagation.crossLayerUpdates === 'number');
        assert.ok(ml.propagation.crossLayerUpdates <= ml.propagation.totalUpdates,
          'crossLayerUpdates > totalUpdates');
      }
    }
  });

  // === TEST 5: Фаза K -- Narrative Warfare ===

  it('фаза K: narrative warfare detects campaigns', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    const nw = result.narrativeWarfare;
    if (nw && nw.available) {
      assert.ok(typeof nw.totalPosts === 'number');
      assert.ok(typeof nw.threatLevel === 'number');
      assert.ok(nw.threatLevel >= 0 && nw.threatLevel <= 1);
      assert.ok(Array.isArray(nw.campaigns));
      assert.ok(['КРИТИЧНО', 'ВЫСОКО', 'СРЕДНЕ', 'НИЗКО'].includes(nw.assessment),
        `Invalid assessment: ${nw.assessment}`);
    }
  });

  // === TEST 6: Фаза K -- Resource Exhaustion ===

  it('фаза K: resource exhaustion produces valid forecasts', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    const re = result.resourceExhaustion;
    if (re) {
      assert.ok(re.military, 'Missing military');
      assert.ok(re.economic, 'Missing economic');
      assert.ok(['stable', 'warning', 'urgent', 'critical'].includes(re.overallStatus),
        `Invalid overallStatus: ${re.overallStatus}`);
      assert.ok(re.overallPressure >= 0 && re.overallPressure <= 1,
        `overallPressure out of [0,1]: ${re.overallPressure}`);
    }
  });

  // === TEST 7: Фаза L -- Meta-Ensemble ===

  it('фаза L: meta-ensemble produces valid weights', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: false,
      skipAdvancedContagion: true,
    });

    const me = result.metaEnsemble;
    if (me) {
      assert.ok(me.currentRegime, 'Missing currentRegime');
      assert.ok(['calm', 'normal', 'elevated', 'crisis'].includes(me.currentRegime),
        `Invalid regime: ${me.currentRegime}`);

      if (me.modelWeights) {
        const weights = Object.values(me.modelWeights);
        const sum = weights.reduce((a, b) => a + b, 0);
        assert.ok(Math.abs(sum - 1) < 1e-3,
          `Model weights don't sum to 1: ${sum}`);

        for (const w of weights) {
          assert.ok(w >= 0 && w <= 1, `Weight out of [0,1]: ${w}`);
        }
      }
    }
  });

  // === TEST 8: Фаза M -- Hypergraph Contagion ===

  it('фаза M: hypergraph contagion computes activations', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    const hg = result.hypergraphContagion;
    if (hg) {
      assert.ok(hg.stats, 'Missing stats');
      assert.ok(hg.stats.nodeCount > 0, 'No nodes');
      assert.ok(hg.stats.hyperedgeCount > 0, 'No hyperedges');
      assert.ok(Array.isArray(hg.hyperedges), 'hyperedges not array');
      assert.ok(Array.isArray(hg.updates), 'updates not array');

      // Проверка: все гиперрёбра имеют 3+ узла
      for (const he of hg.hyperedges) {
        assert.ok(he.nodes.length >= 3,
          `Hyperedge ${he.id} has only ${he.nodes.length} nodes (min 3)`);
      }
    }
  });

  // === TEST 9: Фаза M -- Attention Dynamics ===

  it('фаза M: attention dynamics tracks topics', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    const ad = result.attentionDynamics;
    if (ad) {
      assert.ok(typeof ad.totalTopics === 'number', 'totalTopics not number');
      assert.ok(typeof ad.totalAttention === 'number', 'totalAttention not number');
      assert.ok(Array.isArray(ad.shifts), 'shifts not array');
      assert.ok(Array.isArray(ad.topExplosive), 'topExplosive not array');

      // Проверка: attention non-negative
      if (ad.attentionAllocation) {
        for (const [topic, data] of Object.entries(ad.attentionAllocation)) {
          assert.ok(data.attention >= 0,
            `Topic ${topic} has negative attention: ${data.attention}`);
          assert.ok(data.share >= 0 && data.share <= 1,
            `Topic ${topic} has invalid share: ${data.share}`);
        }
      }
    }
  });

  // === TEST 10: Фаза M -- Adversarial Co-evolution ===

  it('фаза M: adversarial co-evolution models opponents', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    const ace = result.adversarialCoEvolution;
    if (ace) {
      assert.ok(typeof ace.opponentsCount === 'number', 'opponentsCount not number');
      assert.ok(Array.isArray(ace.adaptations), 'adaptations not array');
      assert.ok(typeof ace.keyInsight === 'string', 'keyInsight not string');
      assert.ok(ace.keyInsight.length > 0, 'keyInsight empty');

      for (const a of ace.adaptations) {
        assert.ok(a.opponent, 'Missing opponent id');
        assert.ok(a.adaptation, 'Missing adaptation');
        assert.ok(typeof a.adaptation.adapted === 'boolean',
          `adapted not boolean: ${a.adaptation.adapted}`);
      }
    }
  });

  // === TEST 11: Кросс-проверка J+K+L+M ===

  it('все фазы J, K, L, M работают согласованно', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    const phaseResults = {
      temporalCausal: !!result.temporalCausal,
      multiLayerCausal: !!result.multiLayerCausal,
      narrativeWarfare: !!result.narrativeWarfare,
      resourceExhaustion: !!result.resourceExhaustion,
      metaEnsemble: !!result.metaEnsemble,
      hypergraphContagion: !!result.hypergraphContagion,
      attentionDynamics: !!result.attentionDynamics,
      adversarialCoEvolution: !!result.adversarialCoEvolution,
    };

    const presentCount = Object.values(phaseResults).filter(Boolean).length;
    assert.ok(presentCount >= 5,
      `Too few phases present: ${presentCount}/8`);

    if (result.topRisks && result.topRisks.length > 1) {
      for (let i = 1; i < result.topRisks.length; i++) {
        assert.ok(result.topRisks[i - 1].probability >= result.topRisks[i].probability,
          `Top risks not sorted: ${result.topRisks[i - 1].probability} < ${result.topRisks[i].probability}`);
      }
    }

    if (result.events) {
      for (const [id, evt] of Object.entries(result.events)) {
        const prob = evt.metaProbability ?? evt.calibratedProbability ?? evt.ensemble;
        if (typeof prob === 'number') {
          assert.ok(prob >= 0 && prob <= 1,
            `Event ${id} has invalid probability: ${prob}`);
          assert.ok(!isNaN(prob), `Event ${id} probability is NaN`);
        }
      }
    }
  });

  // === TEST 12: Идемпотентность ===

  it('идемпотентен при повторном запуске на тех же данных', async () => {
    const latest = history[history.length - 1];

    const result1 = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: true,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    const result2 = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: true,
      skipTemporalCausal: true,
      skipWarfareExhaustion: true,
      skipMetaScenarios: true,
      skipAdvancedContagion: true,
    });

    assert.deepStrictEqual(
      Object.keys(result1).sort(),
      Object.keys(result2).sort(),
      'Schema differs between runs'
    );

    assert.deepStrictEqual(
      Object.keys(result1.events || {}).sort(),
      Object.keys(result2.events || {}).sort(),
      'Event keys differ between runs'
    );
  });

  // === TEST 13: Graceful degradation при падении модуля ===

  it('graceful degradation: не падает при отсутствии history', async () => {
    const historyPath = join(RUNS_DIR, 'history.json');
    const backup = readFileSync(historyPath, 'utf-8');
    writeFileSync(historyPath, '[]');

    try {
      const latest = history[history.length - 1];

      const result = await runForecastPipeline(latest, {
        skipSources: true,
        skipAdvanced: false,
        skipTemporalCausal: false,
        skipWarfareExhaustion: false,
        skipMetaScenarios: true,
        skipAdvancedContagion: false,
      });

      assert.ok(result, 'Pipeline crashed with empty history');
      assert.ok(result.timestamp, 'Missing timestamp');

      const tc = result.temporalCausal;
      if (tc) {
        assert.ok(tc.available === false || tc.totalEvents >= 0,
          'Temporal causal did not gracefully handle empty history');
      }
    } finally {
      writeFileSync(historyPath, backup);
    }
  });

  // === TEST 14: Производительность ===

  it('выполняется за разумное время (< 30 сек)', async () => {
    const latest = history[history.length - 1];

    const start = Date.now();
    await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });
    const elapsed = Date.now() - start;

    assert.ok(elapsed < 30000,
      `Pipeline took ${elapsed}ms (> 30s)`);

    console.log(`[perf] Full pipeline (J+K+L+M) took ${elapsed}ms`);
  });

  // === TEST 15: Согласованность top risks с composite ===

  it('top risks согласованы с composite risk', async () => {
    const latest = history[history.length - 1];
    const result = await runForecastPipeline(latest, {
      skipSources: true,
      skipAdvanced: false,
      skipTemporalCausal: false,
      skipWarfareExhaustion: false,
      skipMetaScenarios: true,
      skipAdvancedContagion: false,
    });

    if (result.topRisks?.length > 0 && result.compositeRisk) {
      const topRisk = result.topRisks[0];
      assert.ok(topRisk.probability >= 0 && topRisk.probability <= 1,
        `Top risk probability out of [0,1]: ${topRisk.probability}`);

      if (topRisk.probability > 0.5 && result.compositeRisk.composite !== undefined) {
        assert.ok(result.compositeRisk.composite > 0.2,
          `Top risk ${topRisk.probability} but composite ${result.compositeRisk.composite}`);
      }
    }
  });
});
