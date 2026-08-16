#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const HISTORY_FILE = join(ROOT, 'data', 'geo', 'index-history.json');

const DEMO_DATA = [
  { date: '2026-08-10', value: 5.0 },
  { date: '2026-08-11', value: 4.8 },
  { date: '2026-08-12', value: 4.5 },
  { date: '2026-08-13', value: 4.2 },
  { date: '2026-08-14', value: 3.9 },
  { date: '2026-08-15', value: 3.7 },
  { date: '2026-08-16', value: 3.5 }
];

export async function handleGlobalIndexAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /api/geo/index — главный эндпоинт для jarvis
  if (path === '/api/geo/index' && req.method === 'GET') {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      const history = JSON.parse(data);
      const current = history[history.length - 1] || { value: 3.5 };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        current: current.value,
        history: history,
        trend: 'stable',
        level: 'medium'
      }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, current: 3.5, history: DEMO_DATA }));
    }
    return;
  }

  // GET /api/geo/index/history — история
  if (path === '/api/geo/index/history' && req.method === 'GET') {
    try {
      const data = await fs.readFile(HISTORY_FILE, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history: JSON.parse(data) }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, history: DEMO_DATA }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleGlobalIndexAPI };
