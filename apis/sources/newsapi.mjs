#!/usr/bin/env node

// ============================================================
// NEWSAPI — Альтернативный источник новостей
// ============================================================
// Источник: NewsAPI.org
// Данные: глобальные новости по ключевым словам
// Версия: 2.0
// ============================================================

import { fetchWithRetry } from '../utils/fetch.mjs';

// ============================================================
// 1. КОНСТАНТЫ
// ============================================================

// API-ключ (можно получить бесплатно на newsapi.org)
const NEWSAPI_KEY = process.env.NEWSAPI_KEY || '2965aeec21674948b0217e163df31d10';
const NEWSAPI_BASE = 'https://newsapi.org/v2';

// Категории
const CATEGORIES = {
  BUSINESS: 'business',
  ENTERTAINMENT: 'entertainment',
  GENERAL: 'general',
  HEALTH: 'health',
  SCIENCE: 'science',
  SPORTS: 'sports',
  TECHNOLOGY: 'technology'
};

// Страны
const COUNTRIES = {
  US: 'us',
  GB: 'gb',
  RU: 'ru',
  DE: 'de',
  FR: 'fr',
  IN: 'in',
  CN: 'cn',
  JP: 'jp',
  BR: 'br',
  AU: 'au',
  CA: 'ca',
  IT: 'it',
  ES: 'es',
  NL: 'nl',
  PL: 'pl',
  UA: 'ua',
  IL: 'il',
  IR: 'ir',
  SA: 'sa',
  AE: 'ae',
  EG: 'eg',
  NG: 'ng',
  ZA: 'za',
  AR: 'ar',
  CL: 'cl',
  CO: 'co',
  PE: 'pe',
  VE: 've',
  MX: 'mx',
  KR: 'kr',
  TW: 'tw',
  SG: 'sg',
  MY: 'my',
  PH: 'ph',
  PK: 'pk'
};

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ — ПОИСК НОВОСТЕЙ
// ============================================================

export async function searchNews(query, options = {}) {
  const {
    category = null,
    country = null,
    pageSize = 20,
    page = 1,
    from = null,
    to = null,
    language = 'en'
  } = options;

  try {
    const params = new URLSearchParams({
      q: query,
      pageSize: Math.min(pageSize, 100),
      page: page,
      language: language,
      apiKey: NEWSAPI_KEY
    });

    if (category) params.append('category', category);
    if (country) params.append('country', country);
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const url = `${NEWSAPI_BASE}/everything?${params}`;
    console.log(`[NewsAPI] Поиск: "${query}"`);

    const response = await fetchWithRetry(url, { timeout: 15000 });
    const data = await response.json();

    if (data.status === 'error') {
      console.warn('[NewsAPI] Ошибка:', data.message);
      return getDemoNews(query);
    }

    console.log(`[NewsAPI] Найдено ${data.totalResults} новостей`);

    return {
      success: true,
      total: data.totalResults,
      articles: data.articles.map((article, index) => ({
        id: `newsapi-${Date.now()}-${index}`,
        title: article.title || 'Без заголовка',
        description: article.description || '',
        content: article.content || '',
        url: article.url || '#',
        source: article.source?.name || 'Unknown',
        author: article.author || '',
        publishedAt: article.publishedAt || new Date().toISOString(),
        category: category || 'general',
        country: country || 'world',
        imageUrl: article.urlToImage || null,
        origin: 'NewsAPI'
      })),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[NewsAPI] Ошибка:', error.message);
    console.warn('[NewsAPI] Использую демо-данные');
    return getDemoNews(query);
  }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ТОП-НОВОСТЕЙ ПО СТРАНЕ
// ============================================================

export async function getTopNews(country = 'us', options = {}) {
  const {
    category = null,
    pageSize = 20,
    page = 1
  } = options;

  try {
    const params = new URLSearchParams({
      country: country,
      pageSize: Math.min(pageSize, 100),
      page: page,
      apiKey: NEWSAPI_KEY
    });

    if (category) params.append('category', category);

    const url = `${NEWSAPI_BASE}/top-headlines?${params}`;
    console.log(`[NewsAPI] Топ-новости для ${country}`);

    const response = await fetchWithRetry(url, { timeout: 15000 });
    const data = await response.json();

    if (data.status === 'error') {
      console.warn('[NewsAPI] Ошибка:', data.message);
      return getDemoTopNews(country);
    }

    console.log(`[NewsAPI] Найдено ${data.totalResults} топ-новостей`);

    return {
      success: true,
      total: data.totalResults,
      articles: data.articles.map((article, index) => ({
        id: `newsapi-top-${Date.now()}-${index}`,
        title: article.title || 'Без заголовка',
        description: article.description || '',
        content: article.content || '',
        url: article.url || '#',
        source: article.source?.name || 'Unknown',
        author: article.author || '',
        publishedAt: article.publishedAt || new Date().toISOString(),
        category: category || 'general',
        country: country,
        imageUrl: article.urlToImage || null,
        origin: 'NewsAPI (Top)'
      })),
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[NewsAPI] Ошибка:', error.message);
    console.warn('[NewsAPI] Использую демо-данные');
    return getDemoTopNews(country);
  }
}

// ============================================================
// 4. ДЕМО-ДАННЫЕ
// ============================================================

function getDemoNews(query) {
  const demoTimestamp = new Date().toISOString();
  const articles = [];

  const demoSources = ['Reuters', 'AP', 'BBC', 'CNN', 'Al Jazeera', 'France 24', 'TASS', 'РИА Новости'];
  const demoTitles = [
    `Встреча лидеров G20: итоги саммита — ${query}`,
    `Цены на нефть выросли на фоне геополитической напряжённости — ${query}`,
    `Новый закон о кибербезопасности вступает в силу в ЕС — ${query}`,
    `Космический аппарат совершил посадку на Луне — ${query}`,
    `В Африке объявлена программа по борьбе с изменением климата — ${query}`,
    `Технологический гигант представил новый процессор — ${query}`,
    `Саммит по продовольственной безопасности проходит в Риме — ${query}`,
    `Военно-морские учения в Тихом океане — ${query}`,
    `Новые данные по экономике США опубликованы — ${query}`,
    `Прорыв в квантовых вычислениях — ${query}`,
    `План стабилизации в Ближневосточном регионе — ${query}`,
    `Цифровая валюта для международных расчётов — ${query}`,
    `Новый пакет санкций обсуждают в Европе — ${query}`,
    `Спутниковый мониторинг океана запущен — ${query}`,
    `Новый логистический хаб открыт в Азии — ${query}`,
    `Энергетический кризис в Европе усугубляется — ${query}`,
    `Бюджет на следующий год утверждён — ${query}`,
    `Прогноз по глобальной экономике от аналитического центра — ${query}`,
    `Президентские выборы в Латинской Америке — ${query}`,
    `Космическая программа Китая достигла нового этапа — ${query}`
  ];

  for (let i = 0; i < 20; i++) {
    const source = demoSources[i % demoSources.length];
    articles.push({
      id: `demo-${i}`,
      title: demoTitles[i % demoTitles.length],
      description: `Демонстрационная новость по запросу "${query}". Источник: ${source}`,
      content: `Полный текст новости для демонстрации. Поисковый запрос: ${query}`,
      url: '#',
      source: source,
      author: 'Demo Author',
      publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
      category: 'general',
      country: 'world',
      imageUrl: null,
      origin: 'NewsAPI (DEMO)'
    });
  }

  return {
    success: true,
    total: articles.length,
    articles: articles,
    timestamp: demoTimestamp,
    isDemo: true
  };
}

function getDemoTopNews(country) {
  const demoTimestamp = new Date().toISOString();
  const articles = [];

  const demoSources = ['Reuters', 'AP', 'BBC', 'CNN', 'Al Jazeera', 'France 24'];
  const demoTitles = [
    'Топ-новость дня: глобальный саммит по климату',
    'Экономические показатели превысили ожидания',
    'Новый технологический прорыв в области ИИ',
    'Международные переговоры по торговле',
    'Крупный спортивный турнир завершился',
    'Новое исследование в области медицины'
  ];

  for (let i = 0; i < 10; i++) {
    const source = demoSources[i % demoSources.length];
    articles.push({
      id: `demo-top-${i}`,
      title: demoTitles[i % demoTitles.length] + ` (${country.toUpperCase()})`,
      description: `Топ-новость для страны ${country}. Источник: ${source}`,
      content: `Полный текст топ-новости для демонстрации. Страна: ${country}`,
      url: '#',
      source: source,
      author: 'Demo Author',
      publishedAt: new Date(Date.now() - i * 3600000).toISOString(),
      category: 'general',
      country: country,
      imageUrl: null,
      origin: 'NewsAPI (DEMO)'
    });
  }

  return {
    success: true,
    total: articles.length,
    articles: articles,
    timestamp: demoTimestamp,
    isDemo: true
  };
}

// ============================================================
// 5. API-ОБРАБОТЧИК
// ============================================================

export async function handleNewsAPI(req, res) {
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
    // GET /api/newsapi/search?q=... — поиск новостей
    if (path === '/api/newsapi/search' && req.method === 'GET') {
      const params = url.searchParams;
      const query = params.get('q') || 'world';
      const category = params.get('category') || null;
      const country = params.get('country') || null;
      const pageSize = parseInt(params.get('pageSize')) || 20;
      const page = parseInt(params.get('page')) || 1;

      const data = await searchNews(query, { category, country, pageSize, page });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/newsapi/top?country=... — топ-новости по стране
    if (path === '/api/newsapi/top' && req.method === 'GET') {
      const params = url.searchParams;
      const country = params.get('country') || 'us';
      const category = params.get('category') || null;
      const pageSize = parseInt(params.get('pageSize')) || 20;

      const data = await getTopNews(country, { category, pageSize });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // GET /api/newsapi/ping — проверка работоспособности
    if (path === '/api/newsapi/ping' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'NewsAPI',
        status: 'active',
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[NewsAPI] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

// ============================================================
// 6. ЭКСПОРТЫ
// ============================================================

export default {
  searchNews,
  getTopNews,
  handleNewsAPI
};
