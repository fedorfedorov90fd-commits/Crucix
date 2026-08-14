#!/usr/bin/env node

// ============================================================
// BASKET-API — Единая корзина данных
// ============================================================
// Хранит данные из разных источников в едином формате
// Версия: 2.0
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

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

// ============================================================
// 2. ОСНОВНАЯ ФУНКЦИЯ — ДОБАВЛЕНИЕ В КОРЗИНУ
// ============================================================

export async function addToBasket(item) {
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

    // Добавляем в корзину
    basket.push(item);

    // Сохраняем
    await fs.writeFile(file, JSON.stringify(basket, null, 2));

    // Обновляем статистику
    await updateStats('add');

    console.log(`[Basket] Добавлен элемент: ${item.id} (${item.title?.slice(0, 50)}...)`);

    return {
      success: true,
      item: item,
      total: basket.length
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
    toDate = null
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
      items = items.filter(item => item.source === source || item.origin === source);
    }

    if (category) {
      items = items.filter(item => item.category === category);
    }

    if (fromDate) {
      items = items.filter(item => new Date(item.date || item.addedAt) >= new Date(fromDate));
    }

    if (toDate) {
      items = items.filter(item => new Date(item.date || item.addedAt) <= new Date(toDate));
    }

    // Сортировка по дате (новые сверху)
    items.sort((a, b) => new Date(b.date || b.addedAt) - new Date(a.date || a.addedAt));

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

export async function getBasketStats() {
  try {
    await ensureBasketDir();
    const file = getStatsFile();

    let stats = {};
    try {
      const data = await fs.readFile(file, 'utf-8');
      stats = JSON.parse(data);
    } catch (e) {
      // Файла нет
    }

    // Получаем текущий размер корзины
    const basketFile = getBasketFile();
    let total = 0;
    try {
      const data = await fs.readFile(basketFile, 'utf-8');
      const basket = JSON.parse(data);
      total = basket.length;
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
        lastUpdated: stats.lastUpdated || new Date().toISOString()
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
// 7. API-ОБРАБОТЧИК
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
    // GET /api/basket — получить все элементы
    if (path === '/api/basket' && req.method === 'GET') {
      const params = url.searchParams;
      const limit = parseInt(params.get('limit')) || 100;
      const offset = parseInt(params.get('offset')) || 0;
      const source = params.get('source') || null;
      const category = params.get('category') || null;
      const fromDate = params.get('from') || null;
      const toDate = params.get('to') || null;

      const data = await getBasketItems({
        limit, offset, source, category, fromDate, toDate
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    // POST /api/basket — добавить элемент
    if (path === '/api/basket' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const item = JSON.parse(body);
          const result = await addToBasket(item);
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

    // DELETE /api/basket/:id — удалить элемент
    if (path.startsWith('/api/basket/') && req.method === 'DELETE') {
      const id = path.split('/').pop();
      const result = await removeFromBasket(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // DELETE /api/basket — очистить корзину
    if (path === '/api/basket' && req.method === 'DELETE') {
      const result = await clearBasket();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // GET /api/basket/stats — статистика
    if (path === '/api/basket/stats' && req.method === 'GET') {
      const result = await getBasketStats();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

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
// 8. ЭКСПОРТЫ
// ============================================================

export default {
  addToBasket,
  getBasketItems,
  removeFromBasket,
  clearBasket,
  getBasketStats,
  handleBasketAPI
};
