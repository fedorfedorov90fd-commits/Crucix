// apis/predict/temporal_causal.mjs
// Слой 1: Temporal Causal Discovery — моделирование задержек между причиной и следствием.
//
// Ключевая идея:
//   Задержка (lag) между событием A и событием B — не константа, а случайная
//   величина с распределением P(lag | A, B). Система обучается на истории sweeps
//   и извлекает эмпирические распределения задержек для каждой пары событий.
//
// Сигналы:
//   - Сокращение задержки → ускорение эскалации.
//   - Рост задержки → деградация системы.
//   - Модель окон уязвимости: система наиболее уязвима в определённые
//     дни недели, часы и месяцы.
//
// Контракт 2 (внутренний predict-модуль):
//   - Нет route (не HTTP-эндпоинт).
//   - Есть meta (описание, категория, версия, зависимости).
//   - Экспорт именованных функций и классов. Никаких export default.
//   - try/catch с параметром.
//
// Портабельность:
//   Все пути строятся относительно файла через import.meta.url.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const RUNS_DIR = join(PROJECT_ROOT, 'runs');
const PRED_DIR = join(RUNS_DIR, 'predictions');

// ─── МЕТАДАННЫЕ МОДУЛЯ ──────────────────────────────────────────

export const meta = {
  id: 'temporal_causal',
  name: 'Временная причинная сеть (Temporal Causal Discovery)',
  layer: 1,
  category: 'causal',
  description: 'Моделирование задержек между событиями как случайных величин. Детекция ускорения эскалации и деградации системы.',
  version: '2.0.0',
  depends: [],
  exports: [
    'TemporalLagNetwork',
    'VulnerabilityWindowModel',
    'crucixTemporalCausalAnalysis',
  ],
};

// ─── ЯДРО: ВРЕМЕННАЯ СЕТЬ ЗАДЕРЖЕК ──────────────────────────────

export class TemporalLagNetwork {
  constructor() {
    this.lagDistributions = new Map();
    this.eventTimeline = [];
    this.minObservations = 3;
  }

  recordEvent(eventId, timestampMs, magnitude = 1.0) {
    this.eventTimeline.push({ t: timestampMs, eventId, magnitude });
    this.eventTimeline.sort((a, b) => a.t - b.t);
  }

  extractLags(maxLagMs = 30 * 24 * 3600 * 1000) {
    const pairs = new Map();
    for (let i = 0; i < this.eventTimeline.length; i++) {
      const a = this.eventTimeline[i];
      for (let j = i + 1; j < this.eventTimeline.length; j++) {
        const b = this.eventTimeline[j];
        const lag = b.t - a.t;
        if (lag > maxLagMs) break;
        const key = `${a.eventId}→${b.eventId}`;
        if (!pairs.has(key)) pairs.set(key, []);
        pairs.get(key).push({
          lag,
          magnitudeA: a.magnitude,
          magnitudeB: b.magnitude,
          timestamp: b.t,
        });
      }
    }
    return pairs;
  }

  fit(maxLagMs = 30 * 24 * 3600 * 1000) {
    const pairs = this.extractLags(maxLagMs);
    for (const [key, observations] of pairs) {
      if (observations.length < this.minObservations) continue;
      const lags = observations.map(o => o.lag).sort((a, b) => a - b);
      const mean = lags.reduce((a, b) => a + b, 0) / lags.length;
      const variance = lags.reduce((s, v) => s + (v - mean) ** 2, 0) / lags.length;
      const std = Math.sqrt(variance);
      const [from, to] = key.split('→');
      if (!this.lagDistributions.has(from)) this.lagDistributions.set(from, new Map());
      this.lagDistributions.get(from).set(to, {
        samples: lags,
        count: lags.length,
        mean,
        std,
        p05: lags[Math.floor(lags.length * 0.05)],
        p25: lags[Math.floor(lags.length * 0.25)],
        p50: lags[Math.floor(lags.length * 0.50)],
        p75: lags[Math.floor(lags.length * 0.75)],
        p95: lags[Math.floor(lags.length * 0.95)],
        min: lags[0],
        max: lags[lags.length - 1],
        observations,
        lastUpdate: Date.now(),
      });
    }
    return this.lagDistributions;
  }

  detectLagShift(from, to, recentWindow = 3) {
    const dist = this.lagDistributions.get(from)?.get(to);
    if (!dist || dist.observations.length < recentWindow * 2) {
      return { detected: false, reason: 'insufficient_data' };
    }
    const sorted = [...dist.observations].sort((a, b) => a.timestamp - b.timestamp);
    const recent = sorted.slice(-recentWindow);
    const historical = sorted.slice(0, -recentWindow);
    const recentMean = recent.reduce((s, o) => s + o.lag, 0) / recent.length;
    const histMean = historical.reduce((s, o) => s + o.lag, 0) / historical.length;
    const histStd = Math.sqrt(
      historical.reduce((s, o) => s + (o.lag - histMean) ** 2, 0) / historical.length
    );
    const zScore = histStd > 0 ? (recentMean - histMean) / histStd : 0;
    let type = 'stable';
    let severity = 'none';
    if (zScore < -2) { type = 'accelerating'; severity = 'high'; }
    else if (zScore < -1) { type = 'accelerating'; severity = 'medium'; }
    else if (zScore > 2) { type = 'decelerating'; severity = 'high'; }
    else if (zScore > 1) { type = 'decelerating'; severity = 'medium'; }
    return {
      detected: type !== 'stable',
      type, severity, from, to,
      historicalMean: histMean,
      recentMean,
      shiftPct: histMean > 0 ? ((recentMean - histMean) / histMean) * 100 : 0,
      zScore,
      recentSamples: recent.length,
      historicalSamples: historical.length,
      interpretation: this._interpretLagShift(type, severity, histMean, recentMean),
    };
  }

  _interpretLagShift(type, severity, histMean, recentMean) {
    const histH = (histMean / 3600000).toFixed(1);
    const recH = (recentMean / 3600000).toFixed(1);
    if (type === 'accelerating') {
      return `Задержка сокращается: было ${histH}ч → стало ${recH}ч. Признак ускорения эскалации.`;
    }
    if (type === 'decelerating') {
      return `Задержка растёт: было ${histH}ч → стало ${recH}ч. Признак деградации системы.`;
    }
    return 'Задержка стабильна.';
  }

  predictNextB(from, to) {
    const dist = this.lagDistributions.get(from)?.get(to);
    if (!dist) return null;
    const now = Date.now();
    const lastA = [...this.eventTimeline].reverse().find(e => e.eventId === from);
    if (!lastA) return null;
    return {
      from, to,
      expectedLagMs: dist.mean,
      p05: dist.p05,
      p50: dist.p50,
      p95: dist.p95,
      probabilityB: this._computeProbability(dist, now, lastA.t),
      confidence: Math.min(1, dist.count / 20),
    };
  }

  _computeProbability(dist, now, lastATimestamp) {
    const elapsed = now - lastATimestamp;
    const ratio = elapsed / Math.max(dist.mean, 1);
    return Math.min(0.95, 1 - Math.exp(-ratio));
  }

  serialize() {
    const data = { timeline: this.eventTimeline, distributions: {} };
    for (const [from, targets] of this.lagDistributions) {
      data.distributions[from] = {};
      for (const [to, d] of targets) {
        data.distributions[from][to] = {
          ...d,
          observations: d.observations.slice(-100),
          samples: d.samples.slice(-100),
        };
      }
    }
    return JSON.stringify(data);
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const net = new TemporalLagNetwork();
    net.eventTimeline = data.timeline || [];
    for (const [from, targets] of Object.entries(data.distributions || {})) {
      net.lagDistributions.set(from, new Map());
      for (const [to, d] of Object.entries(targets)) {
        net.lagDistributions.get(from).set(to, d);
      }
    }
    return net;
  }
}

// ─── МОДЕЛЬ ВРЕМЕННЫХ ОКОН УЯЗВИМОСТИ ───────────────────────────

export class VulnerabilityWindowModel {
  constructor() {
    this.temporalPatterns = {
      dayOfWeek: new Array(7).fill(0).map(() => ({ events: 0, hits: 0 })),
      hour: new Array(24).fill(0).map(() => ({ events: 0, hits: 0 })),
      month: new Array(12).fill(0).map(() => ({ events: 0, hits: 0 })),
    };
  }

  fit(history, threshold = 0.7) {
    for (const h of history) {
      if (!h.timestamp) continue;
      const t = new Date(h.timestamp);
      const severity = this._computeSeverity(h);
      const isHigh = severity > threshold;
      this.temporalPatterns.dayOfWeek[t.getDay()].events++;
      this.temporalPatterns.hour[t.getHours()].events++;
      this.temporalPatterns.month[t.getMonth()].events++;
      if (isHigh) {
        this.temporalPatterns.dayOfWeek[t.getDay()].hits++;
        this.temporalPatterns.hour[t.getHours()].hits++;
        this.temporalPatterns.month[t.getMonth()].hits++;
      }
    }
    return this.temporalPatterns;
  }

  _computeSeverity(h) {
    const vix = (h.fred?.vix || 20) / 50;
    const conflicts = (h.gdelt?.conflictEvents?.length || 0) / 20;
    const alerts = (h.delta?.newAlerts || 0) / 10;
    return Math.min(1, vix * 0.4 + conflicts * 0.4 + alerts * 0.2);
  }

  assess(date = new Date()) {
    const dow = this.temporalPatterns.dayOfWeek[date.getDay()];
    const hour = this.temporalPatterns.hour[date.getHours()];
    const month = this.temporalPatterns.month[date.getMonth()];
    const dowRate = dow.events > 0 ? dow.hits / dow.events : 0;
    const hourRate = hour.events > 0 ? hour.hits / hour.events : 0;
    const monthRate = month.events > 0 ? month.hits / month.events : 0;
    const overall = dowRate * 0.3 + hourRate * 0.4 + monthRate * 0.3;
    let level = 'low';
    if (overall > 0.5) level = 'critical';
    else if (overall > 0.35) level = 'high';
    else if (overall > 0.2) level = 'medium';
    return {
      vulnerability: overall,
      level,
      context: {
        dayOfWeek: date.getDay(),
        hour: date.getHours(),
        month: date.getMonth(),
        dowRate, hourRate, monthRate,
      },
      interpretation: this._interpret(level, date),
    };
  }

  _interpret(level, date) {
    const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
    if (level === 'critical') return `Критическое окно уязвимости: ${days[date.getDay()]}, ${date.getHours()}:00. Исторически высокий риск событий.`;
    if (level === 'high') return `Повышенная уязвимость: ${days[date.getDay()]}, ${date.getHours()}:00.`;
    if (level === 'medium') return 'Средняя уязвимость.';
    return 'Низкая уязвимость. Стандартный режим.';
  }
}

// ─── ИНТЕГРАЦИЯ С ПРОГНОСТИЧЕСКИМ КОНВЕЙЕРОМ ────────────────────

export function crucixTemporalCausalAnalysis(history, stateFile = null) {
  if (!history || history.length < 10) {
    return { available: false, reason: 'insufficient_history', requiredSweeps: 10, actualSweeps: history?.length || 0 };
  }
  const filepath = stateFile || join(PRED_DIR, 'temporal_causal.json');
  if (!existsSync(PRED_DIR)) {
    try { mkdirSync(PRED_DIR, { recursive: true }); }
    catch (e) { console.warn('[temporal_causal] Не удалось создать PRED_DIR:', e.message); }
  }
  let net;
  try {
    net = existsSync(filepath)
      ? TemporalLagNetwork.deserialize(readFileSync(filepath, 'utf-8'))
      : new TemporalLagNetwork();
  } catch (e) {
    console.warn('[temporal_causal] Ошибка загрузки состояния, создаём заново:', e.message);
    net = new TemporalLagNetwork();
  }
  for (const h of history) {
    if (!h.timestamp) continue;
    const t = new Date(h.timestamp).getTime();
    if ((h.fred?.vix || 0) > 25) net.recordEvent('vix_spike', t, (h.fred.vix - 25) / 20);
    if ((h.gdelt?.conflictEvents?.length || 0) > 8) net.recordEvent('conflict_spike', t, (h.gdelt.conflictEvents.length - 8) / 15);
    if ((h.sanctions?.count || 0) > 3) net.recordEvent('sanctions_spike', t, h.sanctions.count / 10);
    if ((h.delta?.newAlerts || 0) > 5) net.recordEvent('alert_spike', t, h.delta.newAlerts / 15);
    if ((h.delta?.escalatedAlerts || 0) > 2) net.recordEvent('escalation_spike', t, h.delta.escalatedAlerts / 8);
  }
  net.fit();
  const shiftDetections = [];
  for (const [from, targets] of net.lagDistributions) {
    for (const [to] of targets) {
      const shift = net.detectLagShift(from, to);
      if (shift.detected) shiftDetections.push(shift);
    }
  }
  const predictions = [];
  for (const [from, targets] of net.lagDistributions) {
    for (const [to] of targets) {
      const pred = net.predictNextB(from, to);
      if (pred && pred.confidence > 0.3) predictions.push(pred);
    }
  }
  const vulnModel = new VulnerabilityWindowModel();
  vulnModel.fit(history);
  const currentVuln = vulnModel.assess();
  try { writeFileSync(filepath, net.serialize()); }
  catch (e) { console.warn('[temporal_causal] Не удалось сохранить состояние:', e.message); }
  return {
    module: 'temporal_causal',
    available: true,
    lagNetworkSize: net.lagDistributions.size,
    totalEvents: net.eventTimeline.length,
    shiftDetections,
    predictions: predictions.sort((a, b) => b.probabilityB - a.probabilityB).slice(0, 10),
    vulnerabilityWindow: currentVuln,
    topShifts: shiftDetections.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 5),
    timestamp: new Date().toISOString(),
  };
}
