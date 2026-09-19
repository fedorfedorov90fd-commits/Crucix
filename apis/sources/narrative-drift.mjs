// Crucix — NarrativeDrift (класс-вычислитель)
// Расхождение между официальными заявлениями и фактическими действиями.
//
// Версия: 1.0.0
// Используется анализатором scripts/analyzers/narrative-drift.mjs.
//
// АКАДЕМИЧЕСКОЕ ОБОСНОВАНИЕ:
//   Расхождение слов и действий — классический признак подготовки
//   операции или сокрытия. Если государство декларирует мир, а данные
//   показывают накопление военной активности — это сигнал.
//   Метод: токенизация заявлений (TF), сопоставление с токенами действий
//   (через словари синонимов), вычисление коэффициента расхождения.

const STOP_WORDS = new Set([
  'и', 'в', 'во', 'не', 'что', 'он', 'на', 'я', 'с', 'со', 'как', 'а', 'то',
  'все', 'она', 'так', 'его', 'но', 'да', 'ты', 'к', 'у', 'же', 'вы', 'за',
  'бы', 'по', 'только', 'ее', 'мне', 'было', 'вот', 'от', 'меня', 'еще',
  'нет', 'о', 'из', 'ему', 'теперь', 'когда', 'даже', 'ну', 'вдруг', 'ли',
  'если', 'уже', 'или', 'ни', 'быть', 'был', 'него', 'до', 'вас', 'нибудь',
  'опять', 'уж', 'вам', 'ведь', 'там', 'потом', 'себя', 'ничего', 'ей',
  'может', 'они', 'тут', 'где', 'есть', 'надо', 'ней', 'для', 'мы', 'тебя',
  'их', 'чем', 'была', 'сам', 'чтоб', 'без', 'будто', 'чего', 'раз', 'тоже',
  'себе', 'под', 'будет', 'ж', 'тогда', 'кто', 'этот', 'того', 'потому',
  'этого', 'какой', 'совсем', 'ним', 'здесь', 'этом', 'один', 'почти',
  'мой', 'тем', 'чтобы', 'нее', 'сейчас', 'были', 'куда', 'зачем', 'всех',
  'никогда', 'можно', 'при', 'наконец', 'два', 'об', 'другой', 'хоть',
  'после', 'над', 'больше', 'тот', 'через', 'эти', 'нас', 'про', 'всего',
  'них', 'какая', 'много', 'разве', 'три', 'эту', 'моя', 'впрочем',
  'хорошо', 'свою', 'этой', 'перед', 'иногда', 'лучше', 'чуть', 'том',
  'нельзя', 'такой', 'им', 'более', 'всегда', 'конечно', 'всю', 'между',
]);

// Словари для сопоставления: тема заявления → тип действия.
const THEME_ACTIONS = {
  'мир': ['military-exercise', 'conflict'],
  'переговоры': ['military-exercise'],
  'дипломатия': ['sanctions', 'conflict'],
  'стабильность': ['conflict', 'gps-jamming'],
  'безопасность': ['military-exercise', 'notam'],
  'оборона': ['military-exercise'],
  'учения': ['military-exercise'],
  'напряжённость': ['conflict', 'gps-jamming'],
  'санкции': ['sanctions', 'conflict'],
};

function tokenize(text) {
  if (!text) return [];
  return String(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t));
}

export default class NarrativeDrift {
  constructor(opts = {}) {
    this.windowHours = opts.windowHours ?? 168;
    this.now = opts.now ?? Date.now();
    this.statements = [];
    this.actions = [];
  }

  addStatement(st) {
    if (!st) return false;
    this.statements.push({
      title: st.title || '',
      description: st.description || '',
      source: st.source || 'unknown',
      country: (st.country || '').toUpperCase() || null,
      timestamp: st.timestamp || this.now,
      tokens: tokenize((st.title || '') + ' ' + (st.description || '')),
    });
    return true;
  }

  addAction(ac) {
    if (!ac || !ac.type) return false;
    this.actions.push({
      type: ac.type,
      country: (ac.country || '').toUpperCase() || null,
      lat: ac.lat ?? null,
      lon: ac.lon ?? null,
      severity: ac.severity ?? 0.5,
      timestamp: ac.timestamp || this.now,
    });
    return true;
  }

  _isFresh(item) {
    if (!this.windowHours) return true;
    const age = (this.now - new Date(item.timestamp).getTime()) / 3_600_000;
    return age <= this.windowHours;
  }

  _statementThemes() {
    const themes = {};
    for (const st of this.statements.filter(s => this._isFresh(s))) {
      for (const token of st.tokens) {
        if (!themes[token]) themes[token] = { count: 0, sources: new Set(), countries: new Set() };
        themes[token].count++;
        themes[token].sources.add(st.source);
        if (st.country) themes[token].countries.add(st.country);
      }
    }
    return themes;
  }

  computeDrift() {
    const themes = this._statementThemes();
    const actionCounts = {};
    for (const a of this.actions.filter(x => this._isFresh(x))) {
      actionCounts[a.type] = (actionCounts[a.type] || 0) + 1;
    }

    const drifts = [];
    const countries = new Set();
    for (const s of this.statements) if (s.country) countries.add(s.country);
    for (const a of this.actions) if (a.country) countries.add(a.country);

    for (const country of countries) {
      const countryStatements = this.statements.filter(s => this._isFresh(s) && s.country === country);
      const countryActions = this.actions.filter(a => this._isFresh(a) && a.country === country);

      if (countryStatements.length === 0 && countryActions.length === 0) continue;

      // Тематический сигнал: какие темы в заявлениях.
      const themeHits = [];
      for (const st of countryStatements) {
        for (const token of st.tokens) {
          for (const [theme, actionTypes] of Object.entries(THEME_ACTIONS)) {
            if (token.includes(theme) || theme.includes(token)) {
              for (const at of actionTypes) {
                if (countryActions.some(a => a.type === at)) {
                  themeHits.push({ theme, actionType: at, statementTokens: st.tokens.slice(0, 5) });
                }
              }
            }
          }
        }
      }

      const actionDensity = countryActions.length;
      const statementDensity = countryStatements.length;
      const themeConflict = themeHits.length;

      // Коэффициент расхождения:
      // - если заявлений много, а действий мало — низкий drift
      // - если заявлений мало, а действий много — высокий drift
      // - если тема заявления противоречит действию — очень высокий drift
      const imbalance = statementDensity === 0 && actionDensity > 0
        ? 2.0
        : actionDensity / Math.max(statementDensity, 1);

      const themeFactor = 1 + themeConflict * 0.5;
      const driftScore = imbalance * themeFactor;

      drifts.push({
        country,
        statements: statementDensity,
        actions: actionDensity,
        themes: themeHits.slice(0, 10),
        imbalance: Math.round(imbalance * 100) / 100,
        driftScore: Math.round(driftScore * 100) / 100,
        level: driftScore >= 3 ? 'critical' : driftScore >= 1.5 ? 'high' : driftScore >= 0.7 ? 'medium' : 'low',
      });
    }

    return drifts.sort((a, b) => b.driftScore - a.driftScore);
  }

  byCountry() {
    const drifts = this.computeDrift();
    const out = {};
    for (const d of drifts) {
      out[d.country] = {
        statements: d.statements,
        actions: d.actions,
        driftScore: d.driftScore,
        level: d.level,
      };
    }
    return out;
  }

  stats() {
    return {
      totalStatements: this.statements.length,
      totalActions: this.actions.length,
      windowHours: this.windowHours,
      freshStatements: this.statements.filter(s => this._isFresh(s)).length,
      freshActions: this.actions.filter(a => this._isFresh(a)).length,
      now: new Date(this.now).toISOString(),
    };
  }

  clear() {
    this.statements = [];
    this.actions = [];
  }
}
