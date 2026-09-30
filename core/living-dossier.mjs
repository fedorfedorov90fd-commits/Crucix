// ═══════════════════════════════════════════════════════════════
//  CRUCIX LIVING DOSSIER v1.0.0
//  Живые досье: автообновление при изменениях в графе.
//  Подписка на EntityGraph через EventEmitter, кэш, метка "устарело".
//  Работает поверх EntityModelEngine. Без fetch().
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';

// ─── Запись кэша одного досье ─────────────────────────────────
class DossierEntry {
  constructor(nodeId, dossier) {
    this.nodeId    = nodeId;
    this.dossier   = dossier;
    this.builtAt   = Date.now();
    this.stale     = false;
    this.hits      = 0;
    this.rebuilds  = 0;
  }

  markStale() { this.stale = true; }
  touch()     { this.hits++; }
}

// ─── Главный класс ────────────────────────────────────────────
export class LivingDossier extends EventEmitter {
  /**
   * @param {EntityModelEngine} model — движок моделей сущностей
   * @param {EntityGraph} graph — граф (события node:*, edge:*)
   * @param {Object} options
   * @param {number} options.ttlMs        — время жизни кэша (по умолчанию 5 минут)
   * @param {boolean} options.autoRebuild — перестраивать сразу при изменении (по умолчанию false)
   * @param {number} options.watchDepth   — глубина соседства для инвалидации (по умолчанию 2)
   */
  constructor(model, graph, options = {}) {
    super();
    if (!model) throw new Error('LivingDossier требует EntityModelEngine');
    if (!graph) throw new Error('LivingDossier требует EntityGraph');

    this.model = model;
    this.graph = graph;
    this.ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 300000;
    this.autoRebuild = options.autoRebuild === true;
    this.watchDepth = Number.isFinite(options.watchDepth) ? options.watchDepth : 2;

    this.cache = new Map();      // nodeId → DossierEntry
    this.dirty = new Set();      // nodeId → нуждается в пересборке

    this._wireGraphEvents();

    this._sweepInterval = setInterval(() => this.sweep(), Math.max(30000, Math.floor(this.ttlMs / 3)));
    if (typeof this._sweepInterval.unref === 'function') this._sweepInterval.unref();
  }

  _wireGraphEvents() {
    this.graph.on('node:added',    (n) => this.invalidate(n.id, 'node:added'));
    this.graph.on('node:updated',  (n) => this.invalidate(n.id, 'node:updated'));
    this.graph.on('node:removed',  (id) => this.invalidate(id, 'node:removed'));
    this.graph.on('edge:added',    (e) => this._invalidateEndpoints(e, 'edge:added'));
    this.graph.on('edge:removed',  (id) => {
      const edge = this.graph.getEdge?.(id);
      if (edge) this._invalidateEndpoints(edge, 'edge:removed');
    });
    this.graph.on('imported',      () => this.invalidateAll('imported'));
    this.graph.on('auto-imported', () => this.invalidateAll('auto-imported'));
    this.graph.on('cleared',       () => this.cache.clear());
  }

  _invalidateEndpoints(edge, reason) {
    if (!edge) return;
    this.invalidate(edge.from, reason);
    this.invalidate(edge.to, reason);
  }

  invalidate(nodeId, reason = 'manual') {
    const entry = this.cache.get(nodeId);
    if (entry) {
      entry.markStale();
      this.dirty.add(nodeId);
      this.emit('dossier:stale', { nodeId, reason });
      if (this.autoRebuild) {
        try { this.rebuild(nodeId); } catch (e) { this.emit('error', { nodeId, error: e.message }); }
      }
    }
  }

  invalidateAll(reason = 'manual') {
    for (const [nodeId, entry] of this.cache.entries()) {
      entry.markStale();
      this.dirty.add(nodeId);
    }
    this.emit('dossier:all-stale', { reason, count: this.cache.size });
  }

  get(nodeId, { force = false } = {}) {
    const entry = this.cache.get(nodeId);
    const now = Date.now();

    if (!force && entry && !entry.stale && (now - entry.builtAt) < this.ttlMs) {
      entry.touch();
      return entry.dossier;
    }

    return this.rebuild(nodeId);
  }

  rebuild(nodeId) {
    const dossier = this.model.buildDossier(nodeId);
    if (!dossier) return null;

    const existing = this.cache.get(nodeId);
    if (existing) {
      existing.dossier = dossier;
      existing.builtAt = Date.now();
      existing.stale = false;
      existing.rebuilds++;
    } else {
      this.cache.set(nodeId, new DossierEntry(nodeId, dossier));
    }

    this.dirty.delete(nodeId);
    this.emit('dossier:rebuilt', { nodeId, riskScore: dossier.riskScore, riskLevel: dossier.riskLevel });
    return dossier;
  }

  getPrompt(nodeId) {
    return this.model.buildDossierPrompt(nodeId);
  }

  getByType(type, { limit = 50, minRisk = 0 } = {}) {
    const results = [];
    for (const node of this.graph.nodes.values()) {
      if (node.type !== type) continue;
      const dossier = this.get(node.id);
      if (!dossier) continue;
      if (dossier.riskScore < minRisk) continue;
      results.push(dossier);
      if (results.length >= limit) break;
    }
    return results.sort((a, b) => b.riskScore - a.riskScore);
  }

  getHighRisk({ limit = 20, minRisk = 50 } = {}) {
    const all = [];
    for (const node of this.graph.nodes.values()) {
      const risk = this.model.assessRisk(node.id);
      if (risk.score < minRisk) continue;
      all.push({ id: node.id, type: node.type, label: node.label, risk });
    }
    all.sort((a, b) => b.risk.score - a.risk.score);
    return all.slice(0, limit);
  }

  toPopupFormat(nodeId) {
    const dossier = this.get(nodeId);
    if (!dossier) return null;
    return {
      id: dossier.id,
      type: dossier.type,
      title: dossier.label,
      subtitle: [dossier.country, dossier.riskLevel].filter(Boolean).join(' · '),
      riskScore: dossier.riskScore,
      riskLevel: dossier.riskLevel,
      credibility: dossier.credibilityAggregate?.aggregated ?? dossier.credibility,
      sourcesCount: dossier.sources?.length ?? 0,
      connectionsTotal: dossier.connections?.total ?? 0,
      topConnections: Object.entries(dossier.connections?.byType || {})
        .flatMap(([type, list]) => list.slice(0, 2).map(c => ({ type, label: c.label, edge: c.edgeType })))
        .slice(0, 5),
      shortDescription: (dossier.description || '').slice(0, 240),
      hasTimeline: (dossier.timeline?.length ?? 0) > 0,
      generatedAt: dossier.generatedAt,
    };
  }

  toTextReport(nodeId) {
    const dossier = this.get(nodeId);
    if (!dossier) return 'Досье не найдено.';
    const lines = [
      '═══════════════════════════════════════════════════════════════',
      `ДОСЬЕ: ${dossier.label} (${dossier.type})`,
      '═══════════════════════════════════════════════════════════════',
      `ID: ${dossier.id}`,
      `Достоверность: ${dossier.credibility}/100`,
      `Риск: ${dossier.riskScore}/100 — ${dossier.riskLevel}`,
      `Степень в графе: ${dossier.degree?.total ?? 0}`,
      `Связей: ${dossier.connections?.total ?? 0}`,
      `Источников: ${dossier.sources?.length ?? 0}`,
      '',
    ];
    if (dossier.description) lines.push('Описание:', dossier.description, '');
    if (dossier.riskFactors?.length) {
      lines.push('Факторы риска:');
      for (const f of dossier.riskFactors) lines.push(`  - ${f}`);
      lines.push('');
    }
    if (dossier.timeline?.length) {
      lines.push(`Хронология (последние ${Math.min(10, dossier.timeline.length)}):`);
      for (const t of dossier.timeline.slice(0, 10)) {
        lines.push(`  ${t.timestamp}  [${t.source}]  ${t.type}`);
      }
      lines.push('');
    }
    lines.push(`Сгенерировано: ${dossier.generatedAt}`);
    return lines.join('\n');
  }

  getStats() {
    let stale = 0, fresh = 0, totalHits = 0, totalRebuilds = 0;
    const now = Date.now();
    for (const entry of this.cache.values()) {
      if (entry.stale || (now - entry.builtAt) >= this.ttlMs) stale++;
      else fresh++;
      totalHits += entry.hits;
      totalRebuilds += entry.rebuilds;
    }
    return {
      cached: this.cache.size,
      fresh,
      stale,
      dirty: this.dirty.size,
      totalHits,
      totalRebuilds,
      ttlMs: this.ttlMs,
      autoRebuild: this.autoRebuild,
      watchDepth: this.watchDepth,
    };
  }

  sweep() {
    const now = Date.now();
    let rebuilt = 0;
    for (const [nodeId, entry] of [...this.cache.entries()]) {
      const isExpired = (now - entry.builtAt) >= this.ttlMs;
      if (entry.stale || isExpired) {
        try {
          if (this.rebuild(nodeId)) rebuilt++;
        } catch (e) {
          this.emit('error', { nodeId, error: e.message });
        }
      }
    }
    if (rebuilt > 0) this.emit('sweep:rebuilt', { count: rebuilt });
    return rebuilt;
  }

  clear(nodeId = null) {
    if (nodeId) {
      this.cache.delete(nodeId);
      this.dirty.delete(nodeId);
    } else {
      this.cache.clear();
      this.dirty.clear();
    }
  }

  shutdown() {
    if (this._sweepInterval) {
      clearInterval(this._sweepInterval);
      this._sweepInterval = null;
    }
    this.removeAllListeners();
  }
}

// ─── Фабрика ───────────────────────────────────────────────────
let _instance = null;

export function getLivingDossier(model, graph, options) {
  if (!_instance) {
    if (!model || !graph) throw new Error('Первый вызов getLivingDossier требует model и graph');
    _instance = new LivingDossier(model, graph, options);
  }
  return _instance;
}

export function resetLivingDossier() {
  if (_instance) _instance.shutdown();
  _instance = null;
}
