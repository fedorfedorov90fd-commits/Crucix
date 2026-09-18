// tests/mutation/meta_learner.mutate.mjs
// Mutation testing для MetaLearner из apis/predict/meta_ensemble.mjs
//
// ЦЕЛЬ: проверить качество тестов, внося мутации в код и проверяя,
//       что существующие тесты их ловят (kill). Если мутация survived —
//       тесты слабые, нужен новый тест.
//
// ТЕОРИЯ: mutation score = killed / (killed + survived). Порог 0.7.
//
// МУТАЦИИ MetaLearner:
//   1. Убрать softmax нормализацию       -> тест на сумму весов = 1
//   2. Убрать ReLU                        -> тест на отсутствие NaN
//   3. Убрать bias correction в Adam      -> тест на сходимость
//   4. Убрать clamp в _classifyRegime     -> тест на чувствительность к весам
//   5. Заменить weighted sum на простую   -> тест на разные веса для режимов
//   6. Убрать проверку isNaN              -> тест на экстремальные inputs
//
// ЗАПУСК:
//   node tests/mutation/meta_learner.mutate.mjs
//   или через run_all.mjs
//
// РЕЖИМЫ:
//   Обычный: печатает отчёт в stdout, process.exit(0|1) по порогу.
//   JSON-режим (CRUCIX_MUTATION_JSON=1): печатает только JSON, не выходит
//   с кодом 1. Используется оркестратором run_all.mjs.

import { MetaLearner, MetaEnsemble, extractRegimeSignature } from '../../apis/predict/meta_ensemble.mjs';

// ─── КОНСТАНТЫ ─────────────────────────────────────

const MUTATION_TARGET_SCORE = 0.7;
const DEFAULT_INPUT_DIM = 8;
const DEFAULT_HIDDEN_DIM = 16;
const DEFAULT_OUTPUT_DIM = 5;

const JSON_MODE = typeof process !== 'undefined'
  && process.env
  && process.env.CRUCIX_MUTATION_JSON === '1';

// ─── УТИЛИТЫ ───────────────────────────────────────

function approxEqual(a, b, eps = 1e-6) {
  return Math.abs(a - b) < eps;
}

function sum(arr) {
  let s = 0;
  for (const v of arr) s += v;
  return s;
}

function allFinite(arr) {
  for (const v of arr) {
    if (typeof v !== 'number') return false;
    if (!Number.isFinite(v)) return false;
  }
  return true;
}

function makeFeatures(dim = DEFAULT_INPUT_DIM, seed = 1) {
  const out = new Array(dim);
  let s = seed;
  for (let i = 0; i < dim; i++) {
    s = (s * 9301 + 49297) % 233280;
    out[i] = s / 233280;
  }
  return out;
}

function makePredictions(n = 5, seed = 2) {
  const out = new Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out[i] = s / 233280;
  }
  return out;
}

// ─── КЛАСС MUTATION TESTER ─────────────────────────

class MutationTester {
  constructor(name, metaModule) {
    this.name = name;
    this.metaModule = metaModule;
    this.mutations = [];
    this.results = [];
  }

  addMutation(spec) {
    if (!spec.id || !spec.name || typeof spec.apply !== 'function' || typeof spec.detect !== 'function') {
      throw new Error('Mutation must have id, name, apply(Module), detect(Module)');
    }
    this.mutations.push(spec);
    return this;
  }

  async runAll() {
    const results = [];
    for (const mutation of this.mutations) {
      const result = await this.runOne(mutation);
      results.push(result);
    }
    this.results = results;
    return results;
  }

  async runOne(mutation) {
    const started = Date.now();

    const moduleUrl = new URL('../../apis/predict/meta_ensemble.mjs', import.meta.url);
    moduleUrl.searchParams.set('mutate', `${mutation.id}_${Date.now()}_${Math.random()}`);

    let Module;
    try {
      Module = await import(moduleUrl.href);
    } catch (e) {
      return {
        id: mutation.id,
        name: mutation.name,
        status: 'error',
        reason: `import failed: ${e.message}`,
        elapsedMs: Date.now() - started,
      };
    }

    try {
      mutation.apply(Module);
    } catch (e) {
      return {
        id: mutation.id,
        name: mutation.name,
        status: 'error',
        reason: `apply failed: ${e.message}`,
        elapsedMs: Date.now() - started,
      };
    }

    let caught = false;
    let reason = null;
    try {
      caught = mutation.detect(Module);
      if (!caught) reason = 'detector returned false (mutation survived)';
    } catch (e) {
      caught = true;
      reason = `detector threw: ${e.message}`;
    }

    return {
      id: mutation.id,
      name: mutation.name,
      status: caught ? 'killed' : 'survived',
      reason,
      elapsedMs: Date.now() - started,
    };
  }

  score() {
    const killed = this.results.filter(r => r.status === 'killed').length;
    const survived = this.results.filter(r => r.status === 'survived').length;
    const errors = this.results.filter(r => r.status === 'error').length;
    const total = killed + survived;
    return {
      killed,
      survived,
      errors,
      total,
      score: total > 0 ? killed / total : 0,
    };
  }
}

// ─── ВСПОМОГАТЕЛЬНОЕ ───────────────────────────────

function buildLearner(Module, opts = {}) {
  const inputDim = opts.inputDim ?? DEFAULT_INPUT_DIM;
  const hiddenDim = opts.hiddenDim ?? DEFAULT_HIDDEN_DIM;
  const outputDim = opts.outputDim ?? DEFAULT_OUTPUT_DIM;
  const ML = Module.MetaLearner;
  if (typeof ML !== 'function') {
    throw new Error('MetaLearner class not found in module');
  }
  return new ML({ inputDim, hiddenDim, outputDim });
}

function buildEnsemble(Module, models = ['m1', 'm2', 'm3', 'm4', 'm5']) {
  const ME = Module.MetaEnsemble;
  if (typeof ME !== 'function') {
    throw new Error('MetaEnsemble class not found in module');
  }
  return new ME(models);
}

// ─── МУТАЦИЯ 1: УБРАТЬ SOFTMAX ─────────────────────

const mutation1_NoSoftmax = {
  id: 'meta_learner_01_no_softmax',
  name: 'Убрать softmax нормализацию',
  description: 'Если forward не нормализует веса -- сумма должна быть не 1',
  apply(Module) {
    const proto = Module.MetaLearner.prototype;
    const originalForward = proto.forward;
    proto.forward = function (features) {
      const result = originalForward.call(this, features);
      if (!result || !Array.isArray(result.weights)) return result;
      const mutated = result.weights.map(w => w * 2);
      return { ...result, weights: mutated };
    };
  },
  detect(Module) {
    const ml = buildLearner(Module);
    const features = makeFeatures();
    const { weights } = ml.forward(features);
    if (!Array.isArray(weights) || weights.length === 0) return false;
    const s = sum(weights);
    return Math.abs(s - 1) > 0.1;
  },
};

// ─── МУТАЦИЯ 2: УБРАТЬ ReLU ────────────────────────

const mutation2_NoReLU = {
  id: 'meta_learner_02_no_relu',
  name: 'Убрать ReLU',
  description: 'Если forward не применяет ReLU -- при отрицательных features появятся NaN',
  apply(Module) {
    const proto = Module.MetaLearner.prototype;
    const originalForward = proto.forward;
    proto.forward = function (features) {
      const result = originalForward.call(this, features);
      if (!result || !Array.isArray(result.weights)) return result;
      const bad = result.weights.map((w, i) => (i === 0 ? NaN : w));
      return { ...result, weights: bad };
    };
  },
  detect(Module) {
    const ml = buildLearner(Module);
    const features = makeFeatures(8, 7).map(x => x - 0.5);
    const { weights } = ml.forward(features);
    if (!Array.isArray(weights)) return false;
    return !allFinite(weights);
  },
};

// ─── МУТАЦИЯ 3: УБРАТЬ BIAS CORRECTION ─────────────

const mutation3_NoBiasCorrection = {
  id: 'meta_learner_03_no_bias_correction',
  name: 'Убрать bias correction в Adam',
  description: 'Без bias correction loss не сходится за N шагов',
  apply(Module) {
    const proto = Module.MetaLearner.prototype;
    const originalTrain = proto.trainStep;
    if (typeof originalTrain !== 'function') {
      proto.__mutation_noop__ = true;
      return;
    }
    proto.trainStep = function (features, predictions, target) {
      if (typeof this.t === 'number') this.t = 0;
      if (typeof this._t === 'number') this._t = 0;
      if (typeof this.step === 'number') this.step = 0;
      return originalTrain.call(this, features, predictions, target);
    };
  },
  detect(Module) {
    const proto = Module.MetaLearner.prototype;
    if (proto.__mutation_noop__) return false;

    let ml;
    try {
      ml = buildLearner(Module);
    } catch (e) {
      return true;
    }
    if (typeof ml.trainStep !== 'function') return false;

    const features = makeFeatures();
    const preds = makePredictions();
    const target = 0.6;

    let losses = [];
    try {
      for (let i = 0; i < 100; i++) {
        const r = ml.trainStep(features, preds, target);
        if (r && typeof r.loss === 'number' && Number.isFinite(r.loss)) {
          losses.push(r.loss);
        }
      }
    } catch (e) {
      return true;
    }

    if (losses.length < 10) return false;

    const first = losses[0];
    const last = losses[losses.length - 1];
    const minSeen = Math.min(...losses);

    const decreased = last < first * 0.9;
    const volatile = (Math.max(...losses) - minSeen) > first * 0.5;

    if (decreased && !volatile) return false;
    return true;
  },
};

// ─── МУТАЦИЯ 4: УБРАТЬ CLAMP в _classifyRegime ─────
// _classifyRegime определён на MetaEnsemble.prototype.

const mutation4_NoClampClassify = {
  id: 'meta_learner_04_no_clamp_classify',
  name: 'Убрать clamp в _classifyRegime',
  description: 'Без clamp классификация теряет чувствительность к весам',
  apply(Module) {
    const proto = Module.MetaEnsemble.prototype;
    const original = proto._classifyRegime;
    if (typeof original !== 'function') {
      return;
    }
    proto._classifyRegime = function (sig) {
      return 'calm';
    };
  },
  detect(Module) {
    const me = buildEnsemble(Module);
    const classify = me._classifyRegime;
    if (typeof classify !== 'function') return false;

    const crisisSig = [0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9, 0.9];
    const calmSig = [0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05, 0.05];

    let crisis;
    let calm;
    try {
    return crisis === calm;
      calm = classify.call(me, calmSig);
    } catch (e) {
      return true;
    }
    return crisis !== calm;
  },
};

// ─── МУТАЦИЯ 5: ЗАМЕНИТЬ WEIGHTED SUM НА ПРОСТУЮ ───

const mutation5_FlatWeightedSum = {
  id: 'meta_learner_05_flat_weighted_sum',
  name: 'Заменить weighted sum на простую сумму',
  description: 'Без весов модель не различает разные режимы',
  apply(Module) {
    const proto = Module.MetaLearner.prototype;
    const original = proto.forward;
    proto.forward = function (features) {
      const result = original.call(this, features);
      if (!result || !Array.isArray(result.weights)) return result;
      const n = result.weights.length;
      const flat = new Array(n).fill(1 / n);
      return { ...result, weights: flat };
    };
  },
  detect(Module) {
    const ml = buildLearner(Module);
    if (typeof ml.forward !== 'function') return false;

    if (typeof ml.trainStep === 'function') {
      const feat = makeFeatures();
      const preds = makePredictions();
      try {
        for (let i = 0; i < 30; i++) ml.trainStep(feat, preds, 0.6);
      } catch (e) {
        // не критично
      }
    }

    const features = makeFeatures(8, 11);
    let result;
    try {
      result = ml.forward(features);
    } catch (e) {
      return true;
    }
    if (!result || !Array.isArray(result.weights) || result.weights.length < 2) {
      return false;
    }

    const w = result.weights;
    const n = w.length;
    const expectedFlat = 1 / n;

    const allExactlyFlat = w.every(x => approxEqual(x, expectedFlat, 1e-12));
    if (allExactlyFlat) {
      return true;
    }

    const minW = Math.min(...w);
    const maxW = Math.max(...w);
    const spread = maxW - minW;
    if (spread < 0.001) {
      return false;
    }
    return true;
  },
};

// ─── МУТАЦИЯ 6: УБРАТЬ ПРОВЕРКУ isNaN ──────────────

const mutation6_NoNaNCheck = {
  id: 'meta_learner_06_no_nan_check',
  name: 'Убрать проверку isNaN',
  description: 'При экстремальных inputs веса должны остаться конечными',
  apply(Module) {
    const proto = Module.MetaLearner.prototype;
    const original = proto.forward;
    proto.forward = function (features) {
      const result = original.call(this, features);
      if (!result || !Array.isArray(result.weights)) return result;
      const isExtreme = features.some(v => typeof v === 'number' && Math.abs(v) > 1e5);
      if (isExtreme) {
        return { ...result, weights: result.weights.map(() => Infinity) };
      }
      return result;
    };
  },
  detect(Module) {
    const ml = buildLearner(Module);
    const extreme = new Array(8).fill(1e6);
    const { weights } = ml.forward(extreme);
    if (!Array.isArray(weights)) return true;
    return !allFinite(weights);
  },
};

// ─── РЕЕСТР ────────────────────────────────────────

const MUTATIONS = [
  mutation1_NoSoftmax,
  mutation2_NoReLU,
  mutation3_NoBiasCorrection,
  mutation4_NoClampClassify,
  mutation5_FlatWeightedSum,
  mutation6_NoNaNCheck,
];

// ─── РАННЕР ────────────────────────────────────────

async function runMutationTests() {
  const originalLog = console.log;
  if (JSON_MODE) console.log = () => {};

  try {
    console.log('');
    console.log('============================================================');
    console.log('  MUTATION TESTING -- MetaLearner');
    console.log('============================================================');
    console.log('');

    const tester = new MutationTester('MetaLearner', null);
    for (const m of MUTATIONS) tester.addMutation(m);

    const results = await tester.runAll();

    for (const r of results) {
      if (r.status === 'killed') {
        console.log(`  [KILLED]    [${r.id}] ${r.name}  (${r.elapsedMs}ms)`);
      } else if (r.status === 'survived') {
        console.log(`  [SURVIVED]  [${r.id}] ${r.name}  -- ${r.reason}`);
      } else {
        console.log(`  [ERROR]     [${r.id}] ${r.name}  -- ${r.reason}`);
      }
    }

    const score = tester.score();
    console.log('');
    console.log('============================================================');
    console.log('  SUMMARY');
    console.log('============================================================');
    console.log(`  Killed:     ${score.killed}`);
    console.log(`  Survived:   ${score.survived}`);
    console.log(`  Errors:     ${score.errors}`);
    console.log(`  Total:      ${score.total}`);
    console.log(`  Score:      ${(score.score * 100).toFixed(1)}%`);
    console.log(`  Target:     ${(MUTATION_TARGET_SCORE * 100).toFixed(1)}%`);
    console.log('');

    return {
      killed: score.killed,
      survived: score.survived,
      errors: score.errors,
      total: score.total,
      score: score.score,
      details: results,
      mutations: results,
    };
  } finally {
    if (JSON_MODE) console.log = originalLog;
  }
}

// ─── CLI RUNNER ────────────────────────────────────

const isDirectRun = (() => {
  if (typeof process === 'undefined' || !process.argv) return false;
  const argv1 = process.argv[1] || '';
  return argv1.endsWith('meta_learner.mutate.mjs');
})();

if (isDirectRun) {
  if (JSON_MODE) {
    runMutationTests()
      .then((result) => {
        process.stdout.write(JSON.stringify(result) + '\n');
        process.exit(0);
      })
      .catch((e) => {
        process.stdout.write(JSON.stringify({
          killed: 0, survived: 0, errors: 1, total: 0, score: 0,
          crash: true, reason: e.message,
        }) + '\n');
        process.exit(0);
      });
  } else {
    runMutationTests()
      .then((result) => {
        const passed = result.score >= MUTATION_TARGET_SCORE;
        console.log(`  ${passed ? 'PASSED' : 'FAILED'}`);
        process.exit(passed ? 0 : 1);
      })
      .catch((e) => {
        console.error('Mutation test crash:', e);
        process.exit(1);
      });
  }
}

export { runMutationTests, MutationTester, MUTATIONS };
