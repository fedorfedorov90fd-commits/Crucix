#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const execAsync = promisify(exec);

// Оценка новости через Ollama
export async function rateNewsWithAI(title, summary) {
  try {
    const prompt = `
Оцени важность этой новости по шкале от 0 до 10.
0 — совсем неважно, 10 — критически важно.

Новость: ${title}
Краткое содержание: ${summary || 'Нет содержания'}

Дай только число от 0 до 10. Никаких пояснений.
`;

    const { stdout, stderr } = await execAsync(
      `ollama run deepseek-r1:1.5b "${prompt.replace(/"/g, '\\"')}"`,
      { timeout: 30000 }
    );

    if (stderr) console.error('AI stderr:', stderr);
    
    const score = parseInt(stdout.trim());
    if (!isNaN(score) && score >= 0 && score <= 10) {
      return score;
    }
    
    // Если не удалось распарсить — возвращаем случайную оценку
    return Math.floor(Math.random() * 5) + 3;
  } catch (e) {
    console.error('AI ошибка:', e.message);
    // Возвращаем случайную оценку при ошибке
    return Math.floor(Math.random() * 5) + 3;
  }
}

// Оценка нескольких новостей
export async function rateMultipleNews(newsArray) {
  const results = [];
  let processed = 0;
  
  for (const news of newsArray) {
    processed++;
    if (processed % 5 === 0) {
      console.log(`AI: оценено ${processed}/${newsArray.length}`);
    }
    
    const score = await rateNewsWithAI(news.title, news.summary || news.description);
    results.push({
      ...news,
      ai_score: score,
      ai_importance: score >= 8 ? 'critical' : score >= 5 ? 'important' : 'normal'
    });
    
    // Задержка между запросами
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  return results;
}

// HTTP-обработчик
export async function handleAIRatingAPI(req, res) {
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
  
  // /api/ai/rate — оценить новости
  if (pathname === '/api/ai/rate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const news = data.news || [];
        
        if (!news || news.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'Нет новостей для оценки' }));
          return;
        }
        
        // Ограничиваем количество для оценки
        const toRate = news.slice(0, 20);
        const rated = await rateMultipleNews(toRate);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          total: rated.length,
          news: rated
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }
  
  // /api/ai/score — оценить одну новость
  if (pathname === '/api/ai/score' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const score = await rateNewsWithAI(data.title, data.summary);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          score: score,
          importance: score >= 8 ? 'critical' : score >= 5 ? 'important' : 'normal'
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
