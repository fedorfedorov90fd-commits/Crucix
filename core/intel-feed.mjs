// ═══════════════════════════════════════════════════════════════
//  CRUCIX INTEL FEED v1.0.0
//  Лента разведсообщений: 10 каналов, дедупликация, severity scoring.
//  Читает из корзины (data/basket/). Пишет в data/basket/intel-feed.json.
// ═══════════════════════════════════════════════════════════════

import { EventEmitter } from 'node:events';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export const CHANNELS = Object.freeze({
  MIL: { code: 'MIL', name: 'Military',       weight: 2.0 },
  CYB: { code: 'CYB', name: 'Cyber',          weight: 1.8 },
  NUC: { code: 'NUC', name: 'Nuclear',        weight: 2.5 },
  GEO: { code: 'GEO', name: 'Geopolitical',   weight: 1.6 },
  INF: { code: 'INF', name: 'Infrastructure', weight: 1.4 },
  ECO: { code: 'ECO', name: 'Economic',       weight: 1.3 },
  HLT: { code: 'HLT', name: 'Health',         weight: 1.3 },
  ENV: { code: 'ENV', name: 'Environmental',  weight: 1.2 },
  SPC: { code: 'SPC', name: 'Space',          weight: 1.2 },
  SOC: { code: 'SOC', name: 'Social',         weight: 1.1 },
});

export const SEVERITY = Object.freeze({
  CRITICAL: { level: 4, name: 'CRITICAL', weight: 100 },
  HIGH:     { level: 3, name: 'HIGH',     weight: 75 },
  ELEVATED: { level: 2, name: 'ELEVATED', weight: 50 },
  LOW:      { level: 1, name: 'LOW',      weight: 25 },
  INFO:     { level: 0, name: 'INFO',     weight: 10 },
});

const KEYWORDS = {
  MIL: ['military','army','missile','strike','troops','nato','войска','удар','ракет'],
  CYB: ['cyber','hack','breach','malware','ransomware','exploit','ddos','взлом','атака'],
  NUC: ['nuclear','reactor','radiation','uranium','ядерн','реактор','радиац'],
  GEO: ['diplomat','treaty','summit','border','annex','дипломат','границ','саммит'],
  INF: ['pipeline','cable','power','grid','infrastructure','трубопровод','кабел','электр'],
  ECO: ['sanction','economy','market','trade','inflation','currency','санкци','эконом','инфляц'],
  HLT: ['outbreak','pandemic','virus','epidemic','заболеван','вирус','эпидем'],
  ENV: ['earthquake','fire','flood','hurricane','storm','землетряс','пожар','наводнен'],
  SPC: ['satellite','launch','orbit','iss','space','спутник','запуск','косм','орбит'],
  SOC: ['protest','riot','unrest','refugee','migration','протест','беспорядк','беженц'],
};

const CRITICAL_WORDS = ['nuclear','war','invasion','coup','assassination','collapse','ядерн','войн','вторжен','переворот','крах'];
const HIGH_WORDS = ['missile','strike','attack','sanction','evacuate','emergency','ракет','удар','атака','санкци','эвакуац','чрезвыч'];

export class IntelFeed extends EventEmitter {
  constructor({ persistPath, maxItems = 10000 } = {}) {
    super();
    this.persistPath = persistPath || join(process.cwd(), 'data', 'basket', 'intel-feed.json');
    this.maxItems = maxItems;
    this.items = [];
    this.dedupKeys = new Set();
    this.subscribers = new Set();
    this._load();
  }

  _load() {
    if (!this.persistPath || !existsSync(this.persistPath)) return;
    try {
      const raw = JSON.parse(readFileSync(this.persistPath, 'utf-8'));
      this.items = Array.isArray(raw.items) ? raw.items : [];
      this.dedupKeys = new Set(raw.dedupKeys || this.items.map(i => i.dedupKey));
    } catch {}
  }

  _save() {
    try {
      const dir = dirname(this.persistPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(this.persistPath, JSON.stringify({
        items: this.items.slice(-this.maxItems),
        dedupKeys: [...this.dedupKeys].slice(-this.maxItems * 2),
      }, null, 2));
    } catch (e) { this.emit('error', { type: 'save', error: e.message }); }
  }

  classifyChannel(text) {
    const t = String(text || '').toLowerCase();
    const scores = {};
    for (const [ch, words] of Object.entries(KEYWORDS)) {
      scores[ch] = words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
    }
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    return best && best[1] > 0 ? best[0] : 'GEO';
  }

  assessSeverity(item) {
    let score = 20;
    const t = `${item.title || ''} ${item.summary || ''}`.toLowerCase();
    if (CRITICAL_WORDS.some(w => t.includes(w))) score += 60;
    if (HIGH_WORDS.some(w => t.includes(w))) score += 30;
    const sc = item.sourceCount || 1;
    if (sc >= 5) score += 20; else if (sc >= 3) score += 10;
    const ch = CHANNELS[item.channel];
    if (ch) score = Math.round(score * ch.weight / 1.5);
    return Math.min(100, score);
  }

  _scoreToSeverity(score) {
    if (score >= 85) return 'CRITICAL';
    if (score >= 60) return 'HIGH';
    if (score >= 35) return 'ELEVATED';
    if (score >= 15) return 'LOW';
    return 'INFO';
  }

  _semanticDedup(item, threshold = 0.65) {
    const words = new Set(String(item.title).toLowerCase().split(/\s+/).filter(w => w.length > 3));
    for (const existing of this.items) {
      const ex = new Set(String(existing.title).toLowerCase().split(/\s+/).filter(w => w.length > 3));
      const inter = [...words].filter(w => ex.has(w)).length;
      const union = new Set([...words, ...ex]).size;
      if (union > 0 && inter / union >= threshold) return existing;
    }
    return null;
  }

  add(item) {
    if (!item || !item.title) return null;
    if (!item.source) return null;

    if (!item.channel || !CHANNELS[item.channel]) {
      item.channel = this.classifyChannel(`${item.title} ${item.summary || ''}`);
    }
    item.dedupKey = item.dedupKey || `${item.source}:${String(item.title).slice(0, 80)}`.toLowerCase();

    if (this.dedupKeys.has(item.dedupKey)) return null;

    const existing = this._semanticDedup(item);
    if (existing) {
      existing.sourceCount = (existing.sourceCount || 1) + 1;
      existing.sources = [...new Set([...(existing.sources || [existing.source]), item.source])].slice(0, 10);
      existing.updatedAt = new Date().toISOString();
      this._save();
      this.emit('item:updated', existing);
      return existing;
    }

    const entry = {
      id: `intel_${Date.now()}_${randomUUID().slice(0, 8)}`,
      title: String(item.title).slice(0, 500),
      summary: String(item.summary || '').slice(0, 2000),
      source: item.source,
      sources: [item.source],
      sourceCount: 1,
      channel: item.channel,
      url: item.url || null,
      lat: Number.isFinite(item.lat) ? item.lat : null,
      lon: Number.isFinite(item.lon) ? item.lon : null,
      country: item.country || null,
      tags: Array.isArray(item.tags) ? item.tags : [],
      timestamp: item.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      severityScore: 0,
      severity: 'INFO',
      dedupKey: item.dedupKey,
      acknowledged: false,
    };
    entry.severityScore = item.severityScore || this.assessSeverity(entry);
    entry.severity = this._scoreToSeverity(entry.severityScore);

    this.items.push(entry);
    this.dedupKeys.add(entry.dedupKey);
    if (this.items.length > this.maxItems) {
      const removed = this.items.shift();
      this.dedupKeys.delete(removed.dedupKey);
    }

    this._save();
    this.emit('item:added', entry);
    for (const cb of this.subscribers) { try { cb(entry); } catch {} }
    return entry;
  }

  addBatch(items) {
    let added = 0, updated = 0;
    for (const it of (items || [])) {
      const before = this.items.length;
      const r = this.add(it);
      if (r && this.items.length > before) added++;
      else if (r) updated++;
    }
    return { added, updated, total: this.items.length };
  }

  query({ channel, severity, country, limit = 100, since, acknowledged, search } = {}) {
    let r = [...this.items];
    if (channel) r = r.filter(i => i.channel === channel);
    if (severity) {
      const minLevel = SEVERITY[severity]?.level ?? 0;
      r = r.filter(i => (SEVERITY[i.severity]?.level ?? 0) >= minLevel);
    }
    if (country) r = r.filter(i => i.country === country);
    if (since) {
      const sinceT = new Date(since).getTime();
      r = r.filter(i => new Date(i.timestamp).getTime() >= sinceT);
    }
    if (acknowledged !== undefined) r = r.filter(i => i.acknowledged === acknowledged);
    if (search) {
      const q = String(search).toLowerCase();
      r = r.filter(i => i.title.toLowerCase().includes(q) || i.summary.toLowerCase().includes(q));
    }
    r.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return r.slice(0, limit);
  }

  acknowledge(id) {
    const it = this.items.find(i => i.id === id);
    if (!it) return false;
    it.acknowledged = true;
    this._save();
    this.emit('item:acknowledged', it);
    return true;
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    return () => this.subscribers.delete(cb);
  }

  getStats() {
    const byChannel = {}, bySeverity = {};
    let last24h = 0, critical = 0, unack = 0;
    const day = Date.now() - 86400000;
    for (const i of this.items) {
      byChannel[i.channel] = (byChannel[i.channel] || 0) + 1;
      bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      if (new Date(i.timestamp).getTime() > day) last24h++;
      if (i.severity === 'CRITICAL') critical++;
      if (!i.acknowledged && (SEVERITY[i.severity]?.level ?? 0) >= 2) unack++;
    }
    return { total: this.items.length, byChannel, bySeverity, last24h, critical, unacknowledged: unack };
  }
}

let _instance = null;
export function getIntelFeed(options) {
  if (!_instance) _instance = new IntelFeed(options);
  return _instance;
}
export function resetIntelFeed() { _instance = null; }
