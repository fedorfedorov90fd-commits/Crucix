#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'raw');
const CONFIG_FILE = join(ROOT, 'data', 'storage-config.json');

// Загрузка конфигурации
async function loadConfig() {
  try {
    const content = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { days: 7 };
  }
}

// Сохранение конфигурации
async function saveConfig(config) {
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
  return config;
}

// Получение списка файлов с данными
async function getDataFiles() {
  try {
    const files = await fs.readdir(DATA_DIR);
    return files.filter(f => f.startsWith('feeds_') && f.endsWith('.json'));
  } catch (e) {
    return [];
  }
}

// Получение размера папки
async function getFolderSize() {
  try {
    const files = await getDataFiles();
    let total = 0;
    for (const file of files) {
      const stat = await fs.stat(join(DATA_DIR, file));
      total += stat.size;
    }
    return total;
  } catch (e) {
    return 0;
  }
}

// Очистка старых файлов
async function cleanOldFiles(days) {
  const now = Date.now();
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  const files = await getDataFiles();
  let deleted = 0;
  let size = 0;
  
  for (const file of files) {
    const filePath = join(DATA_DIR, file);
    const stat = await fs.stat(filePath);
    if (stat.mtimeMs < cutoff) {
      size += stat.size;
      await fs.unlink(filePath);
      deleted++;
    }
  }
  
  return { deleted, size, remaining: files.length - deleted };
}

// HTTP-обработчик
export async function handleStorageAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // GET /api/storage/config — получить настройки
  if (pathname === '/api/storage/config' && req.method === 'GET') {
    const config = await loadConfig();
    const files = await getDataFiles();
    const size = await getFolderSize();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      config,
      files: files.length,
      size: size,
      sizeHuman: (size / 1024 / 1024).toFixed(2) + ' MB'
    }));
    return;
  }

  // POST /api/storage/config — обновить настройки
  if (pathname === '/api/storage/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const days = parseInt(data.days);
        if (isNaN(days) || days < 1 || days > 730) {
          throw new Error('Дней должно быть от 1 до 730');
        }
        const config = await saveConfig({ days });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // POST /api/storage/clean — очистить старые файлы
  if (pathname === '/api/storage/clean' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const days = parseInt(data.days) || 7;
        const result = await cleanOldFiles(days);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          deleted: result.deleted,
          size: (result.size / 1024 / 1024).toFixed(2) + ' MB',
          remaining: result.remaining
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}
