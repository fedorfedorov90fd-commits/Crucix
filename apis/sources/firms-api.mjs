#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const DATA_FILE = join(BASKET_DIR, 'firms-data.json');

export async function handleFIRMSAPI(req, res) {
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

  try {
    if (path === '/api/firms/data' && req.method === 'GET') {
      try {
        const content = await fs.readFile(DATA_FILE, 'utf-8');
        const data = JSON.parse(content);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, data }));
        return;
      } catch (e) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Данные не найдены' }));
        return;
      }
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
  } catch (error) {
    console.error('[FIRMS API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка' }));
  }
}

export default { handleFIRMSAPI };
