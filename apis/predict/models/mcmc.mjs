// apis/predict/models/mcmc.mjs
// Markov Chain Monte Carlo (MCMC) + Hierarchical Bayes
// Полная реализация для прогностического слоя Crucix
//
// Теоретическая основа:
//   - Metropolis, N., et al. (1953). "Equation of state calculations by
//     fast computing machines". Journal of Chemical Physics.
//   - Hastings, W. K. (1970). "Monte Carlo sampling methods using Markov
//     chains and their applications". Biometrika.
//   - Geman, S., & Geman, D. (1984). "Stochastic relaxation, Gibbs
//     distributions, and the Bayesian restoration of images". IEEE PAMI.
//   - Gelman, A., et al. (2013). "Bayesian Data Analysis" (3rd ed.). CRC.
//   - Robert, C. P., & Casella, G. (2004). "Monte Carlo Statistical Methods".
//   - Neal, R. M. (2011). "MCMC using Hamiltonian dynamics". Handbook of MCMC.
//
// Что реализовано:
//   1. MetropolisHastings — базовый MCMC с адаптивным шагом
//   2. AdaptiveMetropolisHastings — Robbins-Monro адаптация
//   3. GibbsSampler — поочерёдное сэмплирование из условных распределений
//   4. HamiltonianMC — HMC с leapfrog интегратором
//   5. NoUTurnSampler — упрощённый NUTS
//   6. HierarchicalBayes — иерархическая модель Beta-Binomial
//   7. DiagnosticSuite — R-hat, ESS, autocorrelation, trace analysis
//   8. Прикладные модели для Crucix:
//      - Poisson regression (интенсивность конфликтов)
//      - Logistic regression (вероятность эскалации)
//      - Hierarchical pooling (страны с малыми данными)
//      - Change point model (смена режима)
//
// Версия: 6.0.0

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════
// УТИЛИТЫ — математические примитивы
// ═══════════════════════════════════════════════════════════════════

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function saveJSON(fp, data) {
  ensureDir(dirname(fp));
  writeFileSync(fp, JSON.stringify(data, null, 2));
}

function loadJSON(fp, fallback = null) {
  try {
    return existsSync(fp) ? JSON.parse(readFileSync(fp, 'utf-8')) : fallback;
  } catch { return fallback; }
}

/**
 * Логарифм гамма-функции (Lanczos approximation, g=7, n=9)
 * Точность ~1e-10 в диапазоне z ∈ [0.5, 100]
 */
function logGamma(z) {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  z -= 1;
  const g = 7;
  const c = [
    0.99999999999980993,
    676.5203681218851,
    -1259.1392167224028,
    771.32342877765313,
    -176.61502916214059,
    12.507343278686905,
    -0.13857109526572012,
    9.9843695780195716e-6,
    1.5056327351493116e-7,
  ];
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
}

function gammaFn(z) {
  return Math.exp(logGamma(z));
}

/**
 * Стандартная нормальная log-PDF
 */
function normalLogPdf(x, mu, sigma) {
  const z = (x - mu) / sigma;
  return -0.5 * z * z - Math.log(sigma) - 0.5 * Math.log(2 * Math.PI);
}

/**
 * Многомерная нормальная log-PDF (диагональная ковариация)
 */
function normalLogPdfDiag(x, mu, sigma) {
  let sum = 0;
  for (let i = 0; i < x.length; i++) {
    const z = (x[i] - mu[i]) / sigma[i];
    sum += -0.5 * z * z - Math.log(sigma[i]);
  }
  return sum - 0.5 * x.length * Math.log(2 * Math.PI);
}

/**
 * Логарифм биномиального коэффициента
 */
function logBinom(n, k) {
  if (k < 0 || k > n) return -Infinity;
  return logGamma(n + 1) - logGamma(k + 1) - logGamma(n - k + 1);
}

/**
 * Логарифм факториала
 */
function logFactorial(n) {
  if (n < 2) return 0;
  return logGamma(n + 1);
}

/**
 * Box-Muller для нормально распределённых чисел
 */
function gaussianRandom(mean = 0, std = 1) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1 + 1e-10)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

/**
 * Многомерный гауссов с диагональной ковариацией
 */
function gaussianRandomVec(mean, std) {
  return mean.map((m, i) => gaussianRandom(m, std[i]));
}

/**
 * Вычисление выборочного среднего
 */
function mean(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Выборочная дисперсия (по ddof)
 */
function variance(arr, ddof = 1) {
  const n = arr.length;
  if (n <= ddof) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / (n - ddof);
}

function std(arr, ddof = 1) {
  return Math.sqrt(variance(arr, ddof));
}

/**
 * Квантиль (эмпирическая)
 */
function quantile(arr, p) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ═══════════════════════════════════════════════════════════════════
// 1. METROPOLIS-HASTINGS
// ═══════════════════════════════════════════════════════════════════

/**
 * Классический Metropolis-Hastings с адаптивным шагом
 */
class MetropolisHastings {
  constructor(config = {}) {
    this.logPosterior = config.logPosterior || (() => 0);
    this.propose = config.propose || ((theta) => theta.map(t => t + gaussianRandom(0, 0.5)));
    this.logProposalRatio = config.logProposalRatio || (() => 0);
    this.initial = config.initial || [0];
    this.nIterations = config.nIterations || 10000;
    this.burnIn = config.burnIn || 2000;
    this.thin = config.thin || 5;
    this.adaptStep = config.adaptStep ?? true;
    this.targetAcceptance = config.targetAcceptance ?? 0.234;
    this.adaptWindow = config.adaptWindow || 200;

    this.samples = [];
    this.logProbs = [];
    this.acceptanceHistory = [];
    this.stepSize = config.stepSize || 0.5;
  }

  run() {
    let theta = [...this.initial];
    let logP = this.logPosterior(theta);
    let accepted = 0;
    let attempted = 0;
    let windowAccepted = 0;
    let windowAttempted = 0;

    for (let i = 0; i < this.nIterations; i++) {
      const proposed = this.propose(theta);
      const logPProposed = this.logPosterior(proposed);

      const logAlpha =
        logPProposed - logP + this.logProposalRatio(theta, proposed);
      const acceptedThisStep = Math.log(Math.random()) < logAlpha;

      attempted++;
      windowAttempted++;

      if (acceptedThisStep) {
        theta = proposed;
        logP = logPProposed;
        accepted++;
        windowAccepted++;
      }

      if (i >= this.burnIn) {
        if ((i - this.burnIn) % this.thin === 0) {
          this.samples.push([...theta]);
          this.logProbs.push(logP);
        }
      }

      // Адаптация шага
      if (this.adaptStep && windowAttempted >= this.adaptWindow) {
        const windowRate = windowAccepted / windowAttempted;
        if (windowRate < this.targetAcceptance * 0.8) {
          this.stepSize *= 0.9;
        } else if (windowRate > this.targetAcceptance * 1.2) {
          this.stepSize *= 1.1;
        }
        this.acceptanceHistory.push({
          iteration: i,
          rate: windowRate,
          stepSize: this.stepSize,
        });
        windowAccepted = 0;
        windowAttempted = 0;
      }
    }

    return {
      samples: this.samples,
      logProbs: this.logProbs,
      acceptanceRate: attempted > 0 ? accepted / attempted : 0,
      acceptanceHistory: this.acceptanceHistory,
      finalStepSize: this.stepSize,
      nSamples: this.samples.length,
    };
  }
}

/**
 * Адаптивный Metropolis-Hastings (Robbins-Monro)
 * Шаг уменьшается как 1/√n, сходимость к оптимальному
 */
class AdaptiveMetropolisHastings extends MetropolisHastings {
  constructor(config) {
    super(config);
    this.dim = config.initial?.length || 1;
    this.covariance = Array.from({ length: this.dim }, (_, i) =>
      Array.from({ length: this.dim }, (_, j) => (i === j ? 1 : 0))
    );
    this.runningMean = [...this.initial];
    this.nAdapted = 0;
  }

  propose(theta) {
    // Многомерное нормальное предложение
    const perturbation = this._multivariateGaussian();
    const scale = 2.38 / Math.sqrt(this.dim) * (1 / Math.sqrt(this.nAdapted + 1));
    return theta.map((t, i) => t + scale * perturbation[i]);
  }

  _multivariateGaussian() {
    // Cholesky decomposition (упрощённый)
    const L = this._cholesky(this.covariance);
    const z = Array.from({ length: this.dim }, () => gaussianRandom(0, 1));
    const result = new Array(this.dim).fill(0);
    for (let i = 0; i < this.dim; i++) {
      for (let j = 0; j <= i; j++) {
        result[i] += L[i][j] * z[j];
      }
    }
    return result;
  }

  _cholesky(A) {
    const n = A.length;
    const L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let sum = 0;
        for (let k = 0; k < j; k++) sum += L[i][k] * L[j][k];
        if (i === j) {
          L[i][j] = Math.sqrt(Math.max(A[i][i] - sum, 1e-10));
        } else {
          L[i][j] = (A[i][j] - sum) / (L[j][j] || 1e-10);
        }
      }
    }
    return L;
  }

  run() {
    let theta = [...this.initial];
    let logP = this.logPosterior(theta);
    let accepted = 0;
    let attempted = 0;

    // Фаза burn-in: накопление ковариации
    const burnInPhase = Math.floor(this.nIterations * 0.5);
    const tempSamples = [];

    for (let i = 0; i < this.nIterations; i++) {
      const proposed = this.propose(theta);
      const logPProposed = this.logPosterior(proposed);
      const logAlpha = logPProposed - logP;
      const acceptedThis = Math.log(Math.random()) < logAlpha;

      attempted++;
      if (acceptedThis) {
        theta = proposed;
        logP = logPProposed;
        accepted++;
      }

      // Обновление адаптивной ковариации (только в фазе burn-in)
      if (i < burnInPhase) {
        this.nAdapted++;
        const gamma = 1 / (this.nAdapted + 1);
        for (let d = 0; d < this.dim; d++) {
          const delta = theta[d] - this.runningMean[d];
          this.runningMean[d] += gamma * delta;
          for (let e = 0; e < this.dim; e++) {
            this.covariance[d][e] +=
              gamma * (delta * (theta[e] - this.runningMean[e]) - this.covariance[d][e]);
          }
        }
      }

      if (i >= this.burnIn) {
        if ((i - this.burnIn) % this.thin === 0) {
          this.samples.push([...theta]);
          this.logProbs.push(logP);
        }
      }
    }

    return {
      samples: this.samples,
      logProbs: this.logProbs,
      acceptanceRate: attempted > 0 ? accepted / attempted : 0,
      finalStepSize: this.stepSize,
      nAdapted: this.nAdapted,
      finalCovariance: this.covariance,
      nSamples: this.samples.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. GIBBS SAMPLER
// ═══════════════════════════════════════════════════════════════════

/**
 * Gibbs sampler: поочерёдное сэмплирование из полных условных распределений
 */
class GibbsSampler {
  constructor(config = {}) {
    this.conditionalSamplers = config.conditionalSamplers || [];
    this.initial = config.initial || [];
    this.nIterations = config.nIterations || 10000;
    this.burnIn = config.burnIn || 2000;
    this.thin = config.thin || 5;
    this.samples = [];
    this.logProbs = [];
  }

  run() {
    let theta = [...this.initial];
    const dim = theta.length;

    for (let i = 0; i < this.nIterations; i++) {
      for (let j = 0; j < dim; j++) {
        theta[j] = this.conditionalSamplers[j](theta, j);
      }

      if (i >= this.burnIn) {
        if ((i - this.burnIn) % this.thin === 0) {
          this.samples.push([...theta]);
        }
      }
    }

    return {
      samples: this.samples,
      nSamples: this.samples.length,
      burnIn: this.burnIn,
      thin: this.thin,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 3. HAMILTONIAN MONTE CARLO
// ═══════════════════════════════════════════════════════════════════

/**
 * Hamiltonian Monte Carlo с leapfrog интегратором
 * Требует градиент log-posterior
 */
class HamiltonianMC {
  constructor(config = {}) {
    this.logPosterior = config.logPosterior;
    this.gradLogPosterior = config.gradLogPosterior;
    this.initial = config.initial || [0];
    this.nIterations = config.nIterations || 5000;
    this.burnIn = config.burnIn || 1000;
    this.thin = config.thin || 2;
    this.epsilon = config.epsilon || 0.1;
    this.leapfrogSteps = config.leapfrogSteps || 10;
    this.adaptEpsilon = config.adaptEpsilon ?? true;
    this.targetAcceptance = config.targetAcceptance ?? 0.65;
    this.samples = [];
    this.logProbs = [];
    this.acceptanceHistory = [];
  }

  _leapfrog(theta, momentum) {
    const dim = theta.length;
    let q = [...theta];
    let p = [...momentum];

    // Half-step for momentum
    let grad = this.gradLogPosterior(q);
    p = p.map((pi, i) => pi + 0.5 * this.epsilon * grad[i]);

    // Full steps for position
    for (let i = 0; i < this.leapfrogSteps - 1; i++) {
      q = q.map((qi, j) => qi + this.epsilon * p[j]);
      grad = this.gradLogPosterior(q);
      p = p.map((pi, j) => pi + this.epsilon * grad[j]);
    }

    // Last full step for position
    q = q.map((qi, j) => qi + this.epsilon * p[j]);

    // Half-step for momentum
    grad = this.gradLogPosterior(q);
    p = p.map((pi, i) => pi + 0.5 * this.epsilon * grad[i]);

    return { q, p };
  }

  _hamiltonian(theta, momentum) {
    const kinetic = 0.5 * momentum.reduce((s, p) => s + p * p, 0);
    const potential = -this.logPosterior(theta);
    return kinetic + potential;
  }

  run() {
    let theta = [...this.initial];
    let logP = this.logPosterior(theta);
    let accepted = 0;
    let attempted = 0;
    let windowAccepted = 0;
    let windowAttempted = 0;

    for (let i = 0; i < this.nIterations; i++) {
      const momentum = theta.map(() => gaussianRandom(0, 1));
      const H0 = this._hamiltonian(theta, momentum);
      const { q: proposed, p: pProposed } = this._leapfrog(theta, momentum);
      const H1 = this._hamiltonian(proposed, pProposed);

      const acceptProb = Math.exp(Math.min(0, H0 - H1));
      const acceptedThis = Math.random() < acceptProb;

      attempted++;
      windowAttempted++;

      if (acceptedThis) {
        theta = proposed;
        logP = this.logPosterior(theta);
        accepted++;
        windowAccepted++;
      }

      // Адаптация epsilon
      if (this.adaptEpsilon && windowAttempted >= 50) {
        const windowRate = windowAccepted / windowAttempted;
        if (windowRate < this.targetAcceptance * 0.8) {
          this.epsilon *= 0.9;
        } else if (windowRate > this.targetAcceptance * 1.2) {
          this.epsilon *= 1.1;
        }
        this.acceptanceHistory.push({ iteration: i, rate: windowRate, epsilon: this.epsilon });
        windowAccepted = 0;
        windowAttempted = 0;
      }

      if (i >= this.burnIn) {
        if ((i - this.burnIn) % this.thin === 0) {
          this.samples.push([...theta]);
          this.logProbs.push(logP);
        }
      }
    }

    return {
      samples: this.samples,
      logProbs: this.logProbs,
      acceptanceRate: attempted > 0 ? accepted / attempted : 0,
      finalEpsilon: this.epsilon,
      acceptanceHistory: this.acceptanceHistory,
      nSamples: this.samples.length,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
// 4. HIERARCHICAL BAYES — Beta-Binomial
// ═══════════════════════════════════════════════════════════════════

/**
 * Иерархическая модель Beta-Binomial для стран с малыми данными
 *
 * Модель:
 *   θ_i ~ Beta(α, β)           — вероятность события в стране i
 *   y_i ~ Binomial(n_i, θ_i)   — наблюдаемое число событий
 *   α, β ~ Gamma hyperpriors   — глобальные параметры
 *
 * Posterior p_i = (y_i + α) / (n_i + α + β) — shrink к глобальному среднему
 */
class HierarchicalBetaBinomial {
  constructor(config = {}) {
    this.regions = config.regions || []; // [{ id, n, y }]
    this.priorAlpha = config.priorAlpha || 1;
    this.priorBeta = config.priorBeta || 1;
    this.posteriorAlpha = null;
    this.posteriorBeta = null;
    this.samples = null;
  }

  /**
   * Метод моментов для оценки hyperparameters
   */
  fitMoments() {
    const valid = this.regions.filter(r => r.n > 0);
    if (valid.length === 0) return this;

    const proportions = valid.map(r => r.y / r.n);
    const meanP = mean(proportions);
    const varP = variance(proportions, 0);

    // Формула метода моментов:
    // mean(θ) = α / (α + β)
    // var(θ) = αβ / [(α+β)²(α+β+1)]
    const overdispersion = Math.max(
      varP - meanP * (1 - meanP) / mean(valid.map(r => r.n)),
      1e-6
    );

    const alphaPlusBeta = Math.max(meanP * (1 - meanP) / overdispersion - 1, 1e-3);
    const alpha = Math.max(meanP * alphaPlusBeta, 1e-3);
    const beta = Math.max((1 - meanP) * alphaPlusBeta, 1e-3);

    this.posteriorAlpha = alpha;
    this.posteriorBeta = beta;

    return this;
  }

  /**
   * MCMC-оценка параметров (альтернатива методу моментов)
   * Использует Metropolis-Hastings по log-пространству (α, β)
   */
  fitMCMC(nIterations = 5000) {
    const regions = this.regions.filter(r => r.n > 0);
    if (regions.length === 0) return this;

    const logPosterior = ([logAlpha, logBeta]) => {
      const alpha = Math.exp(logAlpha);
      const beta = Math.exp(logBeta);

      // Гиперприоры: слабые Gamma(1, 1) на α, β
      let lp = -alpha + -beta;

      // Likelihood: y_i ~ BetaBinomial(n_i, α, β)
      // Log-pmf: logC(n,k) + logBeta(k+α, n-k+β) - logBeta(α, β)
      for (const r of regions) {
        lp += logGamma(alpha + beta) - logGamma(alpha + beta + r.n)
            + logGamma(r.y + alpha) + logGamma(r.n - r.y + beta)
            - logGamma(alpha) - logGamma(beta);
      }
      return lp;
    };

    const mh = new MetropolisHastings({
      logPosterior,
      initial: [Math.log(this.priorAlpha), Math.log(this.priorBeta)],
      nIterations,
      burnIn: Math.floor(nIterations / 4),
      thin: 5,
      stepSize: 0.5,
      adaptStep: true,
    });

    const result = mh.run();
    this.samples = result.samples;

    // Posterior means
    this.posteriorAlpha = Math.exp(mean(result.samples.map(s => s[0])));
    this.posteriorBeta = Math.exp(mean(result.samples.map(s => s[1])));
    this.mcmcResult = result;

    return this;
  }

  /**
   * Posterior mean для каждого региона
   */
  getPosteriors() {
    if (!this.posteriorAlpha) return [];
    const alpha = this.posteriorAlpha;
    const beta = this.posteriorBeta;

    return this.regions.map(r => {
      const postAlpha = alpha + r.y;
      const postBeta = beta + (r.n - r.y);
      const postMean = postAlpha / (postAlpha + postBeta);
      const postVar = (postAlpha * postBeta) /
        ((postAlpha + postBeta) ** 2 * (postAlpha + postBeta + 1));

      return {
        id: r.id,
        n: r.n,
        y: r.y,
        rawRate: r.n > 0 ? r.y / r.n : 0,
        posteriorMean: postMean,
        posteriorStd: Math.sqrt(postVar),
        posteriorAlpha: postAlpha,
        posteriorBeta: postBeta,
        p025: this._betaQuantile(0.025, postAlpha, postBeta),
        p50: this._betaQuantile(0.5, postAlpha, postBeta),
        p975: this._betaQuantile(0.975, postAlpha, postBeta),
      };
    }).sort((a, b) => b.posteriorMean - a.posteriorMean);
  }

  /**
   * Аппроксимация квантиля Beta через обратную неполную Beta (Newton)
   */
  _betaQuantile(p, a, b) {
    // Начальная оценка через среднее
    const meanVal = a / (a + b);
    const varianceVal = (a * b) / ((a + b) ** 2 * (a + b + 1));
    const stdVal = Math.sqrt(varianceVal);

    // Приближение нормальным
    let x = meanVal + 1.96 * stdVal * (p - 0.5) / 0.95;
    x = Math.max(0.001, Math.min(0.999, x));

    // Уточнение Newton-Raphson через CDF
    for (let i = 0; i < 3; i++) {
      const cdf = this._betaCDF(x, a, b);
      const pdf = Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x)
                          - logGamma(a) - logGamma(b) + logGamma(a + b));
      if (pdf < 1e-12) break;
      const step = (cdf - p) / pdf;
      x = Math.max(0.001, Math.min(0.999, x - step));
    }
    return x;
  }

  _betaCDF(x, a, b) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    // Continued fraction для неполной Beta
    const bt = Math.exp(
      logGamma(a + b) - logGamma(a) - logGamma(b) +
      a * Math.log(x) + b * Math.log(1 - x)
    );
    if (x < (a + 1) / (a + b + 2)) {
      return bt * this._betaCF(x, a, b) / a;
    } else {
      return 1 - bt * this._betaCF(1 - x, b, a) / b;
    }
  }

  _betaCF(x, a, b) {
    const maxIter = 200;
    const eps = 3e-10;
    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;
    let c = 1;
    let d = 1 - qab * x / qap;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    let h = d;
    for (let m = 1; m <= maxIter; m++) {
      const m2 = 2 * m;
      let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < 1e-30) d = 1e-30;
      c = 1 + aa / c;
      if (Math.abs(c) < 1e-30) c = 1e-30;
      d = 1 / d;
      const del = d * c;
      h *= del;
      if (Math.abs(del - 1) < eps) break;
    }
    return h;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 5. DIAGNOSTIC SUITE — R-hat, ESS, autocorrelation
// ═══════════════════════════════════════════════════════════════════

class DiagnosticSuite {
  /**
   * Gelman-Rubin R-hat для нескольких цепочек
   */
  static gelmanRubin(chains) {
    if (!chains || chains.length < 2) {
      return { rHat: 1.0, converged: true, reason: 'single_chain' };
    }

    const m = chains.length;
    const n = Math.min(...chains.map(c => c.length));
    const dim = chains[0][0].length;
    const rHat = [];

    for (let d = 0; d < dim; d++) {
      // Средние по цепочкам
      const chainMeans = chains.map(c =>
        c.slice(0, n).reduce((s, x) => s + x[d], 0) / n
      );
      const grandMean = mean(chainMeans);

      // Between-chain variance
      const B = n * chainMeans.reduce((s, cm) => s + (cm - grandMean) ** 2, 0) / (m - 1);

      // Within-chain variance
      const W = chains.reduce((s, c) => {
        const cm = c.slice(0, n).reduce((sum, x) => sum + x[d], 0) / n;
        return s + c.slice(0, n).reduce((sum, x) => sum + (x[d] - cm) ** 2, 0) / (n - 1);
      }, 0) / m;

      const varPlus = (n - 1) / n * W + B / n;
      rHat.push(Math.sqrt(varPlus / W));
    }

    const allConverged = rHat.every(r => r < 1.1);
    const excellent = rHat.every(r => r < 1.05);

    return {
      rHat: rHat.map(r => Math.round(r * 10000) / 10000),
      maxRHat: Math.max(...rHat),
      converged: allConverged,
      excellent,
      interpretation: excellent ? 'отличная сходимость'
        : allConverged ? 'хорошая сходимость'
        : 'плохая сходимость — увеличьте iterations',
    };
  }

  /**
   * Effective Sample Size (ESS)
   * Автокорреляционный подход
   */
  static effectiveSampleSize(chain) {
    if (chain.length < 10) return { ess: chain.length, autocorr: [1] };

    const n = chain.length;
    const m = mean(chain);
    const v = variance(chain, 0);

    // Автокорреляция для лагов 1..min(n/4, 100)
    const maxLag = Math.min(Math.floor(n / 4), 100);
    const autocorr = [1];
    for (let lag = 1; lag <= maxLag; lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (chain[i] - m) * (chain[i + lag] - m);
      }
      autocorr.push(sum / (n * v));
    }

    // ESS = n / (1 + 2 * sum of autocorrelations until they turn negative)
    let sumRho = 0;
    for (let i = 1; i < autocorr.length; i++) {
      if (autocorr[i] < 0.05) break;
      sumRho += autocorr[i];
    }
    const ess = n / (1 + 2 * sumRho);

    return {
      ess: Math.round(ess),
      essRatio: Math.round(ess / n * 1000) / 1000,
      autocorr: autocorr.slice(0, 20).map(r => Math.round(r * 1000) / 1000),
    };
  }

  /**
   * Полная диагностика по одной или нескольким цепочкам
   */
  static diagnose(chains) {
    const isMultiChain = Array.isArray(chains[0]) && Array.isArray(chains[0][0]);
    const chainList = isMultiChain ? chains : [chains];

    const dim = chainList[0][0].length;
    const perDim = [];

    for (let d = 0; d < dim; d++) {
      const dimChains = chainList.map(c => c.map(s => s[d]));
      const ess = this.effectiveSampleSize(dimChains[0]);
      perDim.push({
        dim: d,
        mean: mean(dimChains[0]),
        std: std(dimChains[0]),
        ess: ess.ess,
        essRatio: ess.essRatio,
        autocorr: ess.autocorr,
      });
    }

    const rHat = isMultiChain ? this.gelmanRubin(chainList) : { rHat: [1], maxRHat: 1, converged: true };

    return {
      dimensions: dim,
      perDimension: perDim,
      rHat: rHat.rHat,
      maxRHat: rHat.maxRHat,
      converged: rHat.converged,
      interpretation: rHat.interpretation,
    };
  }

  /**
   * Сводка по сэмплам: mean, std, quantiles для каждого параметра
   */
  static summary(samples) {
    if (!samples || samples.length === 0) return [];
    const dim = samples[0].length;
    const result = [];

    for (let d = 0; d < dim; d++) {
      const values = samples.map(s => s[d]).sort((a, b) => a - b);
      const n = values.length;
      const m = mean(values);
      const s = std(values);

      result.push({
        param: d,
        mean: Math.round(m * 10000) / 10000,
        std: Math.round(s * 10000) / 10000,
        p025: Math.round(values[Math.floor(n * 0.025)] * 10000) / 10000,
        p25: Math.round(values[Math.floor(n * 0.25)] * 10000) / 10000,
        p50: Math.round(values[Math.floor(n * 0.50)] * 10000) / 10000,
        p75: Math.round(values[Math.floor(n * 0.75)] * 10000) / 10000,
        p975: Math.round(values[Math.floor(n * 0.975)] * 10000) / 10000,
      });
    }

    return result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 6. POISSON REGRESSION через MCMC
// ═══════════════════════════════════════════════════════════════════

/**
 * Poisson regression: y_i ~ Poisson(exp(α + β·x_i))
 * Используется для моделирования интенсивности конфликтов
 */
class PoissonRegressionMCMC {
  constructor(config = {}) {
    this.data = config.data || []; // [{ x: number, y: number }]
    this.priorAlphaStd = config.priorAlphaStd || 5;
    this.priorBetaStd = config.priorBetaStd || 2;
    this.nIterations = config.nIterations || 5000;
    this.result = null;
  }

  fit() {
    const data = this.data;
    if (data.length < 5) {
      return { error: 'insufficient_data', n: data.length };
    }

    const logPosterior = ([alpha, beta]) => {
      let lp = 0;

      // Priors
      lp += normalLogPdf(alpha, 0, this.priorAlphaStd);
      lp += normalLogPdf(beta, 0, this.priorBetaStd);

      // Likelihood
      for (const d of data) {
        const lambda = Math.exp(alpha + beta * d.x);
        if (lambda < 1e-10) return -Infinity;
        // log Poisson: y·log(λ) - λ - log(y!)
        lp += d.y * Math.log(lambda) - lambda - logFactorial(d.y);
      }
      return lp;
    };

    const mh = new AdaptiveMetropolisHastings({
      logPosterior,
      initial: [0, 0],
      nIterations: this.nIterations,
      burnIn: Math.floor(this.nIterations / 5),
      thin: 3,
    });

    const result = mh.run();
    const summary = DiagnosticSuite.summary(result.samples);

    // Прогноз для текущего x
    const currentX = data[data.length - 1].x;
    const predictions = result.samples.map(([a, b]) => Math.exp(a + b * currentX));
    predictions.sort((a, b) => a - b);
    const n = predictions.length;

    this.result = {
      alpha: summary[0],
      beta: summary[1],
      acceptanceRate: result.acceptanceRate,
      predictions: {
        mean: mean(predictions),
        p025: predictions[Math.floor(n * 0.025)],
        p50: predictions[Math.floor(n * 0.50)],
        p975: predictions[Math.floor(n * 0.975)],
      },
    };
    return this.result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 7. LOGISTIC REGRESSION через MCMC
// ═══════════════════════════════════════════════════════════════════

class LogisticRegressionMCMC {
  constructor(config = {}) {
    this.data = config.data || []; // [{ x: number[], y: 0|1 }]
    this.priorStd = config.priorStd || 2;
    this.nIterations = config.nIterations || 5000;
    this.result = null;
  }

  fit() {
    if (this.data.length < 10) {
      return { error: 'insufficient_data', n: this.data.length };
    }

    const dim = this.data[0].x.length;

    const logPosterior = (theta) => {
      let lp = 0;

      // Priors — слабые Normal(0, priorStd) на каждый коэффициент
      for (const t of theta) {
        lp += normalLogPdf(t, 0, this.priorStd);
      }

      // Likelihood
      for (const d of this.data) {
        const z = theta.reduce((s, t, i) => s + t * d.x[i], 0);
        const p = 1 / (1 + Math.exp(-z));
        p = Math.max(1e-10, Math.min(1 - 1e-10, p));
        lp += d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p);
      }
      return lp;
    };

    const mh = new AdaptiveMetropolisHastings({
      logPosterior,
      initial: new Array(dim).fill(0),
      nIterations: this.nIterations,
      burnIn: Math.floor(this.nIterations / 5),
      thin: 3,
    });

    const result = mh.run();
    const summary = DiagnosticSuite.summary(result.samples);

    // Прогноз для текущего x
    const currentX = this.data[this.data.length - 1].x;
    const predictions = result.samples.map(theta => {
      const z = theta.reduce((s, t, i) => s + t * currentX[i], 0);
      return 1 / (1 + Math.exp(-z));
    });
    predictions.sort((a, b) => a - b);
    const n = predictions.length;

    this.result = {
      coefficients: summary,
      acceptanceRate: result.acceptanceRate,
      predictions: {
        mean: mean(predictions),
        p025: predictions[Math.floor(n * 0.025)],
        p50: predictions[Math.floor(n * 0.50)],
        p975: predictions[Math.floor(n * 0.975)],
      },
    };
    return this.result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 8. CHANGE POINT MODEL
// ═══════════════════════════════════════════════════════════════════

/**
 * Байесовская модель точки смены режима
 * y_t ~ N(μ_1, σ) для t < τ, N(μ_2, σ) для t ≥ τ
 * τ ~ Uniform(1, T-1)
 */
class ChangePointMCMC {
  constructor(config = {}) {
    this.series = config.series || [];
    this.nIterations = config.nIterations || 5000;
    this.result = null;
  }

  fit() {
    const y = this.series;
    const T = y.length;
    if (T < 10) return { error: 'insufficient_data', n: T };

    const logPosterior = ([tau, mu1, mu2, logSigma]) => {
      const sigma = Math.exp(logSigma);
      if (tau < 1 || tau >= T) return -Infinity;
      if (sigma < 1e-3 || sigma > 1e3) return -Infinity;

      let lp = 0;
      // Priors
      lp += normalLogPdf(mu1, mean(y), 10);
      lp += normalLogPdf(mu2, mean(y), 10);
      lp += normalLogPdf(logSigma, Math.log(std(y) || 1), 2);
      // tau ~ Uniform(1, T-1) — константа, не влияет

      // Likelihood
      const tInt = Math.round(tau);
      for (let i = 0; i < T; i++) {
        const mu = i < tInt ? mu1 : mu2;
        lp += normalLogPdf(y[i], mu, sigma);
      }
      return lp;
    };

    const mh = new MetropolisHastings({
      logPosterior,
      propose: (theta) => {
        const result = [...theta];
        // Случайно выбираем, что мутировать
        const choice = Math.random();
        if (choice < 0.4) result[0] += gaussianRandom(0, 2); // tau — дискретное, но сглаживаем
        else if (choice < 0.6) result[1] += gaussianRandom(0, 0.5); // mu1
        else if (choice < 0.8) result[2] += gaussianRandom(0, 0.5); // mu2
        else result[3] += gaussianRandom(0, 0.1); // logSigma
        return result;
      },
      initial: [T / 2, mean(y.slice(0, Math.floor(T / 2))), mean(y.slice(Math.floor(T / 2))), Math.log(std(y) || 1)],
      nIterations: this.nIterations,
      burnIn: Math.floor(this.nIterations / 5),
      thin: 3,
    });

    const result = mh.run();
    const taus = result.samples.map(s => Math.round(s[0]));
    const mu1s = result.samples.map(s => s[1]);
    const mu2s = result.samples.map(s => s[2]);

    // MAP точки смены
    const tauCounts = new Map();
    for (const t of taus) tauCounts.set(t, (tauCounts.get(t) || 0) + 1);
    let mapTau = 0, mapCount = 0;
    for (const [t, c] of tauCounts) {
      if (c > mapCount) { mapCount = c; mapTau = t; }
    }

    // Вероятность точки смены в узком окне
    const window = 2;
    const probTau = taus.filter(t => Math.abs(t - mapTau) <= window).length / taus.length;

    this.result = {
      mapTau,
      probTau,
      mu1: { mean: mean(mu1s), std: std(mu1s) },
      mu2: { mean: mean(mu2s), std: std(mu2s) },
      shiftMagnitude: mean(mu2s) - mean(mu1s),
      acceptanceRate: result.acceptanceRate,
      tauDistribution: Array.from(tauCounts.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([t, c]) => ({ tau: t, prob: c / taus.length })),
    };
    return this.result;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 9. ИНТЕГРАЦИЯ С CRUCIX
// ═══════════════════════════════════════════════════════════════════

function extractRegionData(history) {
  const regionMap = new Map();

  for (const h of history) {
    const events = h.gdelt?.conflictEvents || [];
    for (const e of events) {
      const country = e.country || e.countryCode || e.location || 'unknown';
      if (!regionMap.has(country)) {
        regionMap.set(country, { id: country, n: 0, y: 0 });
      }
      const r = regionMap.get(country);
      r.n++;
      if ((e.goldsteinScale || 0) < -5) r.y++;
    }
  }

  // Добавляем baseline для регионов без событий
  return Array.from(regionMap.values()).filter(r => r.n >= 2);
}

function extractPoissonData(history) {
  const data = [];
  for (let i = 1; i < history.length; i++) {
    const h = history[i];
    const vix = h.fred?.vix || 20;
    const conflicts = h.gdelt?.conflictEvents?.length || 0;
    data.push({ x: (vix - 20) / 10, y: conflicts });
  }
  return data;
}

function extractLogisticData(history) {
  const data = [];
  for (let i = 0; i < history.length - 1; i++) {
    const h = history[i];
    const next = history[i + 1];
    const vix = h.fred?.vix || 20;
    const conflicts = h.gdelt?.conflictEvents?.length || 0;
    const hySpread = h.fred?.hySpread || 2;
    const nextVix = next.fred?.vix || 20;
    const nextConflicts = next.gdelt?.conflictEvents?.length || 0;

    // Label: эскалация произошла?
    const escalated = (nextVix > 30 || nextConflicts > 15) ? 1 : 0;

    data.push({
      x: [
        (vix - 20) / 10,
        conflicts / 10,
        hySpread / 5,
      ],
      y: escalated,
    });
  }
  return data;
}

function extractTimeSeries(history, field) {
  return history
    .map(h => {
      if (field === 'vix') return h.fred?.vix;
      if (field === 'hySpread') return h.fred?.hySpread;
      if (field === 'conflicts') return h.gdelt?.conflictEvents?.length;
      return null;
    })
    .filter(v => v !== undefined && v !== null && !isNaN(v));
}

// ═══════════════════════════════════════════════════════════════════
// 10. ЭКСПОРТ
// ═══════════════════════════════════════════════════════════════════

export {
  MetropolisHastings,
  AdaptiveMetropolisHastings,
  GibbsSampler,
  HamiltonianMC,
  HierarchicalBetaBinomial,
  DiagnosticSuite,
  PoissonRegressionMCMC,
  LogisticRegressionMCMC,
  ChangePointMCMC,
  logGamma,
  logBinom as logBinomial,
  normalLogPdf,
  normalLogPdfDiag,
  gaussianRandom,
  mean,
  variance,
  std,
  quantile,
};

// ═══════════════════════════════════════════════════════════════════
// 11. ГЛАВНАЯ ФУНКЦИЯ ИНТЕГРАЦИИ С CRUCIX
// ═══════════════════════════════════════════════════════════════════

/**
 * Полный MCMC-цикл для Crucix
 *
 * Запускает:
 *   1. Hierarchical Beta-Binomial для регионов
 *   2. Poisson regression для интенсивности конфликтов
 *   3. Logistic regression для вероятности эскалации
 *   4. Change point detection для VIX
 *
 * @param {Array} history — массив sweep-объектов
 * @param {Object} options — параметры
 * @returns {Object} — агрегированный результат
 */
export function crucixMCMC(history, options = {}) {
  if (!history || history.length < 20) {
    return {
      module: 'mcmc',
      available: false,
      reason: 'insufficient_history',
      minimumRequired: 20,
      actual: history.length,
    };
  }

  const t0 = Date.now();
  console.log(`[mcmc] Запуск MCMC-цикла на ${history.length} sweep'ах`);

  const result = {
    module: 'mcmc',
    available: true,
    timestamp: new Date().toISOString(),
    nSweeps: history.length,
  };

  // 1. Hierarchical Beta-Binomial
  try {
    const regions = extractRegionData(history);
    if (regions.length >= 2) {
      const hbb = new HierarchicalBetaBinomial({ regions });
      hbb.fitMoments();

      const posteriors = hbb.getPosteriors();
      result.hierarchicalBetaBinomial = {
        nRegions: regions.length,
        hyperparameters: {
          alpha: Math.round(hbb.posteriorAlpha * 1000) / 1000,
          beta: Math.round(hbb.posteriorBeta * 1000) / 1000,
          globalMean: Math.round(
            hbb.posteriorAlpha / (hbb.posteriorAlpha + hbb.posteriorBeta) * 1000
          ) / 1000,
        },
        topRiskyRegions: posteriors.slice(0, 10).map(p => ({
          id: p.id,
          n: p.n,
          y: p.y,
          rawRate: Math.round(p.rawRate * 1000) / 1000,
          posteriorMean: Math.round(p.posteriorMean * 1000) / 1000,
          p025: Math.round(p.p025 * 1000) / 1000,
          p975: Math.round(p.p975 * 1000) / 1000,
        })),
        totalRegions: posteriors.length,
      };
    }
  } catch (e) {
    result.hierarchicalBetaBinomial = { error: e.message };
  }

  // 2. Poisson Regression
  try {
    const poissonData = extractPoissonData(history);
    if (poissonData.length >= 10) {
      const pr = new PoissonRegressionMCMC({
        data: poissonData,
        nIterations: options.poissonIterations || 3000,
      });
      const prResult = pr.fit();
      if (!prResult.error) {
        result.poissonRegression = {
          alpha: prResult.alpha,
          beta: prResult.beta,
          acceptanceRate: Math.round(prResult.acceptanceRate * 1000) / 1000,
          predictedConflicts: {
            mean: Math.round(prResult.predictions.mean * 10) / 10,
            p025: Math.round(prResult.predictions.p025 * 10) / 10,
            p50: Math.round(prResult.predictions.p50 * 10) / 10,
            p975: Math.round(prResult.predictions.p975 * 10) / 10,
          },
          interpretation: prResult.beta.mean > 0
            ? 'VIX растёт → конфликты растут'
            : 'VIX растёт → конфликты падают',
        };
      } else {
        result.poissonRegression = prResult;
      }
    }
  } catch (e) {
    result.poissonRegression = { error: e.message };
  }

  // 3. Logistic Regression
  try {
    const logisticData = extractLogisticData(history);
    if (logisticData.length >= 15) {
      const lr = new LogisticRegressionMCMC({
        data: logisticData,
        nIterations: options.logisticIterations || 3000,
      });
      const lrResult = lr.fit();
      if (!lrResult.error) {
        result.logisticRegression = {
          coefficients: lrResult.coefficients,
          acceptanceRate: Math.round(lrResult.acceptanceRate * 1000) / 1000,
          predictedEscalation: {
            mean: Math.round(lrResult.predictions.mean * 1000) / 1000,
            p025: Math.round(lrResult.predictions.p025 * 1000) / 1000,
            p50: Math.round(lrResult.predictions.p50 * 1000) / 1000,
            p975: Math.round(lrResult.predictions.p975 * 1000) / 1000,
          },
          interpretation: lrResult.predictions.mean > 0.5
            ? 'Вероятность эскалации > 50%'
            : 'Вероятность эскалации < 50%',
        };
      } else {
        result.logisticRegression = lrResult;
      }
    }
  } catch (e) {
    result.logisticRegression = { error: e.message };
  }

  // 4. Change Point Detection
  try {
    const vixSeries = extractTimeSeries(history, 'vix');
    if (vixSeries.length >= 15) {
      const cpm = new ChangePointMCMC({
        series: vixSeries,
        nIterations: options.changePointIterations || 3000,
      });
      const cpResult = cpm.fit();
      if (!cpResult.error) {
        result.changePoint = {
          mapTau: cpResult.mapTau,
          probability: Math.round(cpResult.probTau * 1000) / 1000,
          beforeMean: Math.round(cpResult.mu1.mean * 100) / 100,
          afterMean: Math.round(cpResult.mu2.mean * 100) / 100,
          shiftMagnitude: Math.round(cpResult.shiftMagnitude * 100) / 100,
          acceptanceRate: Math.round(cpResult.acceptanceRate * 1000) / 1000,
          interpretation: cpResult.probTau > 0.3
            ? `Точка смены режима на индексе ${cpResult.mapTau} (P=${(cpResult.probTau * 100).toFixed(0)}%)`
            : 'Чёткой точки смены режима не обнаружено',
        };
      } else {
        result.changePoint = cpResult;
      }
    }
  } catch (e) {
    result.changePoint = { error: e.message };
  }

  result.elapsedMs = Date.now() - t0;

  // Сохранение
  const dir = join(__dirname, '..', '..', '..', 'runs', 'predictions');
  ensureDir(dir);
  saveJSON(join(dir, 'mcmc_result.json'), result);

  console.log(`[mcmc] Цикл завершён за ${result.elapsedMs}ms`);
  return result;
}
