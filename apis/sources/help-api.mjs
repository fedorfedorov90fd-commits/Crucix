#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const HELP_DIR = join(ROOT, 'data', 'help');

export async function handleHelpAPI(req, res) {
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

  // GET /api/help/{page}?lang=ru
  if (path.startsWith('/api/help/') && req.method === 'GET') {
    const page = path.split('/').pop();
    const lang = url.searchParams.get('lang') || 'ru';
    
    const helpFile = join(HELP_DIR, lang, `${page}.txt`);
    
    try {
      const content = await fs.readFile(helpFile, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(content);
    } catch (e) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`Справка для страницы "${page}" не найдена на языке "${lang}".\n\nСоздайте файл: /data/help/${lang}/${page}.txt`);
    }
    return;
  }

  // GET /api/help/list — список всех страниц со справкой
  if (path === '/api/help/list' && req.method === 'GET') {
    try {
      const ruDir = join(HELP_DIR, 'ru');
      const files = await fs.readdir(ruDir);
      const pages = files.filter(f => f.endsWith('.txt')).map(f => f.replace('.txt', ''));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pages }));
    } catch (e) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, pages: [] }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleHelpAPI };
