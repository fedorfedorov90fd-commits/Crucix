// Crucix — SourceCoordination (класс-вычислитель)
// Обнаружение координированных публикаций разных источников.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/source-coordination.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Координация медиа — классический паттерн информационных операций.
//   Признак — не 'что' говорят, а 'когда и кто'. Если N формально
//   независимых источников публикуют схожий по смыслу заголовок в узком
//   временном окне — это не совпадение, это координация.
//   Алгоритм: два измерения одновременно — смысловое сходство (TF-IDF +
//   cosine > 0.7) И временная синхронность (окно ±30 минут).

const STOP_WORDS = new Set([
  'и','в','во','не','что','он','на','я','с','со','как','а','то','все','она',
  'так','его','но','да','ты','к','у','же','вы','за','бы','по','только','ее',
  'мне','было','вот','от','меня','еще','нет','о','из','ему','теперь','когда',
  'даже','ну','вдруг','ли','если','уже','или','ни','быть','был','него','до',
  'вас','нибудь','опять','уж','вам','ведь','там','потом','себя','ничего','ей',
  'может','они','тут','где','есть','надо','ней','для','мы','тебя','их','чем',
  'была','сам','чтоб','без','будто','чего','раз','тоже','себе','под','будет',
  'ж','тогда','кто','этот','того','потому','этого','какой','совсем','ним',
  'здесь','этом','один','почти','мой','тем','чтобы','нее','сейчас','были',
  'куда','зачем','всех','никогда','можно','при','наконец','два','об','другой',
  'хоть','после','над','больше','тот','через','эти','нас','про','всего','них',
  'the','a','an','of','to','in','on','at','for','with','is','are','was','were',
  'and','or','but','not','this','that','from','by','as','it','its','be','been',
]);

const HOUR_MS = 3600 * 1000;
const MINUTE_MS = 60 * 1000;

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOP_WORDS.has(t));
}

export default class SourceCoordination {
  constructor(opts = {}) {
    this.windowMinutes = opts.windowMinutes ?? 30;
    this.simThreshold = opts.simThreshold ?? 0.7;
    this.minClusterSize = opts.minClusterSize ?? 2;
    this.now = opts.now ?? Date.now();
    this.publications = [];
    this._df = new Map(); // document frequency для IDF
  }

  addPublication(p) {
    if (!p || !p.title) return false;
    const tokens = tokenize((p.title || '') + ' ' + (p.description || ''));
    if (tokens.length < 2) return false;

    const tf = {};
    for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
    for (const t of Object.keys(tf)) {
      this._df.set(t, (this._df.get(t) || 0) + 1);
    }

    this.publications.push({
      id: p.id || null,
      title: p.title,
      description: p.description || '',
      source: p.source || 'unknown',
      timestamp: p.timestamp || this.now,
      tokens,
      tf,
    });
    return true;
  }

  _tfidf(pub) {
    const N = this.publications.length || 1;
    const vec = {};
    for (const [t, cnt] of Object.entries(pub.tf)) {
      const df = this._df.get(t) || 1;
      const idf = Math.log(1 + N / df);
      vec[t] = (cnt / pub.tokens.length) * idf;
    }
    return vec;
  }

  _cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (const k of Object.keys(a)) {
      na += a[k] * a[k];
      if (b[k]) dot += a[k] * b[k];
    }
    for (const k of Object.keys(b)) nb += b[k] * b[k];
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom > 0 ? dot / denom : 0;
  }

  // Кластеризация: свежие публикации, схожие по смыслу И по времени.
  detectCoordination() {
    const fresh = this.publications.filter(p => this.now - p.timestamp <= 7 * 24 * HOUR_MS);
    if (fresh.length < this.minClusterSize) return [];

    // Сортируем по времени (от старых к новым).
    const sorted = [...fresh].sort((a, b) => a.timestamp - b.timestamp);
    const vectors = sorted.map(p => this._tfidf(p));

    const used = new Set();
    const clusters = [];

    for (let i = 0; i < sorted.length; i++) {
      if (used.has(i)) continue;
      const seed = sorted[i];
      const members = [{ idx: i, pub: seed, sim: 1.0 }];
      used.add(i);

      for (let j = i + 1; j < sorted.length; j++) {
        if (used.has(j)) continue;
        const other = sorted[j];
        // Временное окно: от seed
        const dtMin = Math.abs(other.timestamp - seed.timestamp) / MINUTE_MS;
        if (dtMin > this.windowMinutes) continue;
        // Не схлопывать в один кластер публикации из одного источника
        // (координация — это разные источники, а не повторы одного)
        if (members.some(m => m.pub.source === other.source)) continue;
        // Смысловое сходство
        const sim = this._cosine(vectors[i], vectors[j]);
        if (sim < this.simThreshold) continue;
        members.push({ idx: j, pub: other, sim });
        used.add(j);
      }

      if (members.length < this.minClusterSize) {
        // Откатываем seed и его членов из used, чтобы они могли стать
        // частью других кластеров.
        for (const m of members) used.delete(m.idx);
        continue;
      }

      const sources = new Set(members.map(m => m.pub.source));
      const times = members.map(m => m.pub.timestamp);
      const timeSpanMin = (Math.max(...times) - Math.min(...times)) / MINUTE_MS;
      const avgSimilarity = members.reduce((s, m) => s + m.sim, 0) / members.length;
      // Топ-заголовок — самый длинный (обычно самый информативный).
      const topTitle = members.map(m => m.pub.title).sort((a, b) => b.length - a.length)[0];

      // Оценка координации (академически): чем больше источников и чем
      // короче окно — тем сильнее координация.
      const sourceBoost = sources.size / 2;
      const timeBoost = Math.max(1, this.windowMinutes / Math.max(timeSpanMin, 1));
      const coordScore = sourceBoost * timeBoost * avgSimilarity;

      clusters.push({
        clusterId: `coord_${clusters.length + 1}`,
        size: members.length,
        sourceCount: sources.size,
        sources: Array.from(sources),
        timeSpanMin: Math.round(timeSpanMin * 10) / 10,
        avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
        coordinationScore: Math.round(coordScore * 100) / 100,
        level: coordScore >= 3 ? 'critical' : coordScore >= 1.5 ? 'high' : 'medium',
        topTitle,
        firstTs: new Date(Math.min(...times)).toISOString(),
        lastTs: new Date(Math.max(...times)).toISOString(),
        members: members.map(m => ({
          source: m.pub.source,
          title: m.pub.title.slice(0, 120),
          timestamp: new Date(m.pub.timestamp).toISOString(),
          sim: Math.round(m.sim * 1000) / 1000,
        })),
      });
    }

    return clusters.sort((a, b) => b.coordinationScore - a.coordinationScore);
  }

  bySource() {
    const out = {};
    for (const p of this.publications) {
      out[p.source] = (out[p.source] || 0) + 1;
    }
    return out;
  }

  stats() {
    return {
      totalPublications: this.publications.length,
      uniqueSources: new Set(this.publications.map(p => p.source)).size,
      windowMinutes: this.windowMinutes,
      simThreshold: this.simThreshold,
      minClusterSize: this.minClusterSize,
      now: new Date(this.now).toISOString(),
    };
  }

  clear() {
    this.publications = [];
    this._df.clear();
  }
}
