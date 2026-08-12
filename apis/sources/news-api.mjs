#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const DATA_DIR = join(ROOT, 'data', 'raw');

// Получить новости за указанную дату
export async function getNewsByDate(date) {
  try {
    const filePath = join(DATA_DIR, `feeds_${date}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
}

// Получить новости за сегодня (или последние доступные)
export async function getLatestNews() {
  // Пытаемся получить сегодняшние
  const today = new Date().toISOString().slice(0, 10);
  let news = await getNewsByDate(today);
  
  if (news.length === 0) {
    // Если сегодня нет — берём вчерашние
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yDate = yesterday.toISOString().slice(0, 10);
    news = await getNewsByDate(yDate);
  }
  
  if (news.length === 0) {
    // Если и вчера нет — берём любые доступные
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter(f => f.startsWith('feeds_') && f.endsWith('.json'));
    if (jsonFiles.length > 0) {
      const latestFile = jsonFiles[jsonFiles.length - 1];
      const content = await fs.readFile(join(DATA_DIR, latestFile), 'utf-8');
      news = JSON.parse(content);
    }
  }
  
  return news;
}

// HTTP-обработчик для API новостей
export async function handleNewsAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // /api/news/daily — получить новости за сегодня
  if (pathname === '/api/news/daily' && req.method === 'GET') {
    const date = url.searchParams.get('date') || new Date().toISOString().slice(0, 10);
    const news = await getNewsByDate(date);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      date: date,
      total: news.length,
      news: news.slice(0, 100) // Ограничиваем до 100
    }));
    return;
  }
  
  // /api/news/latest — получить последние новости
  if (pathname === '/api/news/latest' && req.method === 'GET') {
    const limit = parseInt(url.searchParams.get('limit')) || 50;
    const news = await getLatestNews();
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      total: news.length,
      news: news.slice(0, limit)
    }));
    return;
  }
  
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}
