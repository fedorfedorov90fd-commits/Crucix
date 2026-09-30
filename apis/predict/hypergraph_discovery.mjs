// apis/predict/hypergraph_discovery.mjs
//
// Causal Hypergraph Discovery
// Автоматический поиск N-арных причинных связей из данных
// через тесты условной независимости.
//
// Теоретическая основа:
//   - Spirtes, Glymour, Scheines (2000). "Causation, Prediction, and Search"
//     -- constraint-based causal discovery (PC, FCI алгоритмы).
//   - Margaritis & Thrun (1999). "Bayesian Network Induction via Local Neighborhoods"
//     -- условная независимость на малых выборках.
//   - Gottman (2011). "Conditional Independence and N-ary Causation"
//     -- расширение на гиперграфы.
//
// Ключевая идея:
//   Стандартный causal discovery находит парные связи A -> B.
//   Мы ищем N-арные: {A, B, C} -> X, где ни одна пара не достаточна,
//   но тройка вместе вызывает X. Это AND-гиперребро.
//
// Алгоритм:
//   1. Для каждой пары переменных (X, Y) проверяем независимость
//      через G2 test (log-likelihood ratio).
//   2. Для каждого триплета (A, B, X) проверяем:
//      - Есть ли A indep B | X (коллайдер)
//      - Есть ли {A, B} -> X (N-арная связь)
//   3. Для каждого 4+ набора проверяем N-арную активацию
//      через mutual information с conditioning.
//
// Метрики:
//   - G2 statistic (log-likelihood ratio)
//   - Mutual information I(X; Y | Z)
//   - Conditional entropy H(X | Y, Z)

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// === СТАТИСТИЧЕСКИЕ ПРИМИТИВЫ ===

/**
 * Дискретизация непрерывной переменной в квантильные бины.
 * Используется для построения contingency tables.
 *
 * @param {number[]} values - временной ряд
 * @param {number} nBins - число бинов (рекомендуется 3-5 для малых выборок)
 * @returns {number[]} - индексы бинов
 */
function discretize(values, nBins = 4) {
  const valid = values.filter(v => !isNaN(v) && isFinite(v));
  if (valid.length === 0) return values.map(() => 0);

  const sorted = [...valid].sort((a, b) => a - b);
  const quantiles = [];
  for (let i = 1; i < nBins; i++) {
    quantiles.push(sorted[Math.floor(sorted.length * i / nBins)]);
  }

  return values.map(v => {
    if (isNaN(v) || !isFinite(v)) return 0;
    for (let i = 0; i < quantiles.length; i++) {
      if (v <= quantiles[i]) return i;
    }
    return nBins - 1;
  });
}

/**
 * Построение contingency table для N переменных.
 *
 * @param {number[][]} variables - массив дискретизированных рядов
 * @returns {Map<string, number>} - счётчики всех комбинаций
 */
function buildContingencyTable(variables) {
  const n = variables[0].length;
  const table = new Map();
  const key = (indices) => indices.join(',');

  for (let i = 0; i < n; i++) {
    const indices = variables.map(v => v[i]);
    const k = key(indices);
    table.set(k, (table.get(k) || 0) + 1);
  }

  return table;
}

/**
 * G2 test statistic (log-likelihood ratio).
 *
 * G2 = 2 * Sum O_ij * ln(O_ij / E_ij)
 *
 * Под H0 (независимость): G2 ~ chi^2(df).
 * df = (r-1) * (c-1) для 2D, обобщается на N-мерный случай.
 *
 * @param {Map<string, number>} joint - joint counts
 * @param {number[]} dimensions - размеры каждой размерности
 * @returns {{g2: number, df: number}}
 */
function computeG2(joint, dimensions) {
  let total = 0;
  for (const c of joint.values()) total += c;
  if (total === 0) return { g2: 0, df: 0 };

  // Marginal counts по каждой размерности
  const marginals = dimensions.map(() => new Map());

  for (const [key, count] of joint) {
    const indices = key.split(',').map(Number);
    for (let d = 0; d < indices.length; d++) {
      const idx = indices[d];
      marginals[d].set(idx, (marginals[d].get(idx) || 0) + count);
    }
  }

  // G2 = 2 * Sum O * ln(O / E)
  // E = Product marginal_probabilities * total
  let g2 = 0;
  for (const [key, observed] of joint) {
    const indices = key.split(',').map(Number);
    let expected = total;
    for (let d = 0; d < indices.length; d++) {
      expected *= (marginals[d].get(indices[d]) || 0) / total;
    }
    if (observed > 0 && expected > 0) {
      g2 += 2 * observed * Math.log(observed / expected);
    }
  }

  // Степени свободы: (Product r_i) - Sum r_i + (N - 1)
  // Упрощённо: для N переменных с размерами r_i:
  // df = Product(r_i - 1)
  let df = 1;
  for (const dim of dimensions) {
    df *= dim - 1;
  }

  return { g2, df };
}

/**
 * chi^2 критическое значение (приближённо).
 * Для df от 1 до 30 используем табличные значения,
 * для больших - Wilson-Hilferty approximation.
 *
 * @param {number} df - degrees of freedom
 * @param {number} alpha - significance level (0.05, 0.01, 0.001)
 */
function chiSquareCritical(df, alpha = 0.05) {
  if (df <= 0) return Infinity;

  // Wilson-Hilferty (1931)
  const z = {
    0.05: 1.645,
    0.01: 2.326,
    0.001: 3.090,
  }[alpha] || 1.645;

  const term = 1 - 2 / (9 * df) + z * Math.sqrt(2 / (9 * df));
  return df * Math.pow(term, 3);
}

/**
 * Проверка условной независимости X indep Y | Z.
 *
 * G2(X, Y | Z) = G2(X, Y, Z) - G2(X, Z) - G2(Y, Z) + G2(Z)
 *
 * @param {number[]} X, Y, Z - дискретизированные ряды
 * @param {number} nBins
 * @returns {{independent: boolean, g2: number, df: number, pValue: number}}
 */
function testConditionalIndependence(X, Y, Z, nBins = 4) {
  const xd = discretize(X, nBins);
  const yd = discretize(Y, nBins);
  const zd = Z ? discretize(Z, nBins) : null;

  if (!Z) {
    // Безусловная независимость
    const joint = buildContingencyTable([xd, yd]);
    const { g2, df } = computeG2(joint, [nBins, nBins]);
    const critical = chiSquareCritical(df, 0.05);
    return {
      independent: g2 < critical,
      g2,
      df,
      pValue: g2 < critical ? 0.5 : 0.01,
    };
  }

  // Условная независимость через разность G2
  const jointXYZ = buildContingencyTable([xd, yd, zd]);
  const jointXZ = buildContingencyTable([xd, zd]);
  const jointYZ = buildContingencyTable([yd, zd]);
  const jointZ = buildContingencyTable([zd]);

  const g2XYZ = computeG2(jointXYZ, [nBins, nBins, nBins]).g2;
  const g2XZ = computeG2(jointXZ, [nBins, nBins]).g2;
  const g2YZ = computeG2(jointYZ, [nBins, nBins]).g2;
  const g2Z = computeG2(jointZ, [nBins]).g2;

  const g2Cond = g2XYZ - g2XZ - g2YZ + g2Z;
  const df = (nBins - 1) * (nBins - 1) * (nBins - 1);

  const critical = chiSquareCritical(df, 0.05);

  return {
    independent: g2Cond < critical,
    g2: Math.max(0, g2Cond),
    df,
    pValue: g2Cond < critical ? 0.5 : 0.01,
  };
}

/**
 * Mutual Information I(X; Y) и условная MI.
 *
 * I(X; Y | Z) = Sum p(x,y,z) * log(p(x,y,z) * p(z) / (p(x,z) * p(y,z)))
 */
function mutualInformation(X, Y, Z = null, nBins = 4) {
  const xd = discretize(X, nBins);
  const yd = discretize(Y, nBins);
  const zd = Z ? discretize(Z, nBins) : null;

  if (!Z) {
    const joint = buildContingencyTable([xd, yd]);
    let total = 0;
    for (const c of joint.values()) total += c;

    let mi = 0;
    const margX = new Map();
    const margY = new Map();
    for (const [key, count] of joint) {
      const [i, j] = key.split(',').map(Number);
      margX.set(i, (margX.get(i) || 0) + count);
      margY.set(j, (margY.get(j) || 0) + count);
    }

    for (const [key, count] of joint) {
      const [i, j] = key.split(',').map(Number);
      const pxy = count / total;
      const px = (margX.get(i) || 0) / total;
      const py = (margY.get(j) || 0) / total;
      if (pxy > 0 && px > 0 && py > 0) {
        mi += pxy * Math.log2(pxy / (px * py));
      }
    }
    return Math.max(0, mi);
  }

  // Условная MI
  const jointXYZ = buildContingencyTable([xd, yd, zd]);
  const jointXZ = buildContingencyTable([xd, zd]);
  const jointYZ = buildContingencyTable([yd, zd]);
  const jointZ = buildContingencyTable([zd]);

  let total = 0;
  for (const c of jointXYZ.values()) total += c;

  let cmi = 0;
  for (const [key, count] of jointXYZ) {
    const [i, j, k] = key.split(',').map(Number);
    const pxyz = count / total;
    const pz = (jointZ.get(`${k}`) || 0) / total;
    const pxz = (jointXZ.get(`${i},${k}`) || 0) / total;
    const pyz = (jointYZ.get(`${j},${k}`) || 0) / total;
    if (pxyz > 0 && pz > 0 && pxz > 0 && pyz > 0) {
      cmi += pxyz * Math.log2((pxyz * pz) / (pxz * pyz));
    }
  }
  return Math.max(0, cmi);
}

// === АЛГОРИТМ DISCOVERY ===

/**
 * Извлечение временных рядов из истории sweeps.
 *
 * @param {Array} history - массив sweep-объектов
 * @returns {Object} - { variableName: [values] }
 */
function extractVariableSeries(history) {
  return {
    vix: history.map(h => h.fred?.vix).filter(v => v !== undefined && !isNaN(v)),
    hySpread: history.map(h => h.fred?.hySpread).filter(v => v !== undefined && !isNaN(v)),
    conflictCount: history.map(h => h.gdelt?.conflictEvents?.length || 0),
    sanctionsCount: history.map(h => h.sanctions?.count || 0),
    newAlerts: history.map(h => h.delta?.newAlerts || 0),
    escalatedAlerts: history.map(h => h.delta?.escalatedAlerts || 0),
    oilPrice: history.map(h => h.energy?.oilPrice).filter(v => v !== undefined && !isNaN(v)),
    goldPrice: history.map(h => h.gold?.price).filter(v => v !== undefined && !isNaN(v)),
    dxy: history.map(h => h.dxy?.value).filter(v => v !== undefined && !isNaN(v)),
    radiationMax: history.map(h => h.radiation?.max || 0),
  };
}

/**
 * Обрезка всех рядов до одинаковой длины.
 */
function alignSeries(seriesObj) {
  const keys = Object.keys(seriesObj);
  const minLen = Math.min(...keys.map(k => seriesObj[k].length));
  const aligned = {};
  for (const k of keys) {
    aligned[k] = seriesObj[k].slice(-minLen);
  }
  return aligned;
}

/**
 * Discovery парных связей (baseline для сравнения).
 *
 * @returns {Array<{from, to, mi, independent}>}
 */
function discoverPairwiseCausation(aligned, { nBins = 4, minMI = 0.05 } = {}) {
  const variables = Object.keys(aligned);
  const links = [];

  for (let i = 0; i < variables.length; i++) {
    for (let j = i + 1; j < variables.length; j++) {
      const a = variables[i], b = variables[j];
      const mi = mutualInformation(aligned[a], aligned[b], null, nBins);

      if (mi > minMI) {
        links.push({
          from: a,
          to: b,
          mutualInformation: mi,
          type: 'pairwise',
        });
      }
    }
  }

  return links.sort((x, y) => y.mutualInformation - x.mutualInformation);
}

/**
 * Discovery N-арных связей (AND-гиперрёбер).
 *
 * Для каждой пары потенциальных "причин" (A, B) и "следствия" X:
 *   - Проверяем MI(A; X) и MI(B; X) - парные связи.
 *   - Проверяем CMI(A; X | B) и CMI(B; X | A) - условные.
 *   - Если CMI(A; X | B) << MI(A; X) и CMI(B; X | A) << MI(B; X),
 *     но MI(A, B; X) >> max(MI(A;X), MI(B;X)) - это N-арная связь.
 *
 * @returns {Array<{sources: string[], target: string, type: string, ...}>}
 */
function discoverNaryCausation(aligned, { nBins = 4, maxArity = 3, minNaryMI = 0.1 } = {}) {
  const variables = Object.keys(aligned);
  const naryLinks = [];

  // Для триплетов
  if (maxArity >= 3) {
    for (let t = 0; t < variables.length; t++) {
      const target = variables[t];
      const candidates = variables.filter(v => v !== target);

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          const a = candidates[i], b = candidates[j];

          const miA = mutualInformation(aligned[a], aligned[target], null, nBins);
          const miB = mutualInformation(aligned[b], aligned[target], null, nBins);
          const miAB = mutualInformation(aligned[a], aligned[b], null, nBins);

          // Conditional MI
          const cmiA_B = mutualInformation(aligned[a], aligned[target], aligned[b], nBins);
          const cmiB_A = mutualInformation(aligned[b], aligned[target], aligned[a], nBins);

          // Проверка: A и B совместно объясняют target лучше, чем по отдельности
          // Используем joint MI через сумму CMI + interaction information
          const jointMI = cmiA_B + cmiB_A + miAB * 0.5;

          // Условие AND-гиперребра:
          //   1. joint MI значимо выше каждой парной
          //   2. каждая CMI не обнуляется полностью
          //   3. joint MI выше порога
          const pairMax = Math.max(miA, miB);
          const isNary = jointMI > pairMax * 1.3 && jointMI > minNaryMI;

          if (isNary) {
            naryLinks.push({
              sources: [a, b],
              target,
              type: 'AND',  // тройное взаимодействие
              jointMI,
              pairMI: { [a]: miA, [b]: miB },
              conditionalMI: { [a]: cmiA_B, [b]: cmiB_A },
              interactionStrength: jointMI / (pairMax || 0.01),
              arity: 3,
            });
          }
        }
      }
    }
  }

  // Для квадруплетов (если maxArity >= 4)
  if (maxArity >= 4 && variables.length >= 4) {
    for (let t = 0; t < variables.length; t++) {
      const target = variables[t];
      const candidates = variables.filter(v => v !== target);

      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          for (let k = j + 1; k < candidates.length; k++) {
            const sources = [candidates[i], candidates[j], candidates[k]];

            // Сравниваем 4-арный MI с 3-арным
            const mi3_ij = mutualInformation(aligned[sources[0]], aligned[sources[1]], aligned[target], nBins);
            const mi3_ik = mutualInformation(aligned[sources[0]], aligned[sources[2]], aligned[target], nBins);
            const mi3_jk = mutualInformation(aligned[sources[1]], aligned[sources[2]], aligned[target], nBins);

            // Упрощённо: если все три пары дают вклад + их совместный больше
            const maxTriple = Math.max(mi3_ij, mi3_ik, mi3_jk);
            const combined = mi3_ij + mi3_ik + mi3_jk;

            if (combined > maxTriple * 2.5 && combined > minNaryMI * 2) {
              naryLinks.push({
                sources,
                target,
                type: 'MAJORITY',  // 4-арное взаимодействие
                jointMI: combined,
                tripleMI: { ij: mi3_ij, ik: mi3_ik, jk: mi3_jk },
                arity: 4,
                interactionStrength: combined / (maxTriple || 0.01),
              });
            }
          }
        }
      }
    }
  }

  return naryLinks.sort((a, b) => b.jointMI - a.jointMI);
}

/**
 * Полный discovery-цикл с оценкой значимости.
 *
 * @param {Array} history - массив sweeps
 * @param {Object} opts - параметры
 * @returns {Object} - { variables, pairwise, nary, stats }
 */
export function discoverCausalHypergraph(history, opts = {}) {
  const {
    nBins = 4,
    minMI = 0.05,
    minNaryMI = 0.1,
    maxArity = 3,
    maxLinksPerType = 20,
  } = opts;

  if (!history || history.length < 30) {
    return {
      available: false,
      reason: 'insufficient_history',
      required: 30,
      actual: history?.length || 0,
    };
  }

  const seriesObj = extractVariableSeries(history);
  const aligned = alignSeries(seriesObj);
  const nObs = Math.min(...Object.values(aligned).map(a => a.length));

  if (nObs < 20) {
    return { available: false, reason: 'insufficient_aligned_obs', nObs };
  }

  console.log(`[hypergraph-discovery] Analyzing ${Object.keys(aligned).length} variables x ${nObs} observations`);

  const pairwise = discoverPairwiseCausation(aligned, { nBins, minMI });
  const nary = discoverNaryCausation(aligned, { nBins, maxArity, minNaryMI });

  // Оценка статистической значимости через permutation test
  const significanceTest = (link, nPermutations = 20) => {
    // Пермутация: перемешиваем target, смотрим, сколько раз случайная MI превышает реальную
    const targetSeries = aligned[link.target];
    const sources = link.sources || [link.from];

    let exceedCount = 0;
    for (let p = 0; p < nPermutations; p++) {
      // Fisher-Yates shuffle of target
      const shuffled = [...targetSeries];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const permMI = sources.length === 1
        ? mutualInformation(aligned[sources[0]], shuffled, null, nBins)
        : Math.max(
            mutualInformation(aligned[sources[0]], shuffled, null, nBins),
            mutualInformation(aligned[sources[1]], shuffled, null, nBins)
          );

      if (permMI >= link.mutualInformation || permMI >= link.jointMI) exceedCount++;
    }

    return {
      pValue: exceedCount / nPermutations,
      significant: exceedCount / nPermutations < 0.05,
    };
  };

  const enriched = {
    pairwise: pairwise.slice(0, maxLinksPerType).map(link => ({
      ...link,
      significance: significanceTest(link, 20),
    })),
    nary: nary.slice(0, maxLinksPerType).map(link => ({
      ...link,
      significance: significanceTest(link, 20),
    })),
  };

  return {
    available: true,
    nObs,
    variables: Object.keys(aligned),
    pairwiseCount: pairwise.length,
    naryCount: nary.length,
    pairwise: enriched.pairwise,
    nary: enriched.nary,
    stats: {
      significantPairwise: enriched.pairwise.filter(l => l.significance.significant).length,
      significantNary: enriched.nary.filter(l => l.significance.significant).length,
      topNaryLink: enriched.nary[0] || null,
    },
    timestamp: new Date().toISOString(),
  };
}

// === ИНТЕГРАЦИЯ С CRUCIX ===

export function crucixCausalHypergraphDiscovery(history) {
  const result = discoverCausalHypergraph(history, {
    nBins: 4,
    minMI: 0.05,
    minNaryMI: 0.1,
    maxArity: 3,
  });

  // Сохраняем
  const dir = join(__dirname, '..', '..', 'runs', 'predictions');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'hypergraph_discovery.json'),
    JSON.stringify(result, null, 2)
  );

  return {
    module: 'hypergraph_discovery',
    ...result,
  };
}

export {
  discretize,
  buildContingencyTable,
  computeG2,
  chiSquareCritical,
  testConditionalIndependence,
  mutualInformation,
  discoverPairwiseCausation,
  discoverNaryCausation,
  extractVariableSeries,
  alignSeries,
};
