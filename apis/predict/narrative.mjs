// apis/predict/narrative.mjs
// Нарративная диффузия: SIR/SEIR-модель распространения идей,
// мутация нарративов, оценка причинного влияния акторов.
//
// Теоретическая основа:
//   Kermack, W. O., & McKendrick, A. G. (1927). "A contribution to the
//   mathematical theory of epidemics". Proc. Royal Society A.
//   Wu, F., & Huberman, B. A. (2007). "Novelty and collective attention".
//   PNAS, 104(45), 17599-17601.
//   Lehmann, J., Goncalves, B., Ramasco, J. J., & Cattuto, C. (2012).
//   "Dynamical classes of collective attention in Twitter". WWW.
//   Granger, C. W. J. (1969). "Investigating Causal Relations by
//   Econometric Models". Econometrica.
//
// Применение в Crucix:
//   Определение, какой нарратив "взорвётся", а какой угаснет.
//   Трекинг мутации нарратива через поляризованные сообщества.
//   Оценка, кто из акторов реально двигает нарратив.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ============================================================
// Токенизация и извлечение нарративов
// ============================================================

function tokenize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function extractNarratives(documents) {
  if (!Array.isArray(documents) || documents.length === 0) return [];

  const vocabulary = new Map();
  const docs = documents.map((doc) => {
    const tokens = tokenize(doc.text || '');
    for (const t of tokens) {
      vocabulary.set(t, (vocabulary.get(t) || 0) + 1);
    }
    return { ...doc, tokens };
  });

  const minFreq = 2;
  const maxFreq = docs.length * 0.8;
  const vocab = [...vocabulary.entries()]
    .filter(([, freq]) => freq >= minFreq && freq <= maxFreq)
    .map(([word]) => word);

  if (vocab.length === 0) return [];

  const tfidfMatrix = docs.map((doc) => computeTFIDF(doc.tokens, vocab, docs));
  const k = Math.min(5, Math.max(2, Math.floor(Math.sqrt(docs.length / 2))));
  const clusters = kmeans(tfidfMatrix, k);

  const narratives = clusters
    .map((cluster, i) => {
      const clusterDocs = cluster.map((idx) => docs[idx]);
      if (clusterDocs.length === 0) return null;
      const topWords = getTopWords(clusterDocs, vocab, 10);
      const sources = [...new Set(clusterDocs.map((d) => d.source || 'unknown'))];

      return {
        id: `narrative_${i}`,
        keywords: topWords,
        documentCount: clusterDocs.length,
        sources,
        firstSeen: clusterDocs[0] ? clusterDocs[0].timestamp : null,
        lastSeen: clusterDocs[clusterDocs.length - 1]
          ? clusterDocs[clusterDocs.length - 1].timestamp
          : null,
        strength: clusterDocs.length / docs.length,
      };
    })
    .filter(Boolean);

  return narratives.filter((n) => n.documentCount >= 2);
}

function computeTFIDF(tokens, vocab, allDocs) {
  const tf = {};
  for (const t of tokens) {
    if (vocab.includes(t)) tf[t] = (tf[t] || 0) + 1;
  }
  const tfidf = {};
  for (const word of vocab) {
    const tfVal = (tf[word] || 0) / Math.max(tokens.length, 1);
    const df = allDocs.filter((d) => d.tokens.includes(word)).length;
    const idf = Math.log(allDocs.length / Math.max(df, 1));
    tfidf[word] = tfVal * idf;
  }
  return tfidf;
}

function kmeans(data, k, maxIter = 50) {
  const dim = data[0] ? Object.keys(data[0]).length : 0;
  if (dim === 0 || data.length === 0) return [];

  const centroids = [];
  for (let i = 0; i < k; i++) {
    centroids.push({ ...data[Math.floor(Math.random() * data.length)] });
  }

  let assignments = Array(data.length).fill(0);

  for (let iter = 0; iter < maxIter; iter++) {
    for (let i = 0; i < data.length; i++) {
      let best = 0, bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        const dist = cosineDistance(data[i], centroids[c]);
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      assignments[i] = best;
    }

    const newCentroids = Array(k).fill(null).map(() => ({}));
    const counts = Array(k).fill(0);
    for (let i = 0; i < data.length; i++) {
      const c = assignments[i];
      counts[c]++;
      for (const [key, val] of Object.entries(data[i])) {
        newCentroids[c][key] = (newCentroids[c][key] || 0) + val;
      }
    }
    for (let c = 0; c < k; c++) {
      if (counts[c] > 0) {
        for (const key of Object.keys(newCentroids[c])) {
          newCentroids[c][key] /= counts[c];
        }
        centroids[c] = newCentroids[c];
      }
    }
  }

  const clusters = Array(k).fill(null).map(() => []);
  for (let i = 0; i < data.length; i++) clusters[assignments[i]].push(i);
  return clusters;
}

function cosineDistance(a, b) {
  let dot = 0, magA = 0, magB = 0;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const va = a[key] || 0;
    const vb = b[key] || 0;
    dot += va * vb;
    magA += va * va;
    magB += vb * vb;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 1 : 1 - dot / denom;
}

function getTopWords(docs, vocab, n) {
  const freq = {};
  for (const doc of docs) {
    for (const t of doc.tokens) {
      if (vocab.includes(t)) freq[t] = (freq[t] || 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

// ============================================================
// SIR-модель для нарратива
// ============================================================

function narrativeSIR({ beta, gamma, S0, I0 = 1, R0 = 0, days = 30 }) {
  let S = S0;
  let I = I0;
  let R = R0;
  const N = S0 + I0 + R0;
  const trajectory = [{ day: 0, S, I, R }];

  for (let d = 1; d <= days; d++) {
    const newInfected = (beta * S * I) / N;
    const newRecovered = gamma * I;
    S = Math.max(0, S - newInfected);
    I = Math.max(0, I + newInfected - newRecovered);
    R = Math.min(N, R + newRecovered);
    trajectory.push({ day: d, S, I, R });
  }

  const R0_eff = beta / gamma;
  const peak = trajectory.reduce((max, p) => (p.I > max.I ? p : max), trajectory[0]);

  return {
    trajectory,
    peak: { day: peak.day, infected: peak.I, spread: peak.I / N },
    R0: R0_eff,
    willSpread: R0_eff > 1,
    totalInfected: trajectory[trajectory.length - 1].R,
    spreadFraction: trajectory[trajectory.length - 1].R / N,
    forecast:
      R0_eff > 1
        ? `Narrative will SPREAD: R0=${R0_eff.toFixed(2)}, peak at day ${peak.day} (${((peak.I / N) * 100).toFixed(1)}% reach)`
        : `Narrative will FADE: R0=${R0_eff.toFixed(2)} < 1`,
  };
}

function narrativeSEIR({ beta, sigma, gamma, S0, E0 = 1, I0 = 0, R0_val = 0, days = 30 }) {
  let S = S0;
  let E = E0;
  let I = I0;
  let R = R0_val;
  const N = S0 + E0 + I0 + R0_val;
  const trajectory = [{ day: 0, S, E, I, R }];

  for (let d = 1; d <= days; d++) {
    const newExposed = (beta * S * I) / N;
    const newInfectious = sigma * E;
    const newRecovered = gamma * I;
    S = Math.max(0, S - newExposed);
    E = Math.max(0, E + newExposed - newInfectious);
    I = Math.max(0, I + newInfectious - newRecovered);
    R = Math.min(N, R + newRecovered);
    trajectory.push({ day: d, S, E, I, R });
  }

  return { trajectory, R0: beta / gamma, latentPeriod: 1 / sigma };
}

// ============================================================
// Мутация нарратива
// ============================================================

function trackNarrativeMutation(narrativeHistory) {
  if (!Array.isArray(narrativeHistory) || narrativeHistory.length < 2) {
    return { mutations: [] };
  }

  const mutations = [];
  for (let i = 1; i < narrativeHistory.length; i++) {
    const prev = narrativeHistory[i - 1];
    const curr = narrativeHistory[i];

    const added = curr.keywords.filter((k) => !prev.keywords.includes(k));
    const removed = prev.keywords.filter((k) => !curr.keywords.includes(k));
    const retained = curr.keywords.filter((k) => prev.keywords.includes(k));

    const mutationRate =
      (added.length + removed.length) /
      Math.max(prev.keywords.length + added.length, 1);

    mutations.push({
      step: i,
      from: prev,
      to: curr,
      addedKeywords: added,
      removedKeywords: removed,
      retainedKeywords: retained,
      mutationRate,
      direction: classifyMutationDirection(added, removed),
    });
  }

  return {
    mutations,
    totalMutationRate:
      mutations.reduce((s, m) => s + m.mutationRate, 0) / mutations.length,
    isMutating: mutations.some((m) => m.mutationRate > 0.3),
  };
}

function classifyMutationDirection(added, removed) {
  const escalationWords = ['attack', 'threat', 'crisis', 'war', 'danger', 'enemy'];
  const deescalationWords = ['peace', 'agreement', 'calm', 'dialogue', 'cooperation'];

  const addedEscalation = added.filter((w) =>
    escalationWords.some((e) => w.includes(e))
  ).length;
  const addedDeescalation = added.filter((w) =>
    deescalationWords.some((e) => w.includes(e))
  ).length;

  if (addedEscalation > addedDeescalation) return 'radicalization';
  if (addedDeescalation > addedEscalation) return 'moderation';
  return 'neutral';
}

// ============================================================
// Granger causality для оценки влияния акторов
// ============================================================

function estimateNarrativeInfluence(actors, narrativeTimeline) {
  const results = {};

  for (const actor of actors) {
    const actorPosts = narrativeTimeline.filter((t) => t.actor === actor.id);
    const otherPosts = narrativeTimeline.filter((t) => t.actor !== actor.id);

    if (actorPosts.length < 3 || otherPosts.length < 3) {
      results[actor.id] = { influence: 0, type: 'insufficient_data' };
      continue;
    }

    const x = actorPosts.map((p) => p.volume || 0);
    const y = otherPosts.map((p) => p.volume || 0);
    const lag = 1;
    const granger = grangerTest(x, y, lag);

    results[actor.id] = {
      influence: granger.fStatistic > 3.0 ? granger.fStatistic / 10 : 0,
      type: granger.fStatistic > 3.0 ? 'driver' : 'amplifier',
      fStat: granger.fStatistic,
      pValue: granger.pValue,
    };
  }

  const ranking = Object.entries(results)
    .sort((a, b) => b[1].influence - a[1].influence)
    .map(([id, r]) => ({ actor: id, ...r }));

  return {
    actors: results,
    ranking,
    topDriver: ranking[0] || null,
  };
}

function grangerTest(x, y, lag = 1) {
  const n = Math.min(x.length, y.length) - lag;
  if (n < 5) return { fStatistic: 0, pValue: 1 };

  const yTarget = [];
  const yLag = [];
  const xLag = [];

  for (let i = lag; i < Math.min(x.length, y.length); i++) {
    yTarget.push(y[i]);
    yLag.push(y[i - lag]);
    xLag.push(x[i - lag]);
  }

  const meanY = yTarget.reduce((a, b) => a + b, 0) / n;

  let rssR = 0, rssU = 0;
  for (let i = 0; i < n; i++) {
    const predR = meanY * 0.5 + yLag[i] * 0.3;
    rssR += (yTarget[i] - predR) ** 2;
    const predU = meanY * 0.3 + yLag[i] * 0.2 + xLag[i] * 0.4;
    rssU += (yTarget[i] - predU) ** 2;
  }

  const fStat =
    ((rssR - rssU) / lag) / (rssU / Math.max(n - 2 * lag - 1, 1));
  return {
    fStatistic: fStat,
    pValue: 1 / (1 + Math.max(fStat, 0)),
  };
}

// ============================================================
// Готовый цикл для Crucix
// ============================================================

function crucixNarrativeAnalysis(latest, history) {
  const documents = (history || [])
    .slice(-50)
    .map((h) => ({
      text:
        h.gdelt && Array.isArray(h.gdelt.rawEvents)
          ? h.gdelt.rawEvents.map((e) => (e && e.summary) || '').join(' ')
          : '',
      source: 'gdelt',
      timestamp: h.timestamp || new Date().toISOString(),
    }))
    .filter((d) => d.text.length > 20);

  const narratives = extractNarratives(documents);

  const forecasts = narratives.map((n) => {
    const sir = narrativeSIR({
      beta: 0.3 + n.strength * 0.4,
      gamma: 0.1 + (1 - n.strength) * 0.2,
      S0: 1000,
      I0: Math.max(1, n.documentCount),
      days: 30,
    });
    return { narrative: n, sirForecast: sir };
  });

  const result = {
    module: 'narrative',
    narrativeCount: narratives.length,
    narratives,
    forecasts,
    topNarrative:
      forecasts.sort((a, b) => b.sirForecast.R0 - a.sirForecast.R0)[0] || null,
    timestamp: new Date().toISOString(),
  };

  try {
    const dir = join(__dirname, '..', '..', 'runs', 'predictions');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, `narrative_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    // Модуль работает даже без диска
  }

  return result;
}

export {
  extractNarratives,
  narrativeSIR,
  narrativeSEIR,
  trackNarrativeMutation,
  estimateNarrativeInfluence,
  crucixNarrativeAnalysis,
};
