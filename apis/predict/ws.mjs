// apis/predict/ws.mjs
// WebSocket-сервер прогностического слоя Crucix.
//
// Назначение:
//   Real-time трансляция прогнозов на дашборд и внешние клиенты.
//   Клиент подключается на ws://localhost:3118, подписывается на типы
//   событий (prediction, alert, signal_high, regime_change), получает
//   push после каждого sweep-цикла.
//
// Особенности:
//   * Hub с буфером последних 50 сообщений — новые клиенты получают
//     мгновенный реплей подходящих событий.
//   * Фильтры по типу события, минимальному уровню риска, минимальному
//     composite и конкретному сигналу.
//   * Rate-limit на количество клиентов (MAX_CLIENTS).
//   * HTTP-эндпоинты /health и /stats для мониторинга.
//   * Публикация из engine.mjs: publishPrediction(result), publishBrierUpdate.
//
// Зависимость:
//   Опционально используется пакет 'ws' (npm install ws).
//   Если его нет — модуль загружается, но wss = null, публикация
//   становится no-op, чтобы engine не падал.

import { createServer } from 'node:http';

// --- Опциональная зависимость ---
let WebSocketServer = null;
let WS_OPEN_CONST = 1;
try {
  const wsModule = await import('ws');
  WebSocketServer = wsModule.WebSocketServer;
  WS_OPEN_CONST = wsModule.WebSocket ? wsModule.WebSocket.OPEN : 1;
} catch {
  // Пакет 'ws' не установлен — работаем в режиме заглушки
}

const DEFAULT_PORT = parseInt(process.env.CRUCIX_WS_PORT || '3118', 10);
const MAX_CLIENTS = 100;
const MESSAGE_BUFFER_SIZE = 50;

// ============================================================
// PredictionHub
// ============================================================

class PredictionHub {
  constructor() {
    this.clients = new Map();
    this.messageHistory = [];
    this.stats = {
      totalConnections: 0,
      totalMessagesSent: 0,
      totalMessagesReceived: 0,
      startedAt: Date.now(),
    };
  }

  register(ws, filters = {}) {
    const id = `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(ws, {
      id,
      filters,
      connectedAt: new Date().toISOString(),
      messagesSent: 0,
    });
    this.stats.totalConnections++;

    this._send(ws, {
      type: 'welcome',
      id,
      filters,
      serverTime: new Date().toISOString(),
      bufferSize: this.messageHistory.length,
    });

    const recent = this.messageHistory.filter((msg) => this._matchesFilters(msg, filters));
    for (const msg of recent.slice(-10)) {
      this._send(ws, { ...msg, _replay: true });
    }

    return id;
  }

  unregister(ws) {
    this.clients.delete(ws);
  }

  publish(message) {
    const enriched = {
      ...message,
      serverTimestamp: new Date().toISOString(),
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    };

    this.messageHistory.push(enriched);
    if (this.messageHistory.length > MESSAGE_BUFFER_SIZE) {
      this.messageHistory.shift();
    }

    let sent = 0;
    for (const [ws, client] of this.clients) {
      if (!this._isOpen(ws)) continue;
      if (!this._matchesFilters(enriched, client.filters)) continue;
      this._send(ws, enriched);
      client.messagesSent++;
      this.stats.totalMessagesSent++;
      sent++;
    }

    return sent;
  }

  _isOpen(ws) {
    return ws && ws.readyState === WS_OPEN_CONST;
  }

  _matchesFilters(msg, filters) {
    if (!filters || Object.keys(filters).length === 0) return true;

    if (filters.type) {
      const types = Array.isArray(filters.type) ? filters.type : [filters.type];
      if (!types.includes(msg.type)) return false;
    }

    if (filters.minLevel && msg.data && msg.data.compositeRisk) {
      const order = { low: 0, moderate: 1, elevated: 2, high: 3, critical: 4 };
      const min = order[filters.minLevel] || 0;
      const curr = order[msg.data.compositeRisk.level] || 0;
      if (curr < min) return false;
    }

    if (typeof filters.minComposite === 'number' && msg.data && msg.data.compositeRisk) {
      if (msg.data.compositeRisk.composite < filters.minComposite) return false;
    }

    if (filters.signal && msg.data && msg.data.compositeRisk && Array.isArray(msg.data.compositeRisk.signals)) {
      const has = msg.data.compositeRisk.signals.some((s) => s.key === filters.signal);
      if (!has) return false;
    }

    return true;
  }

  _send(ws, message) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Игнорируем ошибки отправки
    }
  }

  updateFilters(ws, filters) {
    const client = this.clients.get(ws);
    if (!client) return false;
    client.filters = filters || {};
    return true;
  }

  snapshot() {
    return {
      activeClients: this.clients.size,
      bufferSize: this.messageHistory.length,
      uptimeSeconds: Math.floor((Date.now() - this.stats.startedAt) / 1000),
      totalConnections: this.stats.totalConnections,
      totalMessagesSent: this.stats.totalMessagesSent,
      totalMessagesReceived: this.stats.totalMessagesReceived,
      clients: [...this.clients.values()].map((c) => ({
        id: c.id,
        connectedAt: c.connectedAt,
        messagesSent: c.messagesSent,
        filters: c.filters,
      })),
    };
  }
}

const hub = new PredictionHub();

// ============================================================
// HTTP + WebSocket
// ============================================================

let wss = null;
let httpServer = null;

function startServer(port = DEFAULT_PORT) {
  httpServer = createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);

    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        timestamp: new Date().toISOString(),
        ws: !!wss,
      }));
      return;
    }

    if (url.pathname === '/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(hub.snapshot(), null, 2));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found. Available: /health, /stats, ws://');
  });

  if (WebSocketServer) {
    wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws) => {
      if (hub.clients.size >= MAX_CLIENTS) {
        try { ws.send(JSON.stringify({ type: 'error', message: 'server_full' })); } catch {}
        try { ws.close(); } catch {}
        return;
      }

      hub.register(ws, {});

      ws.on('message', (raw) => {
        hub.stats.totalMessagesReceived++;
        let msg;
        try { msg = JSON.parse(raw.toString()); }
        catch { return; }

        if (msg.action === 'subscribe') {
          hub.updateFilters(ws, msg.filters || {});
          hub._send(ws, { type: 'subscribed', filters: msg.filters || {} });
        } else if (msg.action === 'unsubscribe') {
          hub.updateFilters(ws, {});
          hub._send(ws, { type: 'unsubscribed' });
        } else if (msg.action === 'ping') {
          hub._send(ws, { type: 'pong', timestamp: Date.now() });
        } else if (msg.action === 'stats') {
          hub._send(ws, { type: 'stats', data: hub.snapshot() });
        }
      });

      ws.on('close', () => hub.unregister(ws));
      ws.on('error', () => hub.unregister(ws));
    });
  }

  httpServer.listen(port, () => {
    console.log(`[ws] Crucix Prediction Hub на порту ${port}`);
    console.log(`[ws] WebSocket: ws://localhost:${port}`);
    console.log(`[ws] Health: http://localhost:${port}/health`);
    console.log(`[ws] Stats: http://localhost:${port}/stats`);
    if (!wss) {
      console.warn(`[ws] Пакет 'ws' не установлен — WebSocket-сервер отключён, HTTP работает.`);
    }
  });

  return { httpServer, wss, hub };
}

// ============================================================
// API для engine.mjs
// ============================================================

function publishPrediction(result) {
  if (!wss) return 0;

  hub.publish({ type: 'prediction', data: result });

  if (result && result.compositeRisk) {
    const cr = result.compositeRisk;

    if (cr.level === 'critical' || cr.level === 'high') {
      hub.publish({
        type: 'alert',
        severity: cr.level,
        data: {
          composite: cr.composite,
          level: cr.level,
          topDrivers: cr.topDrivers,
        },
      });
    }

    if (Array.isArray(cr.signals)) {
      for (const sig of cr.signals) {
        if (sig.value > 0.7) {
          hub.publish({
            type: 'signal_high',
            signal: sig.key,
            data: {
              name: sig.name,
              value: sig.value,
              weight: sig.weight,
              rationale: sig.rationale,
            },
          });
        }
      }
    }
  }

  if (result && result.extended && result.extended.changePointVix
      && result.extended.changePointVix.changeProbability > 0.5) {
    hub.publish({
      type: 'regime_change',
      data: {
        changeProbability: result.extended.changePointVix.changeProbability,
        regimeAge: result.extended.changePointVix.regimeAge,
      },
    });
  }

  return 1;
}

function publishBrierUpdate(tracker) {
  if (!wss || !tracker) return 0;
  hub.publish({
    type: 'brier_update',
    data: {
      bySource: tracker.brierBySource || {},
      byHorizon: tracker.brierByHorizon || {},
      ensembleWeights: typeof tracker.getEnsembleWeights === 'function'
        ? tracker.getEnsembleWeights()
        : {},
    },
  });
  return 1;
}

function publishCustom(type, data, extra = {}) {
  if (!wss) return 0;
  return hub.publish({ type, data, ...extra });
}

// CLI-режим
if (process.argv[1] && process.argv[1].endsWith('ws.mjs')) {
  const port = parseInt(process.argv[2] || String(DEFAULT_PORT), 10);
  startServer(port);
}

export {
  PredictionHub,
  hub,
  startServer,
  publishPrediction,
  publishBrierUpdate,
  publishCustom,
  DEFAULT_PORT,
};
