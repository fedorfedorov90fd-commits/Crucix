// Crucix — RssConvergence (класс-вычислитель)
// Обнаружение convergent stories — тем, которые независимо подхватили
// 5+ источников в узком временном окне (6 часов).
//
// Версия: 1.0.3
// Используется анализатором scripts/analyzers/rss-convergence.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Convergent story — тема, которую независимо подхватили N источников.
//   Чем больше независимых источников и чем короче окно — тем сильнее
//   сигнал. Мультиисточниковое подтверждение — классический принцип
//   OSINT: один источник может ошибиться, пять независимых — нет.
//
// ОТЛИЧИЕ ОТ source-coordination:
//   source-coordination — координация (2+ источника в окне ±30 минут,
//     sim > 0.7). Признак информационной операции.
//   rss-convergence — массовость (5+ источников в окне 6 часов,
//     sim > 0.5). Признак значимости темы.
//   Они ловят РАЗНЫЕ явления: аномалию и норму.

const STOP_WORDS = new Set([
  'и','в','во','не','что','он','на','я','с','со','как','а','то','все','она',
  'так','его','но','да','ты','к','у','же','вы','за','бы','по','только','ее',
  'мне','было','вот','от','меня','еще','нет','о','из','ему','теперь','когда',
  'даже','ну','вдруг','ли','если','уже','или','ни','быть','был','него','до',
  'вас','нибудь','опять','уж','вам','ведь','там','потом','себя','ничего','ей',
  'может','они','тут','где','есть','надо','ней','для','мы','тебя','их','чем',
  'была','сам','чтоб','без','будто','чего','раз','тоже','себе','под','будет',
  'the','a','an','of','to','in','on','at','for','with','is','are','was','were',
  'and','or','but','not','this','that','from','by','as','it','its','be','been',
  'has','have','had','will','would','could','should','may','might','says','said',
]);

const HOUR_MS = 3600 * 1000;

// Простой стеммер: убирает частые русские и английские окончания.
// Это поднимает cosine similarity между формами одного слова (санкции/санкций).
function stem(word) {
  if (!word || word.length < 5) return word;
  // Русские окончания.
  const ruSuffixes = ['иями', 'иях', 'ями', 'ами', 'ов', 'ей', 'ой', 'ый', 'ий', 'ая', 'ое', 'ые', 'их', 'ых', 'ам', 'ям', 'ах', 'ях', 'ом', 'ем', 'ы', 'и', 'а', 'я', 'о', 'е', 'у', 'ю'];
  // Английские окончания.
  const enSuffixes = ['ings', 'ing', 'ies', 'ed', 'es', 's'];
  for (const suf of ruSuffixes) {
    if (word.length - suf.length >= 4 && word.endsWith(suf)) return word.slice(0, -suf.length);
  }
  for (const suf of enSuffixes) {
    if (word.length - suf.length >= 3 && word.endsWith(suf)) return word.slice(0, -suf.length);
  }
  return word;
}

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOP_WORDS.has(t))
    .map(stem)
    .filter(t => t.length >= 3);
}

export default class RssConvergence {
  constructor(opts = {}) {
    this.windowHours = opts.windowHours ?? 24;
    this.simThreshold = opts.simThreshold ?? 0.35;
    this.minSources = opts.minSources ?? 3;
    this.maxArticlesPerCluster = opts.maxArticlesPerCluster ?? 50;
    this.mode = opts.mode ?? 'auto'; // absolute | relative | auto
    this.now = opts.now ?? Date.now();
    this.articles = [];
    this._df = new Map();
  }

  // Эффективное "сейчас": в auto — берём ВСЕ данные за весь диапазон.
  _effectiveNow() {
    if (this.mode === 'absolute') return this.now;
    if (this.articles.length === 0) return this.now;
    const maxTs = Math.max(...this.articles.map(a => a.timestamp));
    if (this.mode === 'relative') return maxTs;
    // auto: если свежих за 24ч нет — берём relative (max timestamp)
    const fresh = this.articles.filter(a => this.now - a.timestamp <= 24 * 3600000).length;
    return fresh > 0 ? this.now : maxTs;
  }

  // Для relative/auto: окно = разница от min до max timestamp.
  // Это позволяет анализировать архивы, где все данные в прошлом.
  _windowRange() {
    if (this.mode === 'absolute') {
      return { from: this.now - this.windowHours * 3600000, to: this.now };
    }
    if (this.articles.length === 0) {
      return { from: this.now - this.windowHours * 3600000, to: this.now };
    }
    const maxTs = Math.max(...this.articles.map(a => a.timestamp));
    const from = maxTs - this.windowHours * 3600000;
    return { from, to: maxTs };
  }

  addArticle(a) {
    if (!a || !a.title) return false;
    const text = (a.title || '') + ' ' + (a.description || '');
    const tokens = tokenize(text);
    if (tokens.length < 2) return false;

    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    for (const t of Object.keys(tf)) {
      this._df.set(t, (this._df.get(t) || 0) + 1);
    }

    this.articles.push({
      id: a.id || null,
      title: a.title,
      description: a.description || '',
      source: a.source || 'unknown',
      sourceUrl: a.sourceUrl || '',
      timestamp: a.timestamp || this.now,
      tokens,
      tf,
    });
    return true;
  }

  _tfidf(article) {
    const N = this.articles.length || 1;
    const vec = {};
    for (const [t, cnt] of Object.entries(article.tf)) {
      const df = this._df.get(t) || 1;
      const idf = Math.log(1 + N / df);
      vec[t] = (cnt / article.tokens.length) * idf;
    }
    return vec;
  }

  _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k of Object.keys(a)) {
      na += a[k] * a[k];
      if (b[k] !== undefined) dot += a[k] * b[k];
    }
    for (const k of Object.keys(b)) nb += b[k] * b[k];
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 0 ? dot / denom : 0;
  }

  // Основная функция: находим convergent stories.
  detectConvergentStories() {
    const range = this._windowRange();
    const fresh = this.articles.filter(a => a.timestamp >= range.from && a.timestamp <= range.to);
    if (fresh.length < this.minSources) return [];

    // Сортировка по времени (от старых к новым) — seed берём самый старый.
    const sorted = [...fresh].sort((a, b) => a.timestamp - b.timestamp);
    const vectors = sorted.map(a => this._tfidf(a));

    const used = new Set();
    const clusters = [];
    const windowMs = this.windowHours * HOUR_MS;

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      const seed = sorted[i];
      const members = [{ idx: i, article: seed, sim: 1.0 }];
      used.add(i);

      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        if (members.length >= this.maxArticlesPerCluster) break;
        const other = sorted[j];
        const dtMs = other.timestamp - seed.timestamp;
        if (dtMs > windowMs) continue;
        const sim = this._cosine(vectors[i], vectors[j]);
        if (sim < this.simThreshold) continue;
        members.push({ idx: j, article: other, sim });
        used.add(j);
      }

      // Уникальные источники.
      const sources = new Set(members.map(m => m.article.source));
      if (sources.size < this.minSources) {
        // Откатываем использованные, чтобы другой seed мог их взять.
        for (const m of members) used.delete(m.idx);
        continue;
      }

      const times = members.map(m => m.article.timestamp);
      const timeSpanHours = (Math.max(...times) - Math.min(...times)) / HOUR_MS;
      const avgSimilarity = members.reduce((s, m) => s + m.sim, 0) / members.length;
      const topTitle = members.map(m => m.article.title).sort((a, b) => b.length - a.length)[0];

      // Оценка: количество источников × среднее сходство × boost за сжатость окна.
      const sourceBoost = Math.sqrt(sources.size);
      const timeBoost = Math.max(1, this.windowHours / Math.max(timeSpanHours, 0.5));
      const convergenceScore = Math.round(sourceBoost * avgSimilarity * timeBoost * 100) / 100;

      const level = convergenceScore >= 5 ? 'critical'
                  : convergenceScore >= 3 ? 'high'
                  : convergenceScore >= 1.5 ? 'medium'
                  : 'low';

      clusters.push({
        storyId: 'story_' + (clusters.length + 1),
        sourceCount: sources.size,
        articleCount: members.length,
        timeSpanHours: Math.round(timeSpanHours * 10) / 10,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
        convergenceScore,
        level,
        topTitle,
        firstTs: new Date(Math.min(...times)).toISOString(),
        lastTs: new Date(Math.max(...times)).toISOString(),
        sources: Array.from(sources),
        articles: members.slice(0, 30).map(m => ({
          source: m.article.source,
          title: m.article.title.slice(0, 150),
          timestamp: new Date(m.article.timestamp).toISOString(),
          sim: Math.round(m.sim * 1000) / 1000,
        })),
      });
    }

    return clusters.sort((a, b) => b.convergenceScore - a.convergenceScore);
  }

  bySource() {
    const out = {};
    for (const a of this.articles) {
      out[a.source] = (out[a.source] || 0) + 1;
    }
    return out;
  }

  stats() {
    return {
      totalArticles: this.articles.length,
      uniqueSources: new Set(this.articles.map(a => a.source)).size,
      windowHours: this.windowHours,
      simThreshold: this.simThreshold,
      minSources: this.minSources,
      now: new Date(this.now).toISOString(),
      effectiveNow: new Date(this._effectiveNow()).toISOString(),
      mode: this.mode,
    };
  }

  clear() {
    this.articles = [];
    this._df.clear();
  }
}
