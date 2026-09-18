// ═══════════════════════════════════════════════════════════════
//  CRUCIX TARGET WORKBENCH v1.0.0
//  Цикл F2T2EA (Find - Fix - Track - Target - Engage - Assess).
//  Сопровождение цели: фаза, приоритет, достоверность, авто-продвижение.
//  Работает поверх EntityGraph и EntityModelEngine. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';

// ─── Фазы цикла F2T2EA ────────────────────────────────────────
export const F2T2EA_PHASES = Object.freeze([
  { id: 'find',   order: 1, name: 'Обнаружение',   description: 'Цель выявлена в данных' },
  { id: 'fix',    order: 2, name: 'Фиксация',      description: 'Позиция подтверждена двумя и более источниками' },
  { id: 'track',  order: 3, name: 'Сопровождение', description: 'Наблюдается динамика (не менее двух точек во времени)' },
  { id: 'target', order: 4, name: 'Наведение',     description: 'Цель приоритезирована, связи проверены' },
  { id: 'engage', order: 5, name: 'Воздействие',   description: 'Принято решение / назначено действие' },
  { id: 'assess', order: 6, name: 'Оценка',        description: 'Проверен результат, обновлена достоверность' },
]);

export const PHASE_IDS = F2T2EA_PHASES.map(p => p.id);

// ─── Уровни приоритета ────────────────────────────────────────
export const PRIORITY_LEVELS = Object.freeze({
  CRITICAL: { id: 'critical', level: 5, color: '#ff0040', order: 5 },
  HIGH:     { id: 'high',     level: 4, color: '#ff6b35', order: 4 },
  MEDIUM:   { id: 'medium',   level: 3, color: '#ffaa00', order: 3 },
  LOW:      { id: 'low',      level: 2, color: '#22c55e', order: 2 },
  MINIMAL:  { id: 'minimal',  level: 1, color: '#64748b', order: 1 },
});

// ─── Уровни достоверности ─────────────────────────────────────
export const CONFIDENCE_LEVELS = Object.freeze({
  CONFIRMED:  { id: 'confirmed',  level: 5, minSources: 3, note: 'Подтверждено 3+ источниками' },
  PROBABLE:   { id: 'probable',   level: 4, minSources: 2, note: 'Подтверждено 2 источниками' },
  POSSIBLE:   { id: 'possible',   level: 3, minSources: 1, note: 'Один источник' },
  DOUBTFUL:   { id: 'doubtful',   level: 2, minSources: 1, note: 'Источник под вопросом' },
  UNKNOWN:    { id: 'unknown',    level: 1, minSources: 0, note: 'Нет данных' },
});

// ─── Запись цели ──────────────────────────────────────────────
class TargetEntry {
  constructor(nodeId, data = {}) {
    this.nodeId      = nodeId;
    this.phase       = data.phase || 'find';
    this.priority    = data.priority || 'medium';
    this.confidence  = data.confidence || 'unknown';
    this.assignedTo  = data.assignedTo || null;
    this.notes       = Array.isArray(data.notes) ? [...data.notes] : [];
    this.history     = [{ at: Date.now(), phase: this.phase, action: 'created' }];
    this.createdAt   = Date.now();
    this.updatedAt   = Date.now();
    this.engagement  = null;   // { action, at, by, rationale }
    this.assessment  = null;   // { result, at, by, notes }
  }

  advance(newPhase, reason = 'manual') {
    const oldPhase = this.phase;
    if (!PHASE_IDS.includes(newPhase)) return false;
    const oldOrder = F2T2EA_PHASES.find(p => p.id === oldPhase)?.order ?? 0;
    const newOrder = F2T2EA_PHASES.find(p => p.id === newPhase)?.order ?? 0;
    if (newOrder <= oldOrder) return false; // только вперёд
    this.phase = newPhase;
    this.updatedAt = Date.now();
    this.history.push({ at: Date.now(), from: oldPhase, to: newPhase, action: 'advance', reason });
    return true;
  }

  regress(newPhase, reason = 'manual') {
    const oldPhase = this.phase;
    if (!PHASE_IDS.includes(newPhase)) return false;
    const oldOrder = F2T2EA_PHASES.find(p => p.id === oldPhase)?.order ?? 0;
    const newOrder = F2T2EA_PHASES.find(p => p.id === newPhase)?.order ?? 0;
    if (newOrder >= oldOrder) return false;
    this.phase = newPhase;
    this.updatedAt = Date.now();
    this.history.push({ at: Date.now(), from: oldPhase, to: newPhase, action: 'regress', reason });
    return true;
  }

  addNote(text, by = 'operator') {
    if (!text) return;
    this.notes.push({ at: Date.now(), text, by });
    this.updatedAt = Date.now();
  }

  setEngagement({ action, by, rationale }) {
    this.engagement = { action, by, at: Date.now(), rationale: rationale || null };
    this.updatedAt = Date.now();
    this.history.push({ at: Date.now(), action: 'engage', by, rationale });
  }

  setAssessment({ result, by, notes }) {
    this.assessment = { result, by, at: Date.now(), notes: notes || null };
    this.updatedAt = Date.now();
    this.history.push({ at: Date.now(), action: 'assess', by, result });
  }

  toJSON() {
    return {
      nodeId: this.nodeId,
      phase: this.phase,
      priority: this.priority,
      confidence: this.confidence,
      assignedTo: this.assignedTo,
      notes: this.notes,
      history: this.history,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      engagement: this.engagement,
      assessment: this.assessment,
    };
  }
}

// ─── Главный класс ────────────────────────────────────────────
export class TargetWorkbench extends EventEmitter {
  /**
   * @param {EntityGraph} graph — источник узлов
   * @param {EntityModelEngine} model — источник риска и досье
   * @param {Object} options
   * @param {boolean} options.autoAdvance — авто-продвижение фаз по данным (по умолчанию true)
   */
  constructor(graph, model, options = {}) {
    super();
    if (!graph) throw new Error('TargetWorkbench требует EntityGraph');
    if (!model) throw new Error('TargetWorkbench требует EntityModelEngine');
    this.graph = graph;
    this.model = model;
    this.autoAdvance = options.autoAdvance !== false;
    this.targets = new Map(); // nodeId → TargetEntry

    this._wireGraphEvents();
  }

  _wireGraphEvents() {
    this.graph.on('node:added',   (n) => this._onNodeAdded(n));
    this.graph.on('node:updated', (n) => this._onNodeUpdated(n));
    this.graph.on('node:removed', (id) => this.removeTarget(id));
  }

  _onNodeAdded(node) {
    if (!node) return;
    // Автоматическое создание цели для узлов с риском выше среднего
    const risk = this.model.assessRisk(node.id);
    if (risk.score >= 40) {
      this.addTarget(node.id, {
        priority: this._riskToPriority(risk.score),
        confidence: this._inferConfidence(node),
      });
    }
  }

  _onNodeUpdated(node) {
    if (!this.targets.has(node.id)) return;
    if (this.autoAdvance) this._autoAdvance(node.id);
  }

  // ── Преобразования ─────────────────────────────────────────
  _riskToPriority(riskScore) {
    if (riskScore >= 80) return 'critical';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'minimal';
  }

  _inferConfidence(node) {
    const sourceCount = Array.isArray(node.sources) ? node.sources.length : 0;
    if (sourceCount >= 3) return 'confirmed';
    if (sourceCount >= 2) return 'probable';
    if (sourceCount >= 1) return 'possible';
    return 'unknown';
  }

  // ── CRUD целей ─────────────────────────────────────────────
  addTarget(nodeId, data = {}) {
    if (!this.graph.getNode(nodeId)) return null;
    if (this.targets.has(nodeId)) return this.targets.get(nodeId).toJSON();
    const entry = new TargetEntry(nodeId, data);
    this.targets.set(nodeId, entry);
    this.emit('target:added', entry.toJSON());
    return entry.toJSON();
  }

  removeTarget(nodeId) {
    if (!this.targets.has(nodeId)) return false;
    this.targets.delete(nodeId);
    this.emit('target:removed', nodeId);
    return true;
  }

  getTarget(nodeId) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    const node = this.graph.getNode(nodeId);
    const risk = this.model.assessRisk(nodeId);
    return {
      ...entry.toJSON(),
      node: node ? {
        id: node.id, label: node.label, type: node.type,
        country: node.country, lat: node.lat, lon: node.lon,
      } : null,
      risk,
      phaseInfo: F2T2EA_PHASES.find(p => p.id === entry.phase) || null,
      priorityInfo: PRIORITY_LEVELS[entry.priority.toUpperCase()] || null,
      confidenceInfo: CONFIDENCE_LEVELS[entry.confidence.toUpperCase()] || null,
    };
  }

  getAllTargets() {
    return [...this.targets.keys()].map(id => this.getTarget(id)).filter(Boolean);
  }

  // ── Ручные действия ────────────────────────────────────────
  advance(nodeId, targetPhase = null, reason = 'manual') {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    let toPhase = targetPhase;
    if (!toPhase) {
      const idx = PHASE_IDS.indexOf(entry.phase);
      toPhase = PHASE_IDS[Math.min(idx + 1, PHASE_IDS.length - 1)];
    }
    if (entry.advance(toPhase, reason)) {
      this.emit('target:phase', { nodeId, from: entry.history[entry.history.length - 1].from, to: toPhase });
      return entry.toJSON();
    }
    return null;
  }

  regress(nodeId, targetPhase, reason = 'manual') {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    if (entry.regress(targetPhase, reason)) {
      this.emit('target:phase', { nodeId, to: targetPhase, regress: true });
      return entry.toJSON();
    }
    return null;
  }

  setPriority(nodeId, priority) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    const key = String(priority).toUpperCase();
    if (!PRIORITY_LEVELS[key]) return null;
    entry.priority = PRIORITY_LEVELS[key].id;
    entry.updatedAt = Date.now();
    entry.history.push({ at: Date.now(), action: 'priority', to: entry.priority });
    this.emit('target:priority', { nodeId, priority: entry.priority });
    return entry.toJSON();
  }

  setConfidence(nodeId, confidence) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    const key = String(confidence).toUpperCase();
    if (!CONFIDENCE_LEVELS[key]) return null;
    entry.confidence = CONFIDENCE_LEVELS[key].id;
    entry.updatedAt = Date.now();
    entry.history.push({ at: Date.now(), action: 'confidence', to: entry.confidence });
    this.emit('target:confidence', { nodeId, confidence: entry.confidence });
    return entry.toJSON();
  }

  assign(nodeId, operator) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    entry.assignedTo = operator || null;
    entry.updatedAt = Date.now();
    entry.history.push({ at: Date.now(), action: 'assign', to: operator });
    this.emit('target:assigned', { nodeId, operator });
    return entry.toJSON();
  }

  addNote(nodeId, text, by = 'operator') {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    entry.addNote(text, by);
    this.emit('target:note', { nodeId, by });
    return entry.toJSON();
  }

  engage(nodeId, { action, by, rationale }) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    entry.setEngagement({ action, by, rationale });
    if (entry.phase === 'target') entry.advance('engage', 'engagement');
    this.emit('target:engaged', { nodeId, action, by });
    return entry.toJSON();
  }

  assess(nodeId, { result, by, notes }) {
    const entry = this.targets.get(nodeId);
    if (!entry) return null;
    entry.setAssessment({ result, by, notes });
    if (entry.phase === 'engage') entry.advance('assess', 'assessment');
    this.emit('target:assessed', { nodeId, result, by });
    return entry.toJSON();
  }

  // ── Авто-продвижение по данным ────────────────────────────
  _autoAdvance(nodeId) {
    const entry = this.targets.get(nodeId);
    if (!entry) return;
    const node = this.graph.getNode(nodeId);
    if (!node) return;

    const sourceCount = Array.isArray(node.sources) ? node.sources.length : 0;
    const hasCoords = Number.isFinite(node.lat) && Number.isFinite(node.lon);
    const obsCount = Array.isArray(node.observations) ? node.observations.length : 0;
    const degree = (this.graph.getDegree ? this.graph.getDegree(nodeId).total : 0);

    // Правила перехода
    if (entry.phase === 'find' && hasCoords && sourceCount >= 2) {
      entry.advance('fix', 'auto: has coords + 2 sources');
    }
    if (entry.phase === 'fix' && obsCount >= 2) {
      entry.advance('track', 'auto: 2+ observations');
    }
    if (entry.phase === 'track' && degree >= 3) {
      entry.advance('target', 'auto: 3+ connections');
    }
    // engage и assess — только вручную (это решения человека)
  }

  // ── Фильтры и отчёты ──────────────────────────────────────
  query({ phase, priority, confidence, assignedTo, minRisk, limit = 100 } = {}) {
    const results = [];
    for (const [nodeId, entry] of this.targets.entries()) {
      if (phase && entry.phase !== phase) continue;
      if (priority && entry.priority !== priority) continue;
      if (confidence && entry.confidence !== confidence) continue;
      if (assignedTo && entry.assignedTo !== assignedTo) continue;
      if (minRisk !== undefined) {
        const risk = this.model.assessRisk(nodeId);
        if (risk.score < minRisk) continue;
      }
      results.push(this.getTarget(nodeId));
      if (results.length >= limit) break;
    }
    // Сортировка: critical > high > ... , затем по убыванию риска
    results.sort((a, b) => {
      const pa = PRIORITY_LEVELS[a.priority.toUpperCase()]?.order || 0;
      const pb = PRIORITY_LEVELS[b.priority.toUpperCase()]?.order || 0;
      if (pb !== pa) return pb - pa;
      return (b.risk?.score || 0) - (a.risk?.score || 0);
    });
    return results;
  }

  getByPhase() {
    const out = {};
    for (const ph of PHASE_IDS) out[ph] = 0;
    for (const entry of this.targets.values()) out[entry.phase] = (out[entry.phase] || 0) + 1;
    return out;
  }

  getByPriority() {
    const out = {};
    for (const k of Object.keys(PRIORITY_LEVELS)) out[PRIORITY_LEVELS[k].id] = 0;
    for (const entry of this.targets.values()) out[entry.priority] = (out[entry.priority] || 0) + 1;
    return out;
  }

  getByConfidence() {
    const out = {};
    for (const k of Object.keys(CONFIDENCE_LEVELS)) out[CONFIDENCE_LEVELS[k].id] = 0;
    for (const entry of this.targets.values()) out[entry.confidence] = (out[entry.confidence] || 0) + 1;
    return out;
  }

  // ── Экспорт для AI ────────────────────────────────────────
  toAIContext(nodeId = null, { limit = 20 } = {}) {
    if (nodeId) {
      const target = this.getTarget(nodeId);
      if (!target) return null;
      const lines = [
        `ЦЕЛЬ: ${target.node?.label || nodeId}`,
        `Фаза: ${target.phase} (${target.phaseInfo?.name || ''})`,
        `Приоритет: ${target.priority} (${target.priorityInfo?.level || 0}/5)`,
        `Достоверность: ${target.confidence} (${target.confidenceInfo?.note || ''})`,
        `Риск: ${target.risk?.score || 0}/100 (${target.risk?.level || 'unknown'})`,
        `Связей в графе: ${target.node ? '—' : '—'}`,
      ];
      if (target.assignedTo) lines.push(`Ответственный: ${target.assignedTo}`);
      if (target.engagement) lines.push(`Воздействие: ${target.engagement.action} (${target.engagement.by})`);
      if (target.assessment) lines.push(`Оценка: ${target.assessment.result} (${target.assessment.by})`);
      if (target.notes?.length) {
        lines.push('Заметки:');
        for (const n of target.notes.slice(-5)) lines.push(`  [${new Date(n.at).toISOString()}] ${n.by}: ${n.text}`);
      }
      return lines.join('\n');
    }

    // Обзор всех целей
    const all = this.getAllTargets().slice(0, limit);
    const summary = {
      total: this.targets.size,
      byPhase: this.getByPhase(),
      byPriority: this.getByPriority(),
      byConfidence: this.getByConfidence(),
      top: all.map(t => ({
        nodeId: t.nodeId,
        label: t.node?.label,
        phase: t.phase,
        priority: t.priority,
        confidence: t.confidence,
        riskScore: t.risk?.score || 0,
      })),
    };
    return summary;
  }

  // ── Экспорт для карты ─────────────────────────────────────
  toMapFormat() {
    const features = [];
    for (const [nodeId, entry] of this.targets.entries()) {
      const node = this.graph.getNode(nodeId);
      if (!node || !Number.isFinite(node.lat) || !Number.isFinite(node.lon)) continue;
      const risk = this.model.assessRisk(nodeId);
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [node.lon, node.lat] },
        properties: {
          nodeId,
          label: node.label,
          type: node.type,
          phase: entry.phase,
          priority: entry.priority,
          confidence: entry.confidence,
          riskScore: risk.score,
          assignedTo: entry.assignedTo,
        },
      });
    }
    return { type: 'FeatureCollection', features };
  }

  // ── Статистика ────────────────────────────────────────────
  getStats() {
    return {
      totalTargets: this.targets.size,
      byPhase: this.getByPhase(),
      byPriority: this.getByPriority(),
      byConfidence: this.getByConfidence(),
      autoAdvance: this.autoAdvance,
      phases: F2T2EA_PHASES.map(p => ({ id: p.id, name: p.name, order: p.order })),
    };
  }

  // ── Очистка ───────────────────────────────────────────────
  clear() {
    this.targets.clear();
    this.emit('cleared');
  }
}

// ─── Фабрика ───────────────────────────────────────────────────
let _instance = null;

export function getTargetWorkbench(graph, model, options) {
  if (!_instance) {
    if (!graph || !model) throw new Error('Первый вызов getTargetWorkbench требует graph и model');
    _instance = new TargetWorkbench(graph, model, options);
  }
  return _instance;
}

export function resetTargetWorkbench() {
  _instance = null;
}
