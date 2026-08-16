#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const TRUST_LEVELS = join(ROOT, 'data', 'trust', 'levels.json');
const MODULES_CONFIG = join(ROOT, 'data', 'trust', 'modules.json');
const DIAG_DIR = join(ROOT, 'data', 'diagnostics');

async function loadTrustLevels() {
  try {
    const data = await fs.readFile(TRUST_LEVELS, 'utf-8');
    return JSON.parse(data);
  } catch { return { core: [], trusted: [], user: [], blocked: [] }; }
}

async function loadModulesConfig() {
  try {
    const data = await fs.readFile(MODULES_CONFIG, 'utf-8');
    return JSON.parse(data);
  } catch { return {}; }
}

async function saveModulesConfig(config) {
  await fs.mkdir(join(ROOT, 'data', 'trust'), { recursive: true });
  await fs.writeFile(MODULES_CONFIG, JSON.stringify(config, null, 2));
}

function getTrustColor(level) {
  const colors = { core: '#5bc0f8', trusted: '#4caf50', user: '#f97316', blocked: '#ef4444' };
  return colors[level] || '#6b7280';
}

function getTrustLabel(level) {
  const labels = { core: 'Ядро', trusted: 'Проверенный', user: 'Пользовательский', blocked: 'Заблокирован' };
  return labels[level] || 'Неизвестно';
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================
export async function handleDiagnosticsAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  // GET /api/diagnostics/status
  if (path === '/api/diagnostics/status' && req.method === 'GET') {
    const trust = await loadTrustLevels();
    const config = await loadModulesConfig();
    const allModules = Object.keys(config);
    const enabled = allModules.filter(m => config[m]?.enabled !== false);
    const blocked = allModules.filter(m => config[m]?.trust === 'blocked');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      module: 'diagnostics',
      status: 'online',
      stats: {
        total: allModules.length,
        enabled: enabled.length,
        blocked: blocked.length,
        core: trust.core?.length || 0,
        trusted: trust.trusted?.length || 0,
        user: trust.user?.length || 0
      },
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // GET /api/diagnostics/pages — проверка всех страниц
  if (path === '/api/diagnostics/pages' && req.method === 'GET') {
    const baseUrl = `http://localhost:3117`;
    const config = await loadModulesConfig();
    const pages = Object.keys(config);
    const results = [];

    for (const page of pages) {
      const enabled = config[page]?.enabled !== false;
      const trust = config[page]?.trust || 'user';
      const start = Date.now();

      try {
        const resp = await fetch(`${baseUrl}/${page}`, {
          signal: AbortSignal.timeout(3000)
        });
        const end = Date.now();
        results.push({
          page,
          status: resp.ok ? 'online' : 'error',
          code: resp.status,
          time: end - start,
          enabled,
          trust,
          color: getTrustColor(trust),
          label: getTrustLabel(trust)
        });
      } catch (e) {
        results.push({
          page,
          status: 'offline',
          code: null,
          time: null,
          enabled,
          trust,
          color: getTrustColor(trust),
          label: getTrustLabel(trust),
          error: e.message
        });
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, pages: results }));
    return;
  }

  // POST /api/diagnostics/toggle — включить/выключить модуль
  if (path === '/api/diagnostics/toggle' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { page, enabled } = data;
        const config = await loadModulesConfig();
        if (!config[page]) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Страница не найдена' }));
          return;
        }
        config[page].enabled = enabled;
        await saveModulesConfig(config);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, page, enabled }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // POST /api/diagnostics/block — заблокировать модуль
  if (path === '/api/diagnostics/block' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { page } = data;
        const config = await loadModulesConfig();
        const trust = await loadTrustLevels();
        if (!config[page]) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Страница не найдена' }));
          return;
        }
        config[page].trust = 'blocked';
        config[page].enabled = false;
        if (!trust.blocked.includes(page)) {
          trust.blocked.push(page);
        }
        await saveModulesConfig(config);
        await fs.writeFile(TRUST_LEVELS, JSON.stringify(trust, null, 2));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, page, blocked: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // GET /api/diagnostics/trust — получить уровни доверия
  if (path === '/api/diagnostics/trust' && req.method === 'GET') {
    const trust = await loadTrustLevels();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, trust }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleDiagnosticsAPI };
