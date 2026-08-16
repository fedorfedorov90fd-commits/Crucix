#!/usr/bin/env node

// ============================================================
// BASKET-API.MJS — Единая корзина данных с AI-обработкой
// ============================================================
// Хранит данные из разных источников в едином формате
// Автоматическая AI-обработка при добавлении
// Поддерживает 3 режима: LOCAL / API / BASIC
// Версия: 3.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

// Импорт AI-процессора
import { getProcessor, processBasketItems } from './ai-processor.mjs';

// ============================================================
// 1. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

async function ensureBasketDir() {
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
  } catch (e) {
    // Папка уже существует
  }
}

function getBasketFile() {
  const today = new Date().toISOString().slice(0, 10);
  return join(BASKET_DIR, `basket-${today}.json`);
}

function getStatsFile() {
  return join(BASKET_DIR, 'stats.json');
}

function getAIStatsFile() {
  return join(BASKET_DIR, 'ai-stats.json');
}

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ — ДОБАВЛЕНИЕ В КОРЗИНУ С AI-ОБРАБОТКОЙ
// ============================================================

export async function addToBasket(item, options = {}) {
  const { skipAI = false } = options;

  try {
    await ensureBasketDir();
    const file = getBasketFile();

    // Загружаем существующие данные
    let basket = [];
    try {
      const data = await fs.readFile(file, 'utf-8');
      basket = JSON.parse(data);
    } catch (e) {
      // Файла нет — создаём новый
    }

    // Проверяем, есть ли уже такой ID
    const exists = basket.some(existing => existing.id === item.id);
    if (exists) {
      return {
        success: false,
        error: 'Элемент с таким ID уже существует',
        item: item
      };
    }

    // Добавляем время добавления
    item.addedAt = item.addedAt || new Date().toISOString();

    // ============================================================
    // 2.1. AI-ОБРАБОТКА (если не отключена)
    // ============================================================
    if (!skipAI) {
      try {
        const processor = await getProcessor();
        const aiResult = await processor.processItem(item);

        // Добавляем AI-результаты в элемент
        item.ai = {
          sentiment: aiResult.sentiment || 0,
          importance: aiResult.importance || 5,
          urgency: aiResult.urgency || 5,
          credibility: aiResult.credibility || 5,
          categories: aiResult.categories || [],
          regions: aiResult.regions || [],
          tags: aiResult.tags || [],
          summary: aiResult.summary || '',
          processedBy: aiResult.processedBy || 'basic',
          processedAt: aiResult.processedAt || new Date().toISOString(),
          processedModel: aiResult.processedModel || 'basic'
        };

        // Добавляем статус обработки
        item.aiStatus = aiResult.processedBy || 'basic';

        console.log(`[Basket] AI-обработка: ${item.id} (режим: ${aiResult.processedBy})`);

      } catch (aiError) {
        console.error(`[Basket] Ошибка AI-обработки для ${item.id}:`, aiError.message);
        // Добавляем базовые значения при ошибке
        item.ai = {
          sentiment: 0,
          importance: 5,
          urgency: 5,
          credibility: 5,
          categories: [],
          regions: [],
          tags: [],
          summary: item.title || '',
          processedBy: 'error',
          processedAt: new Date().toISOString(),
          processedModel: 'none'
        };
        item.aiStatus = 'error';
      }
    } else {
      // Если AI отключён — добавляем пустые значения
      item.ai = {
        sentiment: 0,
        importance: 5,
        urgency: 5,
        credibility: 5,
        categories: [],
        regions: [],
        tags: [],
        summary: item.title || '',
        processedBy: 'disabled',
        processedAt: new Date().toISOString(),
        processedModel: 'none'
      };
      item.aiStatus = 'disabled';
    }

    // Добавляем в корзину
    basket.push(item);

    // Сохраняем
    await fs.writeFile(file, JSON.stringify(basket, null, 2));

    // Обновляем статистику
    await updateStats('add');
    await updateAIStats(item.ai);

    console.log(`[Basket] Добавлен элемент: ${item.id} (${item.title?.slice(0, 50)}...) [AI: ${item.aiStatus}]`);

    return {
      success: true,
      item: item,
      total: basket.length,
      aiStatus: item.aiStatus
    };

  } catch (error) {
    console.error('[Basket] Ошибка добавления:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// 3. ПОЛУЧЕНИЕ ВСЕХ ЭЛЕМЕНТОВ ИЗ КОРЗИНЫ
// ============================================================

export async function getBasketItems(options = {}) {
  const {
    limit = 100,
    offset = 0,
    source = null,
    category = null,
    fromDate = null,
    toDate = null,
    minImportance = null,
    minSentiment = null,
    aiStatus = null,
    sortBy = 'date', // 'date' | 'importance' | 'sentiment'
    sortOrder = 'desc' // 'desc' | 'asc'
  } = options;

  try {
    await ensureBasketDir();
    const file = getBasketFile();

    let basket = [];
    try {
      const data = await fs.readFile(file, 'utf-8');
      basket = JSON.parse(data);
    } catch (e) {
      // Файла нет — возвращаем пустой массив
      return {
        success: true,
        items: [],
        total: 0,
        timestamp: new Date().toISOString()
      };
    }

    // Фильтры
    let items = basket;

    if (source) {
      items = items.filter(item =>
        item.source === source ||
        item.origin === source ||
        item.source?.toLowerCase().includes(source.toLowerCase())
      );
    }

    if (category) {
      items = items.filter(item =>
        item.category === category ||
        item.ai?.categories?.includes(category)
      );
    }

    if (fromDate) {
      items = items.filter(item =>
        new Date(item.date || item.addedAt) >= new Date(fromDate)
      );
    }

    if (toDate) {
      items = items.filter(item =>
        new Date(item.date || item.addedAt) <= new Date(toDate)
      );
    }

    if (minImportance !== null) {
      items = items.filter(item => (item.ai?.importance || 0) >= minImportance);
    }

    if (minSentiment !== null) {
      items = items.filter(item => (item.ai?.sentiment || 0) >= minSentiment);
    }

    if (aiStatus) {
      items = items.filter(item => item.aiStatus === aiStatus);
    }

    // Сортировка
    if (sortBy === 'date') {
      items.sort((a, b) => {
        const dateA = new Date(a.date || a.addedAt);
        const dateB = new Date(b.date || b.addedAt);
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      });
    } else if (sortBy === 'importance') {
      items.sort((a, b) => {
        const valA = a.ai?.importance || 0;
        const valB = b.ai?.importance || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    } else if (sortBy === 'sentiment') {
      items.sort((a, b) => {
        const valA = a.ai?.sentiment || 0;
        const valB = b.ai?.sentiment || 0;
        return sortOrder === 'desc' ? valB - valA : valA - valB;
      });
    }

    const total = items.length;
    const paginated = items.slice(offset, offset + limit);

    return {
      success: true,
      items: paginated,
      total: total,
      offset: offset,
      limit: limit,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Basket] Ошибка получения:', error.message);
    return {
      success: false,
      error: error.message,
      items: [],
      total: 0
    };
  }
}

// ============================================================
// 4. УДАЛЕНИЕ ЭЛЕМЕНТА ИЗ КОРЗИНЫ
// ============================================================

export async function removeFromBasket(id) {
  try {
    await ensureBasketDir();
    const file = getBasketFile();

    let basket = [];
    try {
      const data = await fs.readFile(file, 'utf-8');
      basket = JSON.parse(data);
    } catch (e) {
      return {
        success: false,
        error: 'Корзина пуста или не найдена'
      };
    }

    const index = basket.findIndex(item => item.id === id);
    if (index === -1) {
      return {
        success: false,
        error: 'Элемент не найден'
      };
    }

    const removed = basket.splice(index, 1)[0];
    await fs.writeFile(file, JSON.stringify(basket, null, 2));

    await updateStats('remove');

    console.log(`[Basket] Удалён элемент: ${id}`);

    return {
      success: true,
      removed: removed,
      total: basket.length
    };

  } catch (error) {
    console.error('[Basket] Ошибка удаления:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// 5. ОЧИСТКА КОРЗИНЫ
// ============================================================

export async function clearBasket() {
  try {
    await ensureBasketDir();
    const file = getBasketFile();

    await fs.writeFile(file, '[]');
    await updateStats('clear');

    console.log('[Basket] Корзина очищена');

    return {
      success: true,
      message: 'Корзина очищена'
    };

  } catch (error) {
    console.error('[Basket] Ошибка очистки:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// 6. СТАТИСТИКА
// ============================================================

async function updateStats(action) {
  try {
    await ensureBasketDir();
    const file = getStatsFile();

    let stats = {};
    try {
      const data = await fs.readFile(file, 'utf-8');
      stats = JSON.parse(data);
    } catch (e) {
      // Файла нет — создаём
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!stats.daily) stats.daily = {};
    if (!stats.daily[today]) stats.daily[today] = { added: 0, removed: 0 };

    if (action === 'add') {
      stats.daily[today].added++;
      stats.totalAdded = (stats.totalAdded || 0) + 1;
    } else if (action === 'remove') {
      stats.daily[today].removed++;
      stats.totalRemoved = (stats.totalRemoved || 0) + 1;
    } else if (action === 'clear') {
      stats.clearedAt = new Date().toISOString();
    }

    stats.lastUpdated = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('[Basket] Ошибка обновления статистики:', error.message);
  }
}

async function updateAIStats(aiResult) {
  try {
    await ensureBasketDir();
    const file = getAIStatsFile();

    let stats = {};
    try {
      const data = await fs.readFile(file, 'utf-8');
      stats = JSON.parse(data);
    } catch (e) {
      // Файла нет — создаём
    }

    const today = new Date().toISOString().slice(0, 10);
    if (!stats.daily) stats.daily = {};
    if (!stats.daily[today]) stats.daily[today] = {
      local: 0,
      api: 0,
      basic: 0,
      error: 0,
      total: 0,
      avgImportance: 0,
      avgSentiment: 0
    };

    const mode = aiResult.processedBy || 'basic';
    stats.daily[today][mode] = (stats.daily[today][mode] || 0) + 1;
    stats.daily[today].total++;

    // Средние значения
    const total = stats.daily[today].total;
    const oldAvgImp = stats.daily[today].avgImportance || 0;
    const oldAvgSent = stats.daily[today].avgSentiment || 0;

    stats.daily[today].avgImportance =
      (oldAvgImp * (total - 1) + (aiResult.importance || 5)) / total;

    stats.daily[today].avgSentiment =
      (oldAvgSent * (total - 1) + (aiResult.sentiment || 0)) / total;

    stats.lastUpdated = new Date().toISOString();
    await fs.writeFile(file, JSON.stringify(stats, null, 2));

  } catch (error) {
    console.error('[Basket] Ошибка обновления AI-статистики:', error.message);
  }
}

export async function getBasketStats() {
  try {
    await ensureBasketDir();
    const file = getStatsFile();
    const aiFile = getAIStatsFile();

    let stats = {};
    try {
      const data = await fs.readFile(file, 'utf-8');
      stats = JSON.parse(data);
    } catch (e) {
      // Файла нет
    }

    let aiStats = {};
    try {
      const data = await fs.readFile(aiFile, 'utf-8');
      aiStats = JSON.parse(data);
    } catch (e) {
      // Файла нет
    }

    // Получаем текущий размер корзины
    const basketFile = getBasketFile();
    let total = 0;
    let aiDistribution = { local: 0, api: 0, basic: 0, error: 0, disabled: 0 };
    let avgImportance = 0;
    let avgSentiment = 0;
    let itemsWithAI = 0;

    try {
      const data = await fs.readFile(basketFile, 'utf-8');
      const basket = JSON.parse(data);
      total = basket.length;

      // Статистика по AI
      for (const item of basket) {
        const status = item.aiStatus || 'disabled';
        aiDistribution[status] = (aiDistribution[status] || 0) + 1;
        if (item.ai && status !== 'disabled') {
          avgImportance += item.ai.importance || 0;
          avgSentiment += item.ai.sentiment || 0;
          itemsWithAI++;
        }
      }
      if (itemsWithAI > 0) {
        avgImportance /= itemsWithAI;
        avgSentiment /= itemsWithAI;
      }
    } catch (e) {
      // Файла нет
    }

    return {
      success: true,
      stats: {
        totalItems: total,
        totalAdded: stats.totalAdded || 0,
        totalRemoved: stats.totalRemoved || 0,
        daily: stats.daily || {},
        lastUpdated: stats.lastUpdated || new Date().toISOString(),
        ai: {
          distribution: aiDistribution,
          avgImportance: Math.round(avgImportance * 10) / 10,
          avgSentiment: Math.round(avgSentiment * 100) / 100,
          itemsWithAI: itemsWithAI,
          daily: aiStats.daily || {}
        }
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Basket] Ошибка получения статистики:', error.message);
    return {
      success: false,
      error: error.message,
      stats: {}
    };
  }
}

// ============================================================
// 7. МАССОВАЯ AI-ОБРАБОТКА
// ============================================================

export async function processAllItems() {
  try {
    await ensureBasketDir();
    const file = getBasketFile();

    let basket = [];
    try {
      const data = await fs.readFile(file, 'utf-8');
      basket = JSON.parse(data);
    } catch (e) {
      return {
        success: false,
        error: 'Корзина пуста или не найдена'
      };
    }

    const processor = await getProcessor();
    let processed = 0;
    let errors = 0;

    for (const item of basket) {
      try {
        const aiResult = await processor.processItem(item);
        item.ai = {
          sentiment: aiResult.sentiment || 0,
          importance: aiResult.importance || 5,
          urgency: aiResult.urgency || 5,
          credibility: aiResult.credibility || 5,
          categories: aiResult.categories || [],
          regions: aiResult.regions || [],
          tags: aiResult.tags || [],
          summary: aiResult.summary || '',
          processedBy: aiResult.processedBy || 'basic',
          processedAt: aiResult.processedAt || new Date().toISOString(),
          processedModel: aiResult.processedModel || 'basic'
        };
        item.aiStatus = aiResult.processedBy || 'basic';
        processed++;
      } catch (e) {
        errors++;
        console.error(`[Basket] Ошибка обработки ${item.id}:`, e.message);
      }
    }

    // Сохраняем обновлённую корзину
    await fs.writeFile(file, JSON.stringify(basket, null, 2));

    return {
      success: true,
      total: basket.length,
      processed,
      errors,
      mode: processor.mode,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('[Basket] Ошибка массовой обработки:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// ============================================================
// 8. API-ОБРАБОТЧИК
// ============================================================

export async function handleBasketAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    // ============================================================
    // GET /api/basket — получить все элементы
    // ============================================================
    if (path === '/api/basket' && req.method === 'GET') {
      const params = url.searchParams;
      const limit = parseInt(params.get('limit')) || 100;
      const offset = parseInt(params.get('offset')) || 0;
      const source = params.get('source') || null;
      const category = params.get('category') || null;
      const fromDate = params.get('from') || null;
      const toDate = params.get('to') || null;
      const minImportance = params.get('minImportance') !== null ? parseFloat(params.get('minImportance')) : null;
      const minSentiment = params.get('minSentiment') !== null ? parseFloat(params.get('minSentiment')) : null;
      const aiStatus = params.get('aiStatus') || null;
      const sortBy = params.get('sortBy') || 'date';
      const sortOrder = params.get('sortOrder') || 'desc';

      const data = await getBasketItems({
        limit, offset, source, category, fromDate, toDate,
        minImportance, minSentiment, aiStatus, sortBy, sortOrder
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // ============================================================
    // POST /api/basket — добавить элемент
    // ============================================================
    if (path === '/api/basket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const item = JSON.parse(body);
          const skipAI = item.skipAI === true || false;
          delete item.skipAI;

          const result = await addToBasket(item, { skipAI });
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

    // ============================================================
    // POST /api/basket/process — массовая AI-обработка
    // ============================================================
    if (path === '/api/basket/process' && req.method === 'POST') {
      const result = await processAllItems();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // ============================================================
    // DELETE /api/basket/:id — удалить элемент
    // ============================================================
    if (path.startsWith('/api/basket/') && req.method === 'DELETE' && path !== '/api/basket') {
      const id = path.split('/').pop();
      const result = await removeFromBasket(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // ============================================================
    // DELETE /api/basket — очистить корзину
    // ============================================================
    if (path === '/api/basket' && req.method === 'DELETE') {
      const result = await clearBasket();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // ============================================================
    // GET /api/basket/stats — статистика
    // ============================================================
    if (path === '/api/basket/stats' && req.method === 'GET') {
      const result = await getBasketStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Basket API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Внутренняя ошибка сервера',
      details: error.message
    }));
  }
}

// ============================================================
// 9. ЭКСПОРТЫ
// ============================================================

export default {
  addToBasket,
  getBasketItems,
  removeFromBasket,
  clearBasket,
  getBasketStats,
  processAllItems,
  handleBasketAPI
};
