#!/usr/bin/env node

// ============================================================
// МОДУЛЬ №56: P2P-ОБМЕН ДАННЫМИ (DECENTRALIZED DATA EXCHANGE)
// ============================================================
// Децентрализованная сеть обмена анонимными данными
// Общий реестр предупреждений и событий
// Рейтинг доверия к источникам
// Версия: 2.0 (с внешними источниками и синхронизацией)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'p2p');
const PEERS_FILE = join(DATA_DIR, 'peers.json');
const SHARED_FILE = join(DATA_DIR, 'shared.json');
const TRUST_FILE = join(DATA_DIR, 'trust.json');
const SYNC_FILE = join(DATA_DIR, 'sync.json');

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================

const DEFAULT_PEERS = [
  { id: 'peer-001', name: 'Crucix Alpha', status: 'online', last_seen: null, trust_score: 85, ip: '192.168.1.101', port: 3117 },
  { id: 'peer-002', name: 'Crucix Beta', status: 'online', last_seen: null, trust_score: 72, ip: '192.168.1.102', port: 3117 },
  { id: 'peer-003', name: 'Crucix Gamma', status: 'online', last_seen: null, trust_score: 68, ip: '192.168.1.103', port: 3117 },
  { id: 'peer-004', name: 'Crucix Delta', status: 'online', last_seen: null, trust_score: 91, ip: '192.168.1.104', port: 3117 },
  { id: 'peer-005', name: 'Crucix Epsilon', status: 'online', last_seen: null, trust_score: 55, ip: '192.168.1.105', port: 3117 }
];

// ============================================================
// 2. ВНЕШНИЕ ИСТОЧНИКИ ДАННЫХ
// ============================================================

const EXTERNAL_SOURCES = [
  {
    id: 'gdelt',
    name: 'GDELT',
    url: 'https://api.gdeltproject.org/api/v2/doc/doc',
    type: 'news',
    enabled: true,
    last_sync: null
  },
  {
    id: 'acled',
    name: 'ACLED (Conflict Data)',
    url: 'https://api.acleddata.com/acled/read',
    type: 'conflict',
    enabled: true,
    last_sync: null
  },
  {
    id: 'newsapi',
    name: 'NewsAPI',
    url: 'https://newsapi.org/v2/top-headlines',
    type: 'news',
    enabled: true,
    last_sync: null
  },
  {
    id: 'usgs',
    name: 'USGS Earthquakes',
    url: 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
    type: 'natural',
    enabled: true,
    last_sync: null
  },
  {
    id: 'firms',
    name: 'NASA FIRMS (Fires)',
    url: 'https://firms.modaps.eosdis.nasa.gov/api/area/csv',
    type: 'natural',
    enabled: true,
    last_sync: null
  }
];

// ============================================================
// 3. КЛАСС P2P-СЕТИ (РАСШИРЕННЫЙ)
// ============================================================

class P2PNetwork {
  constructor() {
    this.peers = [];
    this.shared = [];
    this.trust = {};
    this.sync = {
      last_sync: null,
      external_updates: 0,
      peer_updates: 0
    };
    this.externalSources = EXTERNAL_SOURCES;
  }

  async init() {
    await this.ensureDirs();
    await this.loadPeers();
    await this.loadShared();
    await this.loadTrust();
    await this.loadSync();
    console.log('[P2P] Децентрализованная сеть инициализирована');
  }

  async ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }

  async loadPeers() {
    try {
      const data = await fs.readFile(PEERS_FILE, 'utf-8');
      this.peers = JSON.parse(data);
    } catch (e) {
      this.peers = DEFAULT_PEERS.map(p => ({
        ...p,
        last_seen: new Date().toISOString()
      }));
      await this.savePeers();
    }
  }

  async savePeers() {
    await fs.writeFile(PEERS_FILE, JSON.stringify(this.peers, null, 2));
  }

  async loadShared() {
    try {
      const data = await fs.readFile(SHARED_FILE, 'utf-8');
      this.shared = JSON.parse(data);
    } catch (e) {
      this.shared = [];
      await this.saveShared();
    }
  }

  async saveShared() {
    await fs.writeFile(SHARED_FILE, JSON.stringify(this.shared, null, 2));
  }

  async loadTrust() {
    try {
      const data = await fs.readFile(TRUST_FILE, 'utf-8');
      this.trust = JSON.parse(data);
    } catch (e) {
      this.trust = {};
      for (const peer of this.peers) {
        this.trust[peer.id] = {
          score: peer.trust_score || 50,
          contributions: 0,
          verifications: 0,
          reports: 0,
          last_updated: new Date().toISOString()
        };
      }
      await this.saveTrust();
    }
  }

  async saveTrust() {
    await fs.writeFile(TRUST_FILE, JSON.stringify(this.trust, null, 2));
  }

  async loadSync() {
    try {
      const data = await fs.readFile(SYNC_FILE, 'utf-8');
      this.sync = JSON.parse(data);
    } catch (e) {
      this.sync = {
        last_sync: null,
        external_updates: 0,
        peer_updates: 0
      };
      await this.saveSync();
    }
  }

  async saveSync() {
    await fs.writeFile(SYNC_FILE, JSON.stringify(this.sync, null, 2));
  }

  // ============================================================
  // 3.1. СИНХРОНИЗАЦИЯ С ВНЕШНИМИ ИСТОЧНИКАМИ
  // ============================================================

  async syncExternal() {
    const results = [];
    let totalUpdates = 0;

    for (const source of this.externalSources) {
      if (!source.enabled) continue;
      
      try {
        // Симулируем получение данных от внешнего источника
        // В реальном проекте здесь были бы реальные API-запросы
        const mockData = this.generateMockData(source);
        
        // Добавляем данные в общий реестр
        for (const item of mockData) {
          const entry = await this.addShared(item, 'external', source.id);
          if (entry) totalUpdates++;
        }
        
        source.last_sync = new Date().toISOString();
        results.push({
          source: source.id,
          status: 'success',
          items: mockData.length,
          timestamp: source.last_sync
        });
      } catch (e) {
        results.push({
          source: source.id,
          status: 'error',
          error: e.message
        });
      }
    }

    this.sync.last_sync = new Date().toISOString();
    this.sync.external_updates += totalUpdates;
    await this.saveSync();

    return {
      synced: true,
      timestamp: this.sync.last_sync,
      sources: results,
      total_updates: totalUpdates
    };
  }

  generateMockData(source) {
    const mockItems = [];
    const count = Math.floor(Math.random() * 3) + 1;
    
    const templates = {
      news: [
        { title: 'Новый виток геополитической напряжённости', type: 'geopolitical', severity: 'high', region: 'global' },
        { title: 'Крупный экономический форум начал работу', type: 'economic', severity: 'medium', region: 'global' },
        { title: 'Политические изменения в регионе', type: 'geopolitical', severity: 'medium', region: 'europe' }
      ],
      conflict: [
        { title: 'Военные столкновения на границе', type: 'military', severity: 'critical', region: 'middle-east' },
        { title: 'Переговоры о прекращении огня', type: 'geopolitical', severity: 'high', region: 'asia-pacific' }
      ],
      natural: [
        { title: 'Землетрясение магнитудой 6.0 в регионе', type: 'natural', severity: 'high', region: 'asia-pacific' },
        { title: 'Массовые пожары в лесных массивах', type: 'natural', severity: 'medium', region: 'americas' }
      ]
    };

    const sourceTemplates = templates[source.type] || templates.news;
    
    for (let i = 0; i < count && i < sourceTemplates.length; i++) {
      const template = sourceTemplates[i % sourceTemplates.length];
      mockItems.push({
        title: template.title + ` (${source.id})`,
        description: `Данные из источника ${source.name}`,
        type: template.type,
        severity: template.severity,
        region: template.region,
        source: source.id
      });
    }
    
    return mockItems;
  }

  // ============================================================
  // 3.2. СИНХРОНИЗАЦИЯ С ПИРАМИ
  // ============================================================

  async syncPeers() {
    const results = [];
    let totalUpdates = 0;

    // Симулируем синхронизацию с другими пирами
    for (const peer of this.peers) {
      if (peer.status === 'online') {
        // Симулируем получение данных от пира
        const mockData = this.generatePeerData(peer);
        
        for (const item of mockData) {
          const entry = await this.addShared(item, peer.id);
          if (entry) totalUpdates++;
        }
        
        peer.last_seen = new Date().toISOString();
        results.push({
          peer: peer.id,
          peer_name: peer.name,
          status: 'success',
          items: mockData.length
        });
      }
    }

    this.sync.peer_updates += totalUpdates;
    await this.saveSync();
    await this.savePeers();

    return {
      synced: true,
      timestamp: new Date().toISOString(),
      peers: results,
      total_updates: totalUpdates
    };
  }

  generatePeerData(peer) {
    const mockItems = [];
    const count = Math.floor(Math.random() * 2) + 1;
    
    const templates = [
      { title: `Сигнал от ${peer.name}`, type: 'general', severity: 'medium', region: 'global' },
      { title: `Предупреждение от ${peer.name}`, type: 'geopolitical', severity: 'high', region: 'europe' }
    ];

    for (let i = 0; i < count && i < templates.length; i++) {
      const template = templates[i % templates.length];
      mockItems.push({
        title: template.title,
        description: `Синхронизировано с ${peer.name}`,
        type: template.type,
        severity: template.severity,
        region: template.region,
        source: peer.id
      });
    }
    
    return mockItems;
  }

  // ============================================================
  // 3.3. ОБЩИЙ РЕЕСТР (РАСШИРЕННЫЙ)
  // ============================================================

  async addShared(data, sourceId, sourceType = 'peer') {
    const id = `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      id,
      type: data.type || 'general',
      severity: data.severity || 'medium',
      region: data.region || 'global',
      title: data.title || 'Новое предупреждение',
      description: data.description || '',
      source: sourceId || 'anonymous',
      source_type: sourceType || 'peer',
      timestamp: new Date().toISOString(),
      verified: false,
      verification_count: 0,
      hash: createHash('sha256').update(JSON.stringify(data) + Date.now()).digest('hex')
    };
    
    this.shared.push(entry);
    await this.saveShared();

    // Обновляем рейтинг доверия источника
    if (sourceId && this.trust[sourceId]) {
      this.trust[sourceId].contributions += 1;
      this.trust[sourceId].score = Math.min(100, this.trust[sourceId].score + 1);
      await this.saveTrust();
    }

    return entry;
  }

  // ============================================================
  // 3.4. СТАТИСТИКА (РАСШИРЕННАЯ)
  // ============================================================

  getStats() {
    const totalPeers = this.peers.length;
    const onlinePeers = this.peers.filter(p => p.status === 'online').length;
    const totalShared = this.shared.length;
    const verified = this.shared.filter(d => d.verified).length;
    const bySeverity = {
      critical: this.shared.filter(d => d.severity === 'critical').length,
      high: this.shared.filter(d => d.severity === 'high').length,
      medium: this.shared.filter(d => d.severity === 'medium').length,
      low: this.shared.filter(d => d.severity === 'low').length
    };
    const byType = {};
    for (const item of this.shared) {
      byType[item.type] = (byType[item.type] || 0) + 1;
    }
    const externalSources = this.externalSources.filter(s => s.enabled).length;

    return {
      total_peers: totalPeers,
      online_peers: onlinePeers,
      total_shared: totalShared,
      verified: verified,
      by_severity: bySeverity,
      by_type: byType,
      external_sources: externalSources,
      trust_average: Object.values(this.trust).reduce((sum, t) => sum + t.score, 0) / Object.values(this.trust).length || 0,
      last_sync: this.sync.last_sync,
      external_updates: this.sync.external_updates || 0,
      peer_updates: this.sync.peer_updates || 0
    };
  }

  getExternalSources() {
    return this.externalSources;
  }

  async toggleSource(id) {
    const source = this.externalSources.find(s => s.id === id);
    if (source) {
      source.enabled = !source.enabled;
      await this.saveSync();
      return source;
    }
    return null;
  }
}

// ============================================================
// 4. HTTP-ОБРАБОТЧИК (РАСШИРЕННЫЙ)
// ============================================================

let p2p = null;

async function getP2P() {
  if (!p2p) {
    p2p = new P2PNetwork();
    await p2p.init();
  }
  return p2p;
}

export async function handleP2PAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    const p2p = await getP2P();

    // GET /api/p2p/status — статус сети
    if (path === '/api/p2p/status' && req.method === 'GET') {
      const stats = p2p.getStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'p2p',
        status: 'online',
        stats: stats,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    // GET /api/p2p/peers — список пиров
    if (path === '/api/p2p/peers' && req.method === 'GET') {
      const peers = p2p.getPeers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, peers, total: peers.length }));
      return;
    }

    // POST /api/p2p/peers — добавить пира
    if (path === '/api/p2p/peers' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const peer = await p2p.addPeer(data.name);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, peer }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/p2p/shared — общий реестр
    if (path === '/api/p2p/shared' && req.method === 'GET') {
      const type = url.searchParams.get('type');
      const severity = url.searchParams.get('severity');
      const region = url.searchParams.get('region');
      const verified = url.searchParams.get('verified');
      const shared = p2p.getShared({ type, severity, region, verified });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, shared, total: shared.length }));
      return;
    }

    // POST /api/p2p/shared — добавить запись
    if (path === '/api/p2p/shared' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const entry = await p2p.addShared(data, data.peerId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, entry }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/p2p/verify/:id — верификация
    if (path.startsWith('/api/p2p/verify/') && req.method === 'POST') {
      const id = path.split('/').pop();
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const entry = await p2p.verifyShared(id, data.peerId);
          if (entry) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, entry }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Запись не найдена' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // POST /api/p2p/report/:id — сообщить о ложной информации
    if (path.startsWith('/api/p2p/report/') && req.method === 'POST') {
      const id = path.split('/').pop();
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body);
          const entry = await p2p.reportFalse(id, data.peerId);
          if (entry) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, entry }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'Запись не найдена' }));
          }
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: e.message }));
        }
      });
      return;
    }

    // GET /api/p2p/trust — рейтинг доверия
    if (path === '/api/p2p/trust' && req.method === 'GET') {
      const trust = p2p.getTrust();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, trust }));
      return;
    }

    // POST /api/p2p/sync — полная синхронизация
    if (path === '/api/p2p/sync' && req.method === 'POST') {
      const result = await p2p.syncPeers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // POST /api/p2p/sync/external — синхронизация с внешними источниками
    if (path === '/api/p2p/sync/external' && req.method === 'POST') {
      const result = await p2p.syncExternal();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, result }));
      return;
    }

    // GET /api/p2p/sources — список внешних источников
    if (path === '/api/p2p/sources' && req.method === 'GET') {
      const sources = p2p.getExternalSources();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, sources }));
      return;
    }

    // POST /api/p2p/sources/toggle/:id — включить/выключить источник
    if (path.startsWith('/api/p2p/sources/toggle/') && req.method === 'POST') {
      const id = path.split('/').pop();
      const source = await p2p.toggleSource(id);
      if (source) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, source }));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Источник не найден' }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[P2P API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка', details: error.message }));
  }
}

export default { handleP2PAPI, P2PNetwork };
