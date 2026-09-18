// apis/predict/narrative_warfare.mjs
// Слой 3: Narrative Warfare Detection — детекция целенаправленных дезинформационных кампаний.
//
// Отличие от narrative.mjs:
//   narrative.mjs анализирует органическое распространение нарративов.
//   narrative_warfare.mjs фокусируется на СКООРДИНИРОВАННЫХ кампаниях влияния.
//
// Сигналы скоординированности:
//   1. Временная синхронность — публикации в узком окне (1 час).
//   2. Лексическое сходство — совпадение 3-граммных фраз, хештегов.
//   3. Известные источники пропаганды — база KNOWN_PROPAGANDA_SOURCES.
//   4. Манипулятивные ключевые слова — многоязычные (рус, англ, кит, араб).
//   5. Анализ цели кампании — против какой страны/лидера направлена.
//
// Классификация кампаний:
//   state_propaganda, coordinated_bot_network, suspicious_coordination,
//   possible_campaign, organic_spread.
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких дефолтных экспортов.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'narrative_warfare',
  name: 'Детекция информационных кампаний (Narrative Warfare Detection)',
  layer: 3,
  category: 'information',
  description: 'Детекция скоординированных кампаний дезинформации: синхронность, лексическое сходство, известные источники пропаганды, анализ цели.',
  version: '2.0.0',
  depends: [],
  exports: [
    'KNOWN_PROPAGANDA_SOURCES',
    'isPropagandaSource',
    'NarrativeWarfareDetector',
    'computeNarrativeConfidence',
    'crucixNarrativeWarfare',
  ],
};

// ─── БАЗА ИЗВЕСТНЫХ ПРОПАГАНДИСТСКИХ ИСТОЧНИКОВ ─────────────────

export const KNOWN_PROPAGANDA_SOURCES = new Set([
  'rt.com', 'sputniknews.com', 'tass.ru', 'ria.ru',
  'xinhuanet.com', 'globaltimes.cn', 'cgtn.com',
  'presstv.ir', 'farsnews.ir',
  'kcna.kp',
]);

/**
 * Проверка: относится ли источник к известным пропагандистским.
 * @param {string} sourceUrl — URL или домен источника
 * @returns {boolean}
 */
export function isPropagandaSource(sourceUrl) {
  if (!sourceUrl) return false;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, '');
    return [...KNOWN_PROPAGANDA_SOURCES].some(s => host.includes(s.replace(/^www\./, '')));
  } catch (e) {
    // Возможно, sourceUrl — это уже домен без протокола
    try {
      const host = String(sourceUrl).replace(/^www\./, '').toLowerCase();
      return [...KNOWN_PROPAGANDA_SOURCES].some(s => host.includes(s.replace(/^www\./, '')));
    } catch (e2) {
      return false;
    }
  }
}

// ─── ДЕТЕКЦИЯ СКООРДИНИРОВАННЫХ КАМПАНИЙ ────────────────────────

export class NarrativeWarfareDetector {
  constructor(config = {}) {
    this.windowMs = config.windowMs || 3600000;
    this.similarityThreshold = config.similarityThreshold || 0.65;
    this.minSourcesForCampaign = config.minSourcesForCampaign || 3;
    this.knownSources = config.knownSources || KNOWN_PROPAGANDA_SOURCES;
  }

  /**
   * Основная функция: анализ потока публикаций.
   * @param {Array<{text, source, timestamp, url, author}>} posts
   * @returns {Object} — детектированные кампании
   */
  detectCampaigns(posts) {
    if (!posts || posts.length < 3) {
      return { campaigns: [], available: false, reason: 'insufficient_posts' };
    }

    const sorted = [...posts].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const campaigns = [];
    const processed = new Set();

    for (let i = 0; i < sorted.length; i++) {
      if (processed.has(i)) continue;
      const anchor = sorted[i];
      const windowPosts = [];
      const anchorTime = new Date(anchor.timestamp).getTime();
      for (let j = i; j < sorted.length; j++) {
        const t = new Date(sorted[j].timestamp).getTime();
        if (t - anchorTime > this.windowMs) break;
        windowPosts.push({ idx: j, post: sorted[j] });
      }

      const cluster = this._clusterBySimilarity(windowPosts);

      if (cluster.length >= this.minSourcesForCampaign) {
        const campaign = this._analyzeCampaign(cluster);
        if (campaign.suspicionScore > 0.4) {
          campaigns.push(campaign);
          for (const c of cluster) processed.add(c.idx);
        }
      }
    }

    campaigns.sort((a, b) => b.suspicionScore - a.suspicionScore);

    return {
      available: true,
      totalPosts: posts.length,
      campaignsDetected: campaigns.length,
      campaigns: campaigns.slice(0, 10),
      topCampaign: campaigns[0] || null,
    };
  }

  _clusterBySimilarity(windowPosts) {
    if (windowPosts.length === 0) return [];
    const clusters = [];
    const used = new Set();

    for (let i = 0; i < windowPosts.length; i++) {
      if (used.has(i)) continue;
      const cluster = [windowPosts[i]];
      used.add(i);
      for (let j = i + 1; j < windowPosts.length; j++) {
        if (used.has(j)) continue;
        const sim = this._textSimilarity(
          windowPosts[i].post.text,
          windowPosts[j].post.text
        );
        if (sim > this.similarityThreshold) {
          cluster.push(windowPosts[j]);
          used.add(j);
        }
      }
      if (cluster.length >= 2) clusters.push(cluster);
    }

    clusters.sort((a, b) => b.length - a.length);
    return clusters[0] || [];
  }

  _textSimilarity(a, b) {
    if (!a || !b) return 0;
    const tokensA = new Set(this._tokenize(a));
    const tokensB = new Set(this._tokenize(b));
    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    const intersection = [...tokensA].filter(t => tokensB.has(t)).length;
    const union = new Set([...tokensA, ...tokensB]).size;
    const jaccard = intersection / union;

    const ngramsA = this._getNgrams(a, 3);
    const ngramsB = this._getNgrams(b, 3);
    const ngramMatch = ngramsA.filter(g => ngramsB.includes(g)).length /
                       Math.max(Math.min(ngramsA.length, ngramsB.length), 1);

    return jaccard * 0.6 + ngramMatch * 0.4;
  }

  _tokenize(text) {
    return String(text).toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3);
  }

  _getNgrams(text, n) {
    const tokens = this._tokenize(text);
    const ngrams = [];
    for (let i = 0; i <= tokens.length - n; i++) {
      ngrams.push(tokens.slice(i, i + n).join(' '));
    }
    return ngrams;
  }

  _analyzeCampaign(cluster) {
    const posts = cluster.map(c => c.post);
    const sources = [...new Set(posts.map(p => p.source))];
    const knownSources = sources.filter(s => isPropagandaSource(s));

    const times = posts.map(p => new Date(p.timestamp).getTime()).sort((a, b) => a - b);
    const timeSpan = times[times.length - 1] - times[0];
    const avgGap = timeSpan / Math.max(posts.length - 1, 1);
    const temporalSynchrony = Math.exp(-avgGap / 300000);

    let totalSim = 0, pairs = 0;
    for (let i = 0; i < posts.length; i++) {
      for (let j = i + 1; j < posts.length; j++) {
        totalSim += this._textSimilarity(posts[i].text, posts[j].text);
        pairs++;
      }
    }
    const avgSimilarity = pairs > 0 ? totalSim / pairs : 0;

    const propagandaRatio = sources.length > 0 ? knownSources.length / sources.length : 0;
    const sourceDiversity = sources.length / Math.max(posts.length, 1);

    const manipulationKeywords = [
      'срочно', 'шок', 'ужас', 'катастрофа', 'паника',
      'breaking', 'urgent', 'shocking', 'disaster', 'panic',
      '紧急', '震惊', '灾难', 'عاجل', 'صدمة', 'كارثة',
    ];
    const manipHits = posts.reduce((s, p) => {
      const lower = String(p.text).toLowerCase();
      return s + manipulationKeywords.filter(k => lower.includes(k)).length;
    }, 0);
    const manipulationRatio = manipHits / posts.length;

    const targetAnalysis = this._analyzeTarget(posts);

    const suspicionScore = Math.min(1,
      temporalSynchrony * 0.25 +
      avgSimilarity * 0.30 +
      propagandaRatio * 0.25 +
      (1 - sourceDiversity) * 0.10 +
      manipulationRatio * 0.10
    );

    return {
      id: `campaign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      suspicionScore,
      postCount: posts.length,
      sources,
      knownPropagandaSources: knownSources,
      timeSpan: {
        startMs: times[0],
        endMs: times[times.length - 1],
        durationMs: timeSpan,
        avgGapMs: avgGap,
      },
      metrics: {
        temporalSynchrony,
        avgSimilarity,
        propagandaRatio,
        sourceDiversity,
        manipulationRatio,
      },
      sampleTexts: posts.slice(0, 3).map(p => String(p.text).slice(0, 200)),
      target: targetAnalysis,
      classification: this._classify(suspicionScore, propagandaRatio, temporalSynchrony),
      recommendation: this._recommend(suspicionScore, propagandaRatio),
    };
  }

  _analyzeTarget(posts) {
    const targets = {};
    const entities = {
      russia:  ['россия', 'russia', 'путин', 'putin', 'кремль', 'russian'],
      usa:     ['сша', 'usa', 'америк', 'biden', 'trump', 'washington'],
      china:   ['китай', 'china', 'си цзиньпин', 'beijing'],
      ukraine: ['украин', 'ukraine', 'киев', 'kyiv', 'zelensky'],
      eu:      ['евросоюз', 'eu', 'brussels', 'брюссель'],
      nato:    ['нато', 'nato', 'брюссел'],
    };

    for (const p of posts) {
      const text = String(p.text).toLowerCase();
      for (const [entity, aliases] of Object.entries(entities)) {
        if (aliases.some(a => text.includes(a))) {
          targets[entity] = (targets[entity] || 0) + 1;
        }
      }
    }

    const sorted = Object.entries(targets).sort((a, b) => b[1] - a[1]);
    return {
      primary: sorted[0]?.[0] || 'unknown',
      distribution: Object.fromEntries(sorted),
    };
  }

  _classify(score, propagandaRatio, synchrony) {
    if (score > 0.7 && propagandaRatio > 0.5) return 'state_propaganda';
    if (score > 0.6 && synchrony > 0.7) return 'coordinated_bot_network';
    if (score > 0.5) return 'suspicious_coordination';
    if (score > 0.35) return 'possible_campaign';
    return 'organic_spread';
  }

  _recommend(score, propagandaRatio) {
    if (score > 0.7) return 'КРИТИЧНО: скоординированная кампания влияния. Рекомендуется мониторинг и противодействие.';
    if (score > 0.5) return 'ВНИМАНИЕ: признаки скоординированной активности. Рекомендуется дополнительная верификация.';
    if (score > 0.35) return 'Наблюдение: возможная кампания, но недостаточно доказательств.';
    return 'Органическое распространение. Стандартный мониторинг.';
  }
}

// ─── ОЦЕНКА ДОСТОВЕРНОСТИ НАРРАТИВА ─────────────────────────────

/**
 * Оценка достоверности нарратива: подтверждён ли независимыми источниками?
 * @param {Array} posts
 * @returns {Object}
 */
export function computeNarrativeConfidence(posts) {
  if (!posts || posts.length === 0) return { confidence: 0, reason: 'no_data' };

  const sources = [...new Set(posts.map(p => p.source))];
  const independentSources = sources.filter(s => !isPropagandaSource(s));
  const propagandaSources = sources.filter(s => isPropagandaSource(s));

  const independenceFactor = Math.min(1, independentSources.length / 5);
  const ratioFactor = sources.length > 0 ? independentSources.length / sources.length : 0;

  const detector = new NarrativeWarfareDetector();
  let totalSim = 0, pairs = 0;
  for (let i = 0; i < posts.length; i++) {
    for (let j = i + 1; j < posts.length; j++) {
      totalSim += detector._textSimilarity(posts[i].text, posts[j].text);
      pairs++;
    }
  }
  const avgSim = pairs > 0 ? totalSim / pairs : 0;
  const diversityFactor = 1 - avgSim;

  const confidence = independenceFactor * 0.4 + ratioFactor * 0.3 + diversityFactor * 0.3;

  return {
    confidence,
    level: confidence > 0.6 ? 'high' : confidence > 0.35 ? 'medium' : 'low',
    breakdown: { independenceFactor, ratioFactor, diversityFactor },
    independentSources: independentSources.length,
    propagandaSources: propagandaSources.length,
    interpretation: confidence > 0.6
      ? 'Нарратив подтверждён независимыми источниками'
      : confidence > 0.35
      ? 'Нарратив частично подтверждён'
      : 'Нарратив НЕ подтверждён независимыми источниками — возможна кампания',
  };
}

// ─── ИНТЕГРАЦИЯ С CRUCIX ───────────────────────────────────────

/**
 * Главная функция модуля.
 * @param {Object} latest — текущий sweep
 * @param {Array} history — история sweeps
 * @returns {Object}
 */
export function crucixNarrativeWarfare(latest, history) {
  const posts = (latest.gdelt?.rawEvents || [])
    .map(e => ({
      text: e.summary || e.description || '',
      source: e.sourceUrl || e.domain || e.source || 'unknown',
      timestamp: e.timestamp || new Date().toISOString(),
      url: e.sourceUrl,
      author: e.author,
    }))
    .filter(p => p.text.length > 20);

  if (posts.length < 3) {
    return { module: 'narrative_warfare', available: false, reason: 'insufficient_posts', postCount: posts.length };
  }

  const detector = new NarrativeWarfareDetector();
  const campaigns = detector.detectCampaigns(posts);
  const confidence = computeNarrativeConfidence(posts);

  const threatLevel = campaigns.campaigns.length > 0
    ? Math.max(...campaigns.campaigns.map(c => c.suspicionScore))
    : 0;

  const result = {
    module: 'narrative_warfare',
    available: true,
    totalPosts: posts.length,
    uniqueSources: new Set(posts.map(p => p.source)).size,
    campaignsDetected: campaigns.campaignsDetected,
    campaigns: campaigns.campaigns,
    topCampaign: campaigns.topCampaign,
    confidence,
    threatLevel,
    assessment: threatLevel > 0.7 ? 'КРИТИЧНО'
              : threatLevel > 0.5 ? 'ВЫСОКО'
              : threatLevel > 0.3 ? 'СРЕДНЕ'
              : 'НИЗКО',
    timestamp: new Date().toISOString(),
  };

  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[narrative_warfare] Не удалось создать PRED_DIR:', e.message); }
  }
  try {
    writeFileSync(
      join(PRED_DIR, `narrative_warfare_${Date.now()}.json`),
      JSON.stringify(result, null, 2)
    );
  } catch (e) {
    console.warn('[narrative_warfare] Не удалось сохранить результат:', e.message);
  }

  return result;
}
