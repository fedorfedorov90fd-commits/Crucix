#!/usr/bin/env node

// ============================================================
// NEWSAPI.MJS — Прокси для NewsAPI
// ============================================================

const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '2965aeec21674948b0217e163df31d10';

export async function handleNewsAPIProxy(req, res) {
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

  // ============================================================
  // GET /api/newsapi/ping — статус модуля (для диагностики)
  // ============================================================
  if (path === '/api/newsapi/ping' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      module: 'newsapi',
      status: 'online',
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // ============================================================
  // GET /api/newsapi/search — поиск новостей
  // ============================================================
  if (path === '/api/newsapi/search' && req.method === 'GET') {
    const query = url.searchParams.get('q') || 'global';
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    try {
      const response = await fetch(
        `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&pageSize=${limit}&apiKey=${NEWSAPI_KEY}`
      );
      const data = await response.json();

      if (data.status === 'ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          totalResults: data.totalResults,
          articles: data.articles || []
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: data.message || 'Ошибка NewsAPI'
        }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ============================================================
  // GET /api/newsapi/top — топ-новости по стране
  // ============================================================
  if (path === '/api/newsapi/top' && req.method === 'GET') {
    const country = url.searchParams.get('country') || 'us';
    const limit = parseInt(url.searchParams.get('limit')) || 10;

    try {
      const response = await fetch(
        `https://newsapi.org/v2/top-headlines?country=${country}&pageSize=${limit}&apiKey=${NEWSAPI_KEY}`
      );
      const data = await response.json();

      if (data.status === 'ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          totalResults: data.totalResults,
          articles: data.articles || []
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: data.message || 'Ошибка NewsAPI'
        }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  // ============================================================
  // GET /api/newsapi/sources — список источников
  // ============================================================
  if (path === '/api/newsapi/sources' && req.method === 'GET') {
    try {
      const response = await fetch(
        `https://newsapi.org/v2/top-headlines/sources?apiKey=${NEWSAPI_KEY}`
      );
      const data = await response.json();

      if (data.status === 'ok') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          sources: data.sources || []
        }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: data.message || 'Ошибка NewsAPI'
        }));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: e.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleNewsAPIProxy };
