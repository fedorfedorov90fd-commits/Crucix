// tests/catalog/catalog_pack_a.test.mjs

import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PRED = join(__dirname, '..', '..', 'apis', 'predict');

const mcmcMod = await import(join(PRED, 'models', 'mcmc.mjs'));
const physMod = await import(join(PRED, 'models', 'physics_inspired.mjs'));
const amlMod = await import(join(PRED, 'automl.mjs'));
const anomMod = await import(join(PRED, 'anomaly_detection.mjs'));

function makeHistory(n) {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: new Date(Date.now() - (n - i) * 15 * 60 * 1000).toISOString(),
    fred: {
      vix: 20 + Math.sin(i / 4) * 10,
      hySpread: 3 + Math.cos(i / 5) * 1.5,
      treasury10y: 4 + Math.sin(i / 6) * 0.5,
      dxy: 100 + Math.cos(i / 7) * 3,
    },
    gdelt: {
      conflictEvents: Array(Math.floor(Math.abs(Math.sin(i / 3)) * 10) + 1).fill({}),
      tone: -1 + Math.sin(i / 6),
    },
    sanctions: { count: Math.floor(Math.abs(Math.cos(i / 4)) * 5) },
    tension: 0.4 + Math.sin(i / 4) * 0.3,
    radiation: { max: 50 + Math.random() * 30 },
    energy: { oilPrice: 70 + Math.sin(i / 3) * 10 },
    gold: { price: 1900 + Math.cos(i / 4) * 100 },
  }));
}

function isFiniteNum(x) { return typeof x === 'number' && Number.isFinite(x); }

describe('catalog pack A: smoke loading', () => {
  test('mcmc exports', () => {
    assert.ok(mcmcMod.MetropolisHastings);
    assert.ok(mcmcMod.AdaptiveMetropolisHastings);
    assert.ok(mcmcMod.GibbsSampler);
    assert.ok(mcmcMod.HamiltonianMC);
    assert.ok(mcmcMod.HierarchicalBetaBinomial);
    assert.ok(mcmcMod.DiagnosticSuite);
    assert.ok(mcmcMod.PoissonRegressionMCMC);
    assert.ok(mcmcMod.LogisticRegressionMCMC);
    assert.ok(mcmcMod.ChangePointMCMC);
    assert.equal(typeof mcmcMod.crucixMCMC, 'function');
  });

  test('physics_inspired exports', () => {
    assert.ok(physMod.Sandpile);
    assert.ok(physMod.Percolation);
    assert.ok(physMod.FoldCatastrophe);
    assert.ok(physMod.CuspCatastrophe);
    assert.ok(physMod.SwallowtailCatastrophe);
    assert.ok(physMod.ButterflyCatastrophe);
    assert.equal(typeof physMod.takensEmbedding, 'function');
    assert.equal(typeof physMod.largestLyapunov, 'function');
    assert.equal(typeof physMod.correlationDimension, 'function');
    assert.equal(typeof physMod.recurrencePlot, 'function');
    assert.equal(typeof physMod.crucixPhysicsInspired, 'function');
  });

  test('automl exports', () => {
    assert.ok(amlMod.GaussianProcess);
    assert.ok(amlMod.BayesianOptimizer);
    assert.ok(amlMod.AutoML);
    assert.ok(amlMod.LinearRegressor);
    assert.ok(amlMod.SimpleMLP);
    assert.equal(typeof amlMod.crucixAutoML, 'function');
  });

  test('anomaly_detection exports', () => {
    assert.ok(anomMod.IsolationForest);
    assert.ok(anomMod.LocalOutlierFactor);
    assert.ok(anomMod.MahalanobisDetector);
    assert.ok(anomMod.OneClassSVM);
    assert.ok(anomMod.DBSCANOutlier);
    assert.ok(anomMod.AnomalyEnsemble);
    assert.equal(typeof anomMod.crucixAnomalyDetection, 'function');
  });
});

describe('mcmc: functional', () => {
  test('insufficient history', () => {
    const r = mcmcMod.crucixMCMC([], {});
    assert.equal(r.available, false);
    assert.equal(r.reason, 'insufficient_history');
  });

  test('works on 25 sweeps', () => {
    const h = makeHistory(25);
    const r = mcmcMod.crucixMCMC(h, { poissonIterations: 500, logisticIterations: 500, changePointIterations: 500 });
    assert.equal(r.available, true);
    assert.equal(r.module, 'mcmc');
    assert.ok(isFiniteNum(r.elapsedMs));
  });

  test('MetropolisHastings on standard normal', () => {
    const mh = new mcmcMod.MetropolisHastings({
      logPosterior: (theta) => -0.5 * theta[0] * theta[0],
      propose: (theta) => [theta[0] + (Math.random() * 2 - 1) * 0.5],
      initial: [0],
      nIterations: 500,
      burnIn: 100,
      thin: 2,
    });
    const res = mh.run();
    assert.ok(res.samples.length > 0);
    assert.ok(isFiniteNum(res.acceptanceRate));
    assert.ok(res.acceptanceRate > 0 && res.acceptanceRate < 1);
  });

  test('DiagnosticSuite.summary on samples', () => {
    const samples = Array.from({ length: 200 }, () => [Math.random(), Math.random() * 2]);
    const s = mcmcMod.DiagnosticSuite.summary(samples);
    assert.equal(s.length, 2);
    assert.ok(isFiniteNum(s[0].mean));
    assert.ok(isFiniteNum(s[0].std));
  });

  test('HierarchicalBetaBinomial fitMoments', () => {
    const regions = [
      { id: 'A', n: 100, y: 20 },
      { id: 'B', n: 50, y: 15 },
      { id: 'C', n: 200, y: 30 },
    ];
    const hbb = new mcmcMod.HierarchicalBetaBinomial({ regions });
    hbb.fitMoments();
    assert.ok(isFiniteNum(hbb.posteriorAlpha));
    assert.ok(isFiniteNum(hbb.posteriorBeta));
    const posts = hbb.getPosteriors();
    assert.equal(posts.length, 3);
    assert.ok(isFiniteNum(posts[0].posteriorMean));
  });
});

describe('physics_inspired: functional', () => {
  test('insufficient history', () => {
    const r = physMod.crucixPhysicsInspired([], {});
    assert.equal(r.available, false);
  });

  test('works on 25 sweeps', () => {
    const h = makeHistory(25);
    const r = physMod.crucixPhysicsInspired(h, {
      soc: { N: 15, nGrains: 500 },
      percolation: { N: 25 },
    });
    assert.equal(r.available, true);
    assert.equal(r.module, 'physics_inspired');
    assert.ok(r.soc);
    assert.ok(r.percolation);
    assert.ok(r.catastrophe);
    assert.ok(r.chaos);
  });

  test('Sandpile produces avalanches', () => {
    const sp = new physMod.Sandpile({ N: 10 });
    sp.simulate(200, 50);
    assert.ok(sp.avalanches.length > 0);
    assert.ok(sp.totalTopplings > 0);
  });

  test('CuspCatastrophe discriminant', () => {
    const cusp = new physMod.CuspCatastrophe(-1, 0);
    // a=-1, b=0 → 4a³ + 27b² = -4 < 0 → inside fold
    assert.equal(cusp.isInsideFold(), true);
    const eq = cusp.equilibria();
    assert.ok(eq.length >= 2);
    assert.ok(eq.every(isFiniteNum));
  });

  test('largestLyapunov on chaotic series', () => {
    const series = Array.from({ length: 100 }, (_, i) => {
      let x = 0.1 + i * 0.01;
      return Math.sin(x * 10) * Math.exp(-x * 0.1) + Math.random() * 0.05;
    });
    const lyap = physMod.largestLyapunov(series, { m: 3, tau: 1 });
    assert.ok('lambda' in lyap || 'error' in lyap);
    if ('lambda' in lyap) {
      assert.ok(isFiniteNum(lyap.lambda));
    }
  });

  test('takensEmbedding dimension check', () => {
    const series = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const emb = physMod.takensEmbedding(series, 3, 1);
    assert.equal(emb.length, 8);
    assert.equal(emb[0].length, 3);
  });
});

describe('automl: functional', () => {
  test('insufficient history', () => {
    const r = amlMod.crucixAutoML([], {});
    assert.equal(r.available, false);
  });

  test('works on 35 sweeps', () => {
    const h = makeHistory(35);
    const r = amlMod.crucixAutoML(h, {});
    assert.equal(r.available, true);
    assert.equal(r.module, 'automl');
    assert.ok(Array.isArray(r.models));
    assert.ok(r.leaderboard);
  });

  test('LinearRegressor fits simple data', () => {
    const X = [[1], [2], [3], [4], [5]];
    const y = [[2], [4], [6], [8], [10]];
    const lr = new amlMod.LinearRegressor({ lambda: 0.01 });
    lr.fit(X, y);
    const pred = lr.predict([[6]]);
    assert.ok(isFiniteNum(pred[0][0]));
    assert.ok(Math.abs(pred[0][0] - 12) < 1);
  });

  test('GaussianProcess predicts finite', () => {
    const gp = new amlMod.GaussianProcess({});
    const X = [[0], [1], [2], [3]];
    const y = [0, 1, 4, 9];
    gp.fit(X, y);
    const p = gp.predictOne([1.5]);
    assert.ok(isFiniteNum(p.mean));
    assert.ok(isFiniteNum(p.variance));
    assert.ok(p.variance >= 0);
  });
});

describe('anomaly_detection: functional', () => {
  test('insufficient history', () => {
    const r = anomMod.crucixAnomalyDetection([], {});
    assert.equal(r.available, false);
  });

  test('works on 25 sweeps', () => {
    const h = makeHistory(25);
    const r = anomMod.crucixAnomalyDetection(h, {});
    assert.equal(r.available, true);
    assert.equal(r.module, 'anomaly_detection');
    assert.ok(r.summary);
    assert.ok(isFiniteNum(r.summary.nAnomalies));
    assert.ok(r.lastSweep);
    assert.ok(typeof r.lastSweep.isAnomaly === 'boolean');
  });

  test('IsolationForest on random vs outlier', () => {
    const X = Array.from({ length: 100 }, () => [Math.random(), Math.random()]);
    const iforest = new anomMod.IsolationForest({ nTrees: 20, contamination: 0.05 });
    iforest.fit(X);
    const normal = iforest.predictOne([0.5, 0.5]);
    const outlier = iforest.predictOne([10, 10]);
    assert.ok(outlier.score > normal.score);
  });

  test('MahalanobisDetector returns finite distance', () => {
    const X = Array.from({ length: 50 }, () => [Math.random(), Math.random()]);
    const md = new anomMod.MahalanobisDetector({ contamination: 0.1 });
    md.fit(X);
    const r = md.predictOne([0.5, 0.5]);
    assert.ok(isFiniteNum(r.distance));
    assert.ok(typeof r.isAnomaly === 'boolean');
  });
});
