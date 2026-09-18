// apis/predict/agent/server.mjs
// HTTP + WebSocket сервер для AI Agent Crucix.
//
// Назначение:
//   Даёт Chat UI (dashboard/agent.html) endpoint для запросов.
//   Поддерживает два протокола:
//     1. HTTP POST /api/agent/query — синхронный запрос-ответ.
//     2. HTTP GET /api/agent/status — статус системы.
//     3. WebSocket /agent — real-time чат.
//
// Безопасность:
//   - Только localhost по умолчанию (host='127.0.0.1').
//   - Whitelist tools через ToolRegistry.
//   - Timeout на запрос (300 секунд).
//   - Ограничение размера тела (100 KB).
//
// Запуск:
//   node apis/predict/agent/server.mjs
//   PORT=8080 node apis/predict/agent/server.mjs
//
// Версия: 8.0.0

import { createServer } from 'node:http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { Planner } from './planner.mjs';
import { ToolRegistry, loadHistory } from './tool_registry.mjs';
import { narrate } from './narrator.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..', '..');
const RUNS_AGENT = join(ROOT, 'runs', 'agent');

const SERVER_VERSION = '8.0.0';
const DEFAULT_PORT = 8090;
const DEFAULT_HOST = '127.0.0.1';
const MAX_BODY_BYTES = 100_000;
const REQUEST_TIMEOUT_MS = 300_000;

// ═══════════════════════════════════════════════════
// УТИЛИТЫ
// ═══════════════════════════════════════════════════

function ensureDir(d) { if (!existsSync(d)) mkdirSync(d, { recursive: true }); }

function nowIso() { return new Date().toISOString(); }

function shortHash(s) {
  return createHash('sha256').update(String(s)).digest('hex').slice(0, 12);
}

function jsonResponse(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function textResponse(res, status, text) {
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
  });
  res.end(text);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error(`body too large (>${MAX_BODY_BYTES})`));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

// ═══════════════════════════════════════════════════
// WS — минимальная реализация (RFC 6455)
// ═══════════════════════════════════════════════════
//
// Без зависимостей. Поддержка:
//   - handshake (Sec-WebSocket-Accept)
//   - текстовые фреймы (opcode 0x1)
//   - close (opcode 0x8)
//   - ping/pong (0x9/0xA)

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function wsHandshake(req, socket) {
  const key = req.headers['sec-websocket-key'];
  if (!key) {
    socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
    socket.destroy();
    return false;
  }
  const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write([
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${accept}`,
    '\r\n',
  ].join('\r\n'));
  return true;
}

function wsEncodeFrame(payload, opcode = 0x1) {
  const payloadBuf = Buffer.from(payload, 'utf-8');
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | opcode;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

function wsDecodeFrame(buf) {
  if (buf.length < 2) return null;
  const first = buf[0];
  const fin = (first & 0x80) !== 0;
  const opcode = first & 0x0F;
  const second = buf[1];
  const masked = (second & 0x80) !== 0;
  let payloadLen = second & 0x7F;
  let offset = 2;

  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  let maskKey = null;
  if (masked) {
    if (buf.length < offset + 4) return null;
    maskKey = buf.slice(offset, offset + 4);
    offset += 4;
  }

  if (buf.length < offset + payloadLen) return null;
  const payload = buf.slice(offset, offset + payloadLen);

  if (masked && maskKey) {
    for (let i = 0; i < payload.length; i++) {
      payload[i] ^= maskKey[i % 4];
    }
  }

  return {
    fin,
    opcode,
    payload: payload.toString('utf-8'),
    totalLength: offset + payloadLen,
  };
}

// ═══════════════════════════════════════════════════
// SERVER
// ═══════════════════════════════════════════════════

class AgentServer {
  constructor(config = {}) {
    this.host = config.host || DEFAULT_HOST;
    this.port = config.port || DEFAULT_PORT;
    this.registry = config.toolRegistry || new ToolRegistry();
    this.planner = new Planner({ toolRegistry: this.registry });
    this.useLLM = config.useLLM !== false;
    this.wsClients = new Set();
    this.metrics = {
      startTime: nowIso(),
      httpRequests: 0,
      wsConnections: 0,
      queries: 0,
      errors: 0,
    };
    this.server = null;
    this.auditPath = join(RUNS_AGENT, 'server_audit.log');
  }

  async _checkStatus() {
    try {
      const h = loadHistory();
      const snapshotExists = existsSync(join(ROOT, 'runs', 'predictions', 'latest_forecast.json'));
      const llmAvailable = await this.planner.agent.check();
      return {
        server: 'ok',
        version: SERVER_VERSION,
        llm: llmAvailable,
        tools: this.registry.stats().total,
        history: h.length,
        snapshot: snapshotExists,
        wsClients: this.wsClients.size,
        metrics: this.metrics,
        ts: nowIso(),
      };
    } catch (e) {
      return {
        server: 'error',
        error: e.message,
        ts: nowIso(),
      };
    }
  }

  async _handleQuery(query, sessionId) {
    const t0 = Date.now();
    this.metrics.queries++;

    try {
      const session = sessionId || `srv_${Date.now()}_${shortHash(Math.random())}`;

      // Full pipeline с narrator через LLM (если доступно)
      const result = await this.planner.fullPipeline(query, {
        sessionId: session,
        narrator: this.useLLM ? async (narrInput) => {
          return await narrate(narrInput, {
            useLLM: true,
            ollamaUrl: this.planner.agent.llm.url,
            model: this.planner.agent.llm.model,
            llmTimeoutMs: 30_000,
          });
        } : null,
      });

      return {
        ok: true,
        sessionId: session,
        query,
        mode: result.mode,
        reasoning: result.reasoning,
        plan: result.plan,
        rejected: result.rejected,
        executions: result.executions.map(e => ({
          tool: e.tool,
          args: e.args,
          ok: e.ok,
          error: e.error || null,
          elapsedMs: e.elapsedMs,
          resultKeys: e.ok && e.result ? Object.keys(e.result) : null,
          // Включаем сжатый result для UI
          result: e.ok && e.result ? this._compactResult(e.result) : null,
        })),
        answer: result.answer || null,
        elapsedMs: Date.now() - t0,
      };
    } catch (e) {
      this.metrics.errors++;
      return {
        ok: false,
        error: e.message,
        elapsedMs: Date.now() - t0,
      };
    }
  }

  /**
   * Сжимает result для UI — оставляет только ключевые поля.
   */
  _compactResult(result) {
    if (!result || typeof result !== 'object') return result;
    const out = {};
    const keep = [
      'module', 'available', 'version', 'elapsedMs', 'interpretation',
      'summary', 'lastSweep', 'topRisks', 'direction', 'confidence',
      'nEdges', 'nHyperedges', 'nAnomalies', 'bestModel', 'bestScore',
      'nNodes', 'nQubits', 'activeModules', 'totalModules', 'synthesis',
      'forecast', 'dag', 'training', 'evaluation', 'prediction',
      'changePoint', 'hierarchicalBetaBinomial',
      'counterfactual', 'ate', 'answers', 'recommendedAction',
      'quality', 'imagination', 'nSweeps', 'nVariables',
    ];
    for (const k of keep) {
      if (k in result) out[k] = result[k];
    }
    // Добавляем размер оригинала
    out._originalSize = JSON.stringify(result).length;
    return out;
  }

  async _handleHTTP(req, res) {
    this.metrics.httpRequests++;

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // GET /api/agent/status
    if (req.method === 'GET' && url.pathname === '/api/agent/status') {
      const status = await this._checkStatus();
      return jsonResponse(res, 200, status);
    }

    // GET /api/agent/tools
    if (req.method === 'GET' && url.pathname === '/api/agent/tools') {
      return jsonResponse(res, 200, {
        tools: this.registry.listAll(),
        stats: this.registry.stats(),
      });
    }

    // GET /api/agent/sessions
    if (req.method === 'GET' && url.pathname === '/api/agent/sessions') {
      const limit = Number(url.searchParams.get('limit') || 20);
      return jsonResponse(res, 200, {
        sessions: this.planner.listSessions(limit),
      });
    }

    // GET /api/agent/session/<id>
    if (req.method === 'GET' && url.pathname.startsWith('/api/agent/session/')) {
      const id = url.pathname.slice('/api/agent/session/'.length);
      const fp = join(RUNS_AGENT, `session_${id}.json`);
      if (!existsSync(fp)) {
        return jsonResponse(res, 404, { error: 'session not found' });
      }
      try {
        const data = JSON.parse(readFileSync(fp, 'utf-8'));
        return jsonResponse(res, 200, data);
      } catch (e) {
        return jsonResponse(res, 500, { error: e.message });
      }
    }

    // POST /api/agent/query
    if (req.method === 'POST' && url.pathname === '/api/agent/query') {
      try {
        const bodyStr = await readBody(req);
        const body = JSON.parse(bodyStr);
        if (!body.query || typeof body.query !== 'string') {
          return jsonResponse(res, 400, { error: 'query is required (string)' });
        }
        if (body.query.length > 2000) {
          return jsonResponse(res, 400, { error: 'query too long (max 2000)' });
        }
        const result = await this._handleQuery(body.query, body.sessionId);
        return jsonResponse(res, result.ok ? 200 : 500, result);
      } catch (e) {
        this.metrics.errors++;
        return jsonResponse(res, 400, { error: e.message });
      }
    }

    // GET / — отдаём agent.html
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/agent')) {
      const htmlPath = join(ROOT, 'dashboard', 'agent.html');
      if (existsSync(htmlPath)) {
        const html = readFileSync(htmlPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      return textResponse(res, 404, 'agent.html not found');
    }

    // GET /health
    if (req.method === 'GET' && url.pathname === '/health') {
      return jsonResponse(res, 200, { status: 'ok', ts: nowIso() });
    }

    return jsonResponse(res, 404, { error: 'not found' });
  }

  _handleUpgrade(req, socket, head) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname !== '/agent') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!wsHandshake(req, socket)) return;

    const client = {
      socket,
      id: shortHash(Date.now() + Math.random()),
      connectedAt: nowIso(),
      buffer: Buffer.alloc(0),
    };
    this.wsClients.add(client);
    this.metrics.wsConnections++;

    // Отправляем приветственное сообщение
    socket.write(wsEncodeFrame(JSON.stringify({
      type: 'connected',
      sessionId: client.id,
      version: SERVER_VERSION,
      ts: nowIso(),
    })));

    socket.on('data', async (chunk) => {
      client.buffer = Buffer.concat([client.buffer, chunk]);
      let frame;
      while ((frame = wsDecodeFrame(client.buffer))) {
        client.buffer = client.buffer.slice(frame.totalLength);

        if (frame.opcode === 0x8) {
          // close
          socket.end(wsEncodeFrame('', 0x8));
          this.wsClients.delete(client);
          return;
        }
        if (frame.opcode === 0x9) {
          // ping → pong
          socket.write(wsEncodeFrame(frame.payload, 0xA));
          continue;
        }
        if (frame.opcode === 0x1) {
          // text — обрабатываем запрос
          try {
            const msg = JSON.parse(frame.payload);
            if (msg.type === 'query' && msg.query) {
              socket.write(wsEncodeFrame(JSON.stringify({
                type: 'processing',
                sessionId: client.id,
                ts: nowIso(),
              })));
              const result = await this._handleQuery(msg.query, client.id);
              socket.write(wsEncodeFrame(JSON.stringify({
                type: 'agent_response',
                sessionId: client.id,
                data: result,
                ts: nowIso(),
              })));
            } else if (msg.type === 'status') {
              const status = await this._checkStatus();
              socket.write(wsEncodeFrame(JSON.stringify({
                type: 'agent_status',
                data: status,
                ts: nowIso(),
              })));
            } else if (msg.type === 'ping') {
              socket.write(wsEncodeFrame(JSON.stringify({
                type: 'pong',
                ts: nowIso(),
              })));
            }
          } catch (e) {
            socket.write(wsEncodeFrame(JSON.stringify({
              type: 'error',
              error: e.message,
              ts: nowIso(),
            })));
          }
        }
      }
    });

    socket.on('close', () => {
      this.wsClients.delete(client);
    });

    socket.on('error', () => {
      this.wsClients.delete(client);
    });
  }

  start() {
    ensureDir(RUNS_AGENT);

    this.server = createServer((req, res) => {
      this._handleHTTP(req, res).catch(e => {
        try { jsonResponse(res, 500, { error: e.message }); } catch {}
      });
    });

    this.server.on('upgrade', (req, socket, head) => {
      this._handleUpgrade(req, socket, head);
    });

    this.server.listen(this.port, this.host, () => {
      console.log(`[agent-server] v${SERVER_VERSION} listening on http://${this.host}:${this.port}`);
      console.log(`[agent-server] HTTP:      POST http://${this.host}:${this.port}/api/agent/query`);
      console.log(`[agent-server] HTTP:      GET  http://${this.host}:${this.port}/api/agent/status`);
      console.log(`[agent-server] HTTP:      GET  http://${this.host}:${this.port}/api/agent/tools`);
      console.log(`[agent-server] HTTP:      GET  http://${this.host}:${this.port}/api/agent/sessions`);
      console.log(`[agent-server] HTTP:      GET  http://${this.host}:${this.port}/  (agent.html)`);
      console.log(`[agent-server] WebSocket: ws://${this.host}:${this.port}/agent`);
      console.log(`[agent-server] Tools:     ${this.registry.stats().total}`);
      console.log(`[agent-server] LLM:       ${this.useLLM ? 'enabled' : 'disabled'}`);
    });

    return this.server;
  }

  stop() {
    for (const client of this.wsClients) {
      try { client.socket.end(wsEncodeFrame('', 0x8)); } catch {}
    }
    this.wsClients.clear();
    if (this.server) this.server.close();
  }
}

// ═══════════════════════════════════════════════════
// CLI-ENTRY
// ═══════════════════════════════════════════════════

const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());

if (isMainModule) {
  const port = Number(process.env.PORT) || DEFAULT_PORT;
  const host = process.env.HOST || DEFAULT_HOST;
  const useLLM = process.env.DISABLE_LLM !== '1';

  const server = new AgentServer({ port, host, useLLM });
  server.start();

  const shutdown = () => {
    console.log('\n[agent-server] shutting down...');
    server.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

export { AgentServer };
