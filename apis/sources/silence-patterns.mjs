// Crucix — SilencePatterns (класс-вычислитель)
// Обнаружение аномального молчания в медиа-потоке.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/silence-patterns.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Перед операцией медиа-поле зачищается. Тема, которая была активной
//   в течение 168 часов, внезапно исчезает из потока на 24 часа — это
//   не совпадение. Метод: сопоставление упоминаний темы в двух окнах:
//   baseline (168ч) и current (24ч). Если в baseline было N+ упоминаний
//   в час, а в current 0 или резко мало — сигнал молчания.

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
  'какая','много','разве','три','эту','моя','впрочем','хорошо','свою','этой',
  'перед','иногда','лучше','чуть','том','нельзя','такой','им','более','всегда',
  'конечно','всю','между',
]);

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 4 && !STOP_WORDS.has(t));
}

export default class SilencePatterns {
  constructor(opts = {}) {
    this.baselineHours = opts.baselineHours ?? 168;
    this.currentHours = opts.currentHours ?? 24;
    this.minBaselineMentions = opts.minBaselineMentions ?? 3;
    this.minSilenceScore = opts.minSilenceScore ?? 1.5;
    this.now = opts.now ?? Date.now();
    this.mentions = [];
  }

  addMention(m) {
    if (!m || !m.text) return false;
    const tokens = tokenize(m.text);
    if (tokens.length === 0) return false;
    this.mentions.push({
      tokens,
      source: m.source || 'unknown',
      weight: m.weight ?? 1,
      timestamp: m.timestamp || this.now,
    });
    return true;
  }

  _topicBaseline(topic) {
    const now = this.now;
    const baseStart = now - this.baselineHours * 3_600_000;
    const currStart = now - this.currentHours * 3_600_000;
    let baseline = 0;
    let current = 0;
    const sourcesBaseline = new Set();
    const sourcesCurrent = new Set();
    for (const m of this.mentions) {
      if (!m.tokens.includes(topic)) continue;
      const t = new Date(m.timestamp).getTime();
      if (t >= currStart) { current += m.weight; sourcesCurrent.add(m.source); }
      else if (t >= baseStart) { baseline += m.weight; sourcesBaseline.add(m.source); }
    }
    return { baseline, current, sourcesBaseline, sourcesCurrent };
  }

  _topics() {
    const topics = new Set();
    for (const m of this.mentions) for (const t of m.tokens) topics.add(t);
    return topics;
  }

  detectSilence() {
    const topics = this._topics();
    const results = [];
    const baselineRate = this.baselineHours / this.currentHours;

    for (const topic of topics) {
      const { baseline, current, sourcesBaseline, sourcesCurrent } = this._topicBaseline(topic);
      if (baseline < this.minBaselineMentions) continue;

      const expectedCurrent = baseline / baselineRate;
      const deficit = expectedCurrent - current;
      const silenceScore = expectedCurrent > 0 ? (deficit / expectedCurrent) * (sourcesBaseline.size / 2) : 0;

      if (silenceScore < this.minSilenceScore) continue;

      results.push({
        topic,
        baselineCount: Math.round(baseline * 100) / 100,
        currentCount: Math.round(current * 100) / 100,
        expectedCurrent: Math.round(expectedCurrent * 100) / 100,
        deficit: Math.round(deficit * 100) / 100,
        sourcesBaseline: Array.from(sourcesBaseline),
        sourcesCurrent: Array.from(sourcesCurrent),
        silenceScore: Math.round(silenceScore * 100) / 100,
        level: silenceScore >= 3 ? 'critical' : silenceScore >= 2 ? 'high' : 'medium',
      });
    }

    return results.sort((a, b) => b.silenceScore - a.silenceScore);
  }

  byTopic() {
    const topics = this._topics();
    const out = {};
    for (const t of topics) {
      const { baseline, current } = this._topicBaseline(t);
      if (baseline + current === 0) continue;
      out[t] = {
        baseline: Math.round(baseline * 100) / 100,
        current: Math.round(current * 100) / 100,
      };
    }
    return out;
  }

  stats() {
    return {
      totalMentions: this.mentions.length,
      baselineHours: this.baselineHours,
      currentHours: this.currentHours,
      minBaselineMentions: this.minBaselineMentions,
      now: new Date(this.now).toISOString(),
    };
  }

  clear() {
    this.mentions = [];
  }
}
