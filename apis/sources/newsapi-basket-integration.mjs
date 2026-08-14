#!/usr/bin/env node

// ============================================================
// NEWSAPI-BASKET-INTEGRATION — Сбор новостей в корзину
// ============================================================
// Собирает новости из NewsAPI и добавляет их в корзину данных
// Версия: 2.0
// ============================================================

import { searchNews, getTopNews } from './newsapi.mjs';
import { addToBasket } from './basket-api.mjs';

// ============================================================
// 1. ОСНОВНАЯ ФУНКЦИЯ — СБОР НОВОСТЕЙ В КОРЗИНУ
// ============================================================

export async function collectNewsToBasket(options = {}) {
  const {
    query = 'world',
    country = null,
    category = null,
    maxItems = 20,
    addToBasket = true
  } = options;

  try {
    console.log('[NewsAPI Basket] Начинаю сбор новостей...');

    let result;

    // Если указана страна — используем топ-новости
    if (country) {
      result = await getTopNews(country, {
        category: category,
        pageSize: maxItems
      });
    } else {
      // Иначе — поиск по запросу
      result = await searchNews(query, {
        category: category,
        pageSize: maxItems
      });
    }

    if (!result.success || !result.articles || result.articles.length === 0) {
      console.warn('[NewsAPI Basket] Новостей не найдено');
      return {
        success: true,
        collected: 0,
        items: [],
        message: 'Новостей не найдено'
      };
    }

    let addedCount = 0;
    const addedItems = [];

    // Добавляем каждую новость в корзину
    for (const article of result.articles) {
      try {
        const basketItem = {
          id: article.id || `newsapi-${Date.now()}-${Math.random()}`,
          title: article.title || 'Без заголовка',
          description: article.description || '',
          url: article.url || '#',
          source: article.source || 'NewsAPI',
          date: article.publishedAt || new Date().toISOString(),
          category: article.category || category || 'general',
          country: article.country || country || 'world',
          type: 'news',
          origin: 'NewsAPI',
          tags: ['NewsAPI', category || 'general'],
          imageUrl: article.imageUrl || null,
          rating: null,
          analyzed: false,
          collectedAt: new Date().toISOString()
        };

        if (addToBasket) {
          // Используем функцию добавления в корзину
          const addResult = await addToBasket(basketItem);
          if (addResult.success) {
            addedCount++;
            addedItems.push(basketItem);
          }
        } else {
          addedItems.push(basketItem);
          addedCount++;
        }
      } catch (e) {
        console.warn('[NewsAPI Basket] Ошибка добавления новости:', e.message);
      }
    }

    console.log(`[NewsAPI Basket] Добавлено ${addedCount} новостей в корзину`);

    return {
      success: true,
      collected: addedCount,
      items: addedItems,
      totalFound: result.total || result.articles.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[NewsAPI Basket] Ошибка:', error.message);
    return {
      success: false,
      error: error.message,
      collected: 0,
      items: []
    };
  }
}

// ============================================================
// 2. API-ОБРАБОТЧИК
// ============================================================

export async function handleNewsAPIBasket(req, res) {
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
    // POST /api/newsapi/basket — сбор новостей в корзину
    if (path === '/api/newsapi/basket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const data = JSON.parse(body || '{}');
          const result = await collectNewsToBasket({
            query: data.query || 'world',
            country: data.country || null,
            category: data.category || null,
            maxItems: data.maxItems || 20,
            addToBasket: data.addToBasket !== false
          });

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            success: false,
            error: e.message
          }));
        }
      });
      return;
    }

    // GET /api/newsapi/basket — сбор новостей в корзину (GET версия)
    if (path === '/api/newsapi/basket' && req.method === 'GET') {
      const params = url.searchParams;
      const query = params.get('q') || 'world';
      const country = params.get('country') || null;
      const category = params.get('category') || null;
      const maxItems = parseInt(params.get('max')) || 20;
      const action = params.get('action') || 'collect';

      if (action === 'collect') {
        const result = await collectNewsToBasket({
          query: query,
          country: country,
          category: category,
          maxItems: maxItems,
          addToBasket: true
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          error: 'Неизвестное действие. Используйте action=collect'
        }));
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[NewsAPI Basket] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

// ============================================================
// 3. ЭКСПОРТЫ
// ============================================================

export default {
  collectNewsToBasket,
  handleNewsAPIBasket
};
