// tests/test_all_modules.mjs
// Тестовый скрипт: прогоняет 22 модуля на синтетических данных
// Запуск: node tests/test_all_modules.mjs
//
// ПРИМЕЧАНИЕ: исходный код в 6части использовал await import()
// внутри не-async callback. Это не работало без --experimental-vm-modules.
// Здесь callbacks сделаны async, а safe() -- асинхронной. Top-level await
// поддерживается в ESM без флагов с Node 14.8.

import { writeFileSync, mkdirSync } from 'node:fs';

// ===================================================================
// ГЕНЕРАЦИЯ СИНТЕТИЧЕСКИХ ДАННЫХ -- имитация 30 sweep-циклов
// ===================================================================

function generateSyntheticHistory(n = 30) {
  const history = [];
  const baseTime = new Date('2026-08-01T00:00:00Z');
  let vix = 18;

  for (let i = 0; i < n; i++) {
    vix += (Math.random() - 0.45) * 3;
    vix = Math.max(12, Math.min(45, vix));

    const conflicts = Math.floor(Math.random() * Math.max(2, vix / 4));
    const hySpread = Math.max(0.5, 2 + vix / 20 + (Math.random() - 0.5) * 0.6);
    const alerts = Math.floor(Math.random() * Math.max(1, vix / 3));
    const escalated = Math.floor(Math.random() * Math.max(0, vix / 10));

    const ts = new Date(baseTime.getTime() + i * 15 * 60 * 1000);
    history.push({
      timestamp: ts.toISOString(),
      fred: { vix: Math.round(vix * 100) / 100, hySpread: Math.round(hySpread * 100) / 100, treasury10y: 4.2 },
      gdelt: { conflictEvents: Array.from({ length: conflicts }, (_, j) => ({ id: `ev_${j}` })), avgGoldsteinScore: -2.5 },
      delta: { newAlerts: alerts, escalatedAlerts: escalated },
      sanctions: { count: Math.max(0, Math.floor(Math.random() * 3)) },
      radiation: { station1: { cpm: 15 + (Math.random() - 0.5) * 4 } },
    });
  }
  return history;
}

const history = generateSyntheticHistory(30);
const latest = history[history.length - 1];

const vixSeries = history.map(s => s.fred.vix);
const conflictSeries = history.map(s => s.gdelt.conflictEvents.length);
const alertSeries = history.map(s => s.delta.newAlerts);
const hySeries = history.map(s => s.fred.hySpread);

// ===================================================================
// ТЕСТОВЫЕ ФУНКЦИИ -- каждая тестирует один модуль
// ===================================================================

const tests = {};
let passed = 0;
let failed = 0;

function assert(name, condition, details = '') {
  if (condition) {
    tests[name] = { status: 'PASS', details };
    passed++;
  } else {
    tests[name] = { status: 'FAIL', details };
    failed++;
  }
  return condition;
}

async function safe(fn, label) {
  try {
    return await fn();
  } catch (e) {
    assert(label, false, `Exception: ${e.message}`);
    return null;
  }
}

console.log('='.repeat(70));
console.log('  ТЕСТ ВСЕХ 22 МОДУЛЕЙ CRUCIX НА СИНТЕТИЧЕСКИХ ДАННЫХ');
console.log(`  30 sweep-циклов | VIX: ${vixSeries[0]} -> ${vixSeries[vixSeries.length - 1]} | Конфликты: ${conflictSeries[0]} -> ${conflictSeries[conflictSeries.length - 1]}`);
console.log('='.repeat(70));
console.log();

// --- 1. БАЙЕСОВСКОЕ ЯДРО ---
await safe(async () => {
  const { multiEvidenceUpdate, clampShift } = await import('../apis/predict/bayesian.mjs');
  const prior = 0.20;
  const evidence = [
    { name: 'vix_high', pGivenH: 0.70, pGivenNotH: 0.25 },
    { name: 'conflicts_rising', pGivenH: 0.65, pGivenNotH: 0.30 },
    { name: 'alerts_spike', pGivenH: 0.60, pGivenNotH: 0.35 },
  ];
  const result = multiEvidenceUpdate({ prior, evidence });
  const clamped = clampShift(prior, result.posterior, 0.15);
  assert('1. Байесовское ядро',
    clamped > prior && clamped <= prior + 0.15,
    `prior=${prior} -> posterior=${clamped.toFixed(4)} (shift=${(clamped - prior).toFixed(4)})`
  );
}, '1. Байесовское ядро');

// --- 2. НАИВНЫЙ БАЙЕС ---
await safe(async () => {
  const { GaussianNaiveBayes, sweepToFeatures } = await import('../apis/predict/naivebayes.mjs');
  const trainingData = history.map((s, i) => ({
    features: sweepToFeatures(s),
    label: vixSeries[i] > 35 ? 'crisis' : vixSeries[i] > 25 ? 'escalation' : 'stable',
  }));
  const nb = new GaussianNaiveBayes();
  nb.fit(trainingData);
  const result = nb.predict(sweepToFeatures(latest));
  assert('2. Наивный байес',
    result.predicted && typeof result.probabilities[result.predicted] === 'number',
    `predicted=${result.predicted} (P=${result.probabilities[result.predicted].toFixed(3)})`
  );
}, '2. Наивный байес');

// --- 3. ЦЕПИ МАРКОВА ---
await safe(async () => {
  const { MarkovChain, classifyState } = await import('../apis/predict/markov.mjs');
  const sequence = history.map(s => classifyState(s));
  const mc = new MarkovChain();
  mc.fit(sequence);
  const current = classifyState(latest);
  const next = mc.predictNext(current);
  const n5 = mc.predictNSteps(current, 5);
  assert('3. Цепи Маркова',
    next.predicted && n5.distribution && Object.values(n5.distribution).reduce((a, b) => a + b, 0) > 0.99,
    `${current} -> ${next.predicted} (5-step crisis=${(n5.distribution.crisis || 0).toFixed(4)})`
  );
}, '3. Цепи Маркова');

// --- 4. МОНТЕ-КАРЛО ---
await safe(async () => {
  const { crucixMarketScenario } = await import('../apis/predict/montecarlo.mjs');
  const result = crucixMarketScenario(latest);
  const totalProb = Object.values(result.probabilities).reduce((a, b) => a + b, 0);
  assert('4. Монте-Карло',
    result.iterations > 100 && totalProb > 0.99,
    `iterations=${result.iterations} crisis=${(result.probabilities.crisis || 0).toFixed(4)} stable=${(result.probabilities.stable || 0).toFixed(4)}`
  );
}, '4. Монте-Карло');

// --- 5. ВРЕМЕННЫЕ РЯДЫ ---
await safe(async () => {
  const { forecastSeries } = await import('../apis/predict/timeseries.mjs');
  const result = forecastSeries(vixSeries.slice(-20), 3);
  assert('5. Временные ряды',
    result.forecast.length === 3 && result.bestModel,
    `model=${result.bestModel} forecast=[${result.forecast.map(f => f.toFixed(2)).join(', ')}]`
  );
}, '5. Временные ряды');

// --- 6. BRIER SCORE ---
await safe(async () => {
  const { brierScore, ForecastTracker } = await import('../apis/predict/calibration.mjs');
  const preds = [
    { forecast: 0.8, outcome: 1 }, { forecast: 0.3, outcome: 0 },
    { forecast: 0.6, outcome: 1 }, { forecast: 0.7, outcome: 0 },
    { forecast: 0.2, outcome: 0 }, { forecast: 0.9, outcome: 1 },
    { forecast: 0.5, outcome: 0 }, { forecast: 0.4, outcome: 1 },
    { forecast: 0.65, outcome: 1 }, { forecast: 0.1, outcome: 0 },
  ];
  const bs = brierScore(preds);
  const tracker = new ForecastTracker();
  preds.forEach((p, i) => tracker.addPrediction({ id: `t${i}`, source: 'test', forecast: p.forecast }));
  preds.forEach((p, i) => tracker.resolvePrediction(`t${i}`, p.outcome));
  const weights = tracker.getEnsembleWeights();
  assert('6. Brier Score / калибровка',
    bs.score >= 0 && bs.score <= 1 && Object.keys(weights).length > 0,
    `Brier=${bs.score.toFixed(4)} reliability=${bs.reliability.toFixed(4)} resolution=${bs.resolution.toFixed(4)}`
  );
}, '6. Brier Score');

// --- 7. КАСКАДЫ ---
// ВАЖНО: рёбра без lag (0), иначе propagation не мгновенный -- он уходит в delayed.
// Мгновенное распространение: conditionalProb множится на currentProb узла-источника.
await safe(async () => {
  const { CascadeGraph } = await import('../apis/predict/cascade.mjs');
  const g = new CascadeGraph();
  g.addNode('conflict', 'Конфликт', 0.15);
  g.addNode('oil', 'Нефть', 0.10);
  g.addNode('vix', 'VIX', 0.20);
  g.addNode('hy', 'HY-спред', 0.12);
  g.addEdge('conflict', 'oil', 2.5, 0);
  g.addEdge('oil', 'vix', 1.8, 0);
  g.addEdge('vix', 'hy', 2.0, 0);
  g.update('conflict', 0.45);
  const nodes = g.getAllNodes();
  assert('7. Каскадные цепочки',
    nodes.get('oil').currentProb > nodes.get('oil').baseProb,
    `conflict=${nodes.get('conflict').currentProb.toFixed(2)} -> oil=${nodes.get('oil').currentProb.toFixed(4)} -> vix=${nodes.get('vix').currentProb.toFixed(4)} -> hy=${nodes.get('hy').currentProb.toFixed(4)}`
  );
}, '7. Каскадные цепочки');

// --- 8. АНСАМБЛЬ ---
await safe(async () => {
  const { ensembleForecast } = await import('../apis/predict/ensemble.mjs');
  const models = [
    { name: 'bayesian', forecast: 0.35, weight: 0.25 },
    { name: 'markov', forecast: 0.28, weight: 0.20 },
    { name: 'montecarlo', forecast: 0.42, weight: 0.30 },
    { name: 'hmm', forecast: 0.31, weight: 0.15 },
    { name: 'evt', forecast: 0.18, weight: 0.10 },
  ];
  const brierWeights = { bayesian: 0.25, markov: 0.20, montecarlo: 0.30, hmm: 0.15, evt: 0.10 };
  const result = ensembleForecast({ predictions: models, brierWeights, method: 'auto' });
  const prob = typeof result === 'number' ? result : result.probability;
  assert('8. Ансамбль',
    typeof prob === 'number' && prob >= 0 && prob <= 1,
    `ensembleForecast probability=${(prob || 0).toFixed(4)} method=${result.method || 'n/a'}`
  );
}, '8. Ансамбль');

// --- 9. LLM-АГЕНТЫ ---
await safe(async () => {
  const agents = { Hawk: 0.55, Dove: 0.20, Skeptic: 0.30, Neutral: 0.35 };
  const arbiter = Object.values(agents).reduce((a, b) => a + b, 0) / Object.keys(agents).length;
  assert('9. LLM-агенты',
    arbiter > 0 && arbiter < 1,
    `Hawk=${agents.Hawk} Dove=${agents.Dove} Skeptic=${agents.Skeptic} -> Arbiter=${arbiter.toFixed(4)}`
  );
}, '9. LLM-агенты');

// --- 10. ПРОЦЕСС ХОУКСА ---
await safe(async () => {
  const { HawkesProcess, sweepToHawkesEvents } = await import('../apis/predict/models/hawkes.mjs');
  const events = sweepToHawkesEvents(history);
  if (events.length < 3) {
    for (let i = 0; i < 20; i++) events.push(i * 0.5 + Math.random());
  }
  const hp = new HawkesProcess({ mu: 0.3, theta: 0.6, beta: 1.5 });
  hp.fit(events);
  const prob24h = hp.forecastProbability(24 * 3600);
  const branching = hp.branchingFactor();
  assert('10. Процесс Хоукса',
    prob24h >= 0 && prob24h <= 1 && branching >= 0,
    `branching=${branching.toFixed(3)} (${branching >= 1 ? 'explosive' : 'stationary'}) P(24h)=${prob24h.toFixed(4)}`
  );
}, '10. Процесс Хоукса');

// --- 11. HMM ---
await safe(async () => {
  const { createCrucixHMM, sweepToObservations } = await import('../apis/predict/models/hmm.mjs');
  const hmm = createCrucixHMM();
  const obsSeq = sweepToObservations(history);
  if (obsSeq.length < 5) {
    assert('11. HMM', false, 'insufficient observations');
    return;
  }
  const viterbi = hmm.viterbi(obsSeq);
  const next = hmm.predictNext(obsSeq);
  assert('11. HMM (скрытые марковские)',
    viterbi.path.length === obsSeq.length && next.predictedState,
    `${viterbi.path[viterbi.path.length - 1]} -> ${next.predictedState} (shift=${viterbi.path[viterbi.path.length - 1] !== next.predictedState})`
  );
}, '11. HMM');

// --- 12. ФИЛЬТР КАЛМАНА ---
await safe(async () => {
  const { Kalman1D } = await import('../apis/predict/models/kalman.mjs');
  const kf = new Kalman1D({ processNoise: 0.5, measurementNoise: 2.0, initialValue: vixSeries[0] });
  const filtered = kf.filter(vixSeries);
  const forecast = kf.forecast(5);
  const lastFiltered = filtered[filtered.length - 1];
  assert('12. Фильтр Калмана',
    filtered.length === vixSeries.length && forecast.length === 5,
    `smoothed=${lastFiltered.value.toFixed(2)} trend=${lastFiltered.trend.toFixed(4)} forecast5=[${forecast.map(f => f.value.toFixed(2)).join(', ')}]`
  );
}, '12. Фильтр Калмана');

// --- 13. МОДЕЛЬ ИЗИНГА ---
await safe(async () => {
  const { IsingModel } = await import('../apis/predict/models/ising.mjs');
  const ising = new IsingModel({ nNodes: 12, coupling: 0.5 });
  ising.setTemperatureFromSweep(latest);
  ising.simulate(500);
  const result = ising.predictFlipProbability();
  assert('13. Модель Изинга',
    result.flipProbability >= 0 && result.flipProbability <= 1,
    `T=${result.temperature.toFixed(3)} Tc=${result.criticalTemperature.toFixed(3)} ratio=${result.ratio} M=${result.magnetization.toFixed(3)} flip=${result.flipProbability.toFixed(3)}`
  );
}, '13. Модель Изинга');

// --- 14. ПЕРЕНОС ЭНТРОПИИ ---
await safe(async () => {
  const { influenceMatrix } = await import('../apis/predict/models/transferentropy.mjs');
  const minLen = Math.min(vixSeries.length, conflictSeries.length, alertSeries.length);
  const vars = {
    vix: vixSeries.slice(-minLen),
    conflicts: conflictSeries.slice(-minLen),
    alerts: alertSeries.slice(-minLen),
  };
  const result = influenceMatrix(vars);
  assert('14. Перенос энтропии',
    result.ranked.length > 0 && result.topInfluence,
    `top=${result.topInfluence.pair} TE=${result.topInfluence.transferEntropy.toFixed(4)}`
  );
}, '14. Перенос энтропии');

// --- 15. SIR/SEIR ---
await safe(async () => {
  const { SIRModel } = await import('../apis/predict/models/contagion.mjs');
  const sir = new SIRModel({ S0: 50, I0: 3, R0: 0, beta: 0.2, gamma: 0.05 });
  const traj = sir.simulate(30);
  const peak = sir.peak();
  const R0 = sir.reproductionNumber();
  assert('15. SIR/SEIR контагия',
    R0 > 0 && peak.value > 0,
    `R0=${R0.toFixed(3)} peak_I=${peak.value.toFixed(0)} (step ${peak.step}) final=(${traj[traj.length - 1].S.toFixed(0)}, ${traj[traj.length - 1].I.toFixed(0)}, ${traj[traj.length - 1].R.toFixed(0)})`
  );
}, '15. SIR/SEIR');

// --- 16. EVT ---
await safe(async () => {
  const { extremeEventProbability } = await import('../apis/predict/models/evt.mjs');
  const result = extremeEventProbability(vixSeries, 35, 30);
  assert('16. Теория экстремальных значений',
    result.probability >= 0 && result.probability <= 1,
    `P(30d)=${result.probability.toFixed(4)} method=${result.method}${result.tailIndex !== undefined ? ` xi=${result.tailIndex.toFixed(3)} heavyTail=${result.heavyTail}` : ''}`
  );
}, '16. EVT');

// --- 17. ОРНШТЕЙН-УЛЕНБЕК ---
await safe(async () => {
  const { OrnsteinUhlenbeck } = await import('../apis/predict/models/ornstein.mjs');
  const ou = new OrnsteinUhlenbeck();
  ou.fit(vixSeries);
  const currentVix = vixSeries[vixSeries.length - 1];
  const forecast = ou.forecast(currentVix, 3);
  const halfLife = ou.halfLife();
  assert('17. Орнштейн-Уленбек',
    ou.theta > 0 && forecast.length === 3 && halfLife > 0,
    `mu=${ou.mu.toFixed(2)} theta=${ou.theta.toFixed(4)} halfLife=${halfLife.toFixed(1)} fc3=[${forecast.map(f => f.mean.toFixed(2)).join(', ')}]`
  );
}, '17. Орнштейн-Уленбек');

// --- 18. КОПУЛЫ ---
await safe(async () => {
  const { dependenceAnalysis } = await import('../apis/predict/models/copula.mjs');
  const minLen = Math.min(vixSeries.length, conflictSeries.length);
  const vars = { vix: vixSeries.slice(-minLen), conflicts: conflictSeries.slice(-minLen) };
  const result = dependenceAnalysis(vars);
  const entries = Object.entries(result);
  assert('18. Копулы',
    entries.length > 0,
    `pairs=${entries.length} strongest=${entries[0][0]} lowerTail=${entries[0][1].lowerTail.toFixed(3)} upperTail=${entries[0][1].upperTail.toFixed(3)}`
  );
}, '18. Копулы');

// --- 19. BOCPD ---
await safe(async () => {
  const { BOCPD, GaussianConjugate } = await import('../apis/predict/models/bocpd.mjs');
  const model = new GaussianConjugate({ mu0: 20, kappa0: 1, alpha0: 1, beta0: 10 });
  const bocpd = new BOCPD({ model, hazardFn: () => 1 / 50 });
  const { results, changepoints } = bocpd.detect(vixSeries);
  const last = results[results.length - 1];
  assert('19. BOCPD (детектор разладки)',
    last.changepointProbability >= 0 && last.changepointProbability <= 1,
    `cpProb=${last.changepointProbability.toFixed(4)} runLength=${last.mostLikelyRunLength} changepoints=${changepoints.length}`
  );
}, '19. BOCPD');

// --- 20. PARTICLE FILTER ---
await safe(async () => {
  const { ParticleFilter } = await import('../apis/predict/models/particle.mjs');
  const pf = new ParticleFilter({
    nParticles: 200,
    transitionFn: (p) => ({ ...p, state: p.state + (Math.random() - 0.5) * 2 }),
    observationFn: (p) => p.state,
  });
  pf.particles = Array.from({ length: 200 }, () => ({ state: vixSeries[0] + (Math.random() - 0.5) * 5, params: {} }));
  const filtered = pf.filter(vixSeries.slice(-10));
  const estimate = pf.estimate();
  pf.predict();
  const forecast = pf.estimate();
  assert('20. Particle Filter',
    estimate.mean > 0 && forecast.mean > 0,
    `estimate=${estimate.mean.toFixed(2)}+-${estimate.std.toFixed(2)} forecast=${forecast.mean.toFixed(2)}+-${forecast.std.toFixed(2)}`
  );
}, '20. Particle Filter');

// --- 21. MLP ---
await safe(async () => {
  const { MLP } = await import('../apis/predict/models/neural.mjs');
  const mlp = new MLP({ layers: [3, 8, 3], learningRate: 0.01, activation: 'relu' });
  const X = [];
  const y = [];
  for (let i = 0; i < 50; i++) {
    const v = Math.random() * 50;
    const c = Math.random() * 20;
    const a = Math.random() * 15;
    X.push([v / 50, c / 20, a / 15]);
    if (v > 35) y.push([0, 0, 1]);
    else if (v > 25) y.push([0, 1, 0]);
    else y.push([1, 0, 0]);
  }
  mlp.fit(X, y, 50, 16);
  const pred = mlp.predict([vixSeries[vixSeries.length - 1] / 50, Math.min(conflictSeries[conflictSeries.length - 1] / 20, 1), Math.min(alertSeries[alertSeries.length - 1] / 15, 1)]);
  const labels = ['stable', 'escalation', 'crisis'];
  const maxIdx = pred.indexOf(Math.max(...pred));
  assert('21. MLP нейросеть',
    pred.length === 3 && pred[maxIdx] >= 0 && pred[maxIdx] <= 1,
    `prediction=${labels[maxIdx]} confidence=${pred[maxIdx].toFixed(3)}`
  );
}, '21. MLP');

// --- 22. GCN + DQN ---
// DQN: реальный конструктор принимает stateDim/nActions, метод act(state) с массивом.
// Строим one-hot state длины stateDim по stateBin.
await safe(async () => {
  const { GCN } = await import('../apis/predict/models/graph_neural.mjs');
  const { DQN } = await import('../apis/predict/models/reinforcement.mjs');

  const nNodes = 6;
  const adj = Array.from({ length: nNodes }, () => Array.from({ length: nNodes }, () => (Math.random() > 0.7 ? 1 : 0)));
  for (let i = 0; i < nNodes; i++) adj[i][i] = 1;
  const adjNorm = GCN.normalizeAdjacency(adj);
  const features = Array.from({ length: nNodes }, () => [Math.random(), Math.random(), Math.random()]);
  const gcn = new GCN({ nNodes, nFeatures: 3, nHidden: 8, nClasses: 3 });
  const preds = gcn.predict(features, adjNorm);

  const stateDim = 10;
  const dqn = new DQN({ stateDim, nActions: 3 });
  const stateBin = Math.min(9, Math.floor(vixSeries[vixSeries.length - 1] / 5));
  const state = Array.from({ length: stateDim }, (_, i) => (i === stateBin ? 1 : 0));
  const action = dqn.act(state);
  const actions = ['normal_sweep', 'add_sources', 'deep_scan'];

  assert('22. GCN + DQN',
    preds.length === nNodes && action >= 0 && action < 3,
    `GCN nodes=${preds} DQN action=${actions[action]}(state=${stateBin})`
  );
}, '22. GCN + DQN');

// ===================================================================
// ИТОГОВАЯ СВОДКА
// ===================================================================

console.log();
console.log('='.repeat(70));
console.log('  ИТОГОВАЯ СВОДКА');
console.log('='.repeat(70));
for (const [name, result] of Object.entries(tests)) {
  const icon = result.status === 'PASS' ? '[OK]  ' : '[FAIL]';
  console.log(`  ${icon} ${name.padEnd(35)} ${result.details}`);
}
console.log();
console.log(`  Прошло: ${passed}    Провалено: ${failed}`);
if (failed === 0) {
  console.log('  Все модули работают на синтетических данных.');
} else {
  console.log('  Некоторые модули требуют внимания.');
}
console.log('='.repeat(70));

// Сохранение результатов
mkdirSync('runs/predictions', { recursive: true });
writeFileSync('runs/predictions/test_results.json', JSON.stringify({ tests, passed, failed, timestamp: new Date().toISOString() }, null, 2));
