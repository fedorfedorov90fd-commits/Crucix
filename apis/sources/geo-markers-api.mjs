#!/usr/bin/env node

// ============================================================
// GEO-MARKERS-API.MJS — Геополитические маркеры для карты
// ============================================================
// Поддерживает:
//   - Фильтрацию маркеров по слоям (?layer=conflict)
//   - Получение списка слоёв (/api/geo/layers)
//   - Источники: basket/static/auto
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');
const GEO_FILE = join(BASKET_DIR, 'geo-data.json');

// ============================================================
// 1. СТАТИЧЕСКИЕ ДАННЫЕ (ЗАПАСНОЙ ВАРИАНТ)
// ============================================================

const STATIC_COUNTRIES = {
  ukraine: { name: "Украина", status: "critical", lat: 48.4, lng: 31.2 },
  russia: { name: "Россия", status: "pre-war", lat: 61.5, lng: 105 },
  us: { name: "США", status: "medium", lat: 39.8, lng: -98.5 }
};

const STATIC_MARKERS = [
  { id: 1, name: "Конфликт в Украине", lat: 48.4, lng: 31.2, type: "conflict", status: "critical", layer: "conflict" }
];

const STATIC_LAYERS = {
  all: { name: "Все", icon: "🌍", color: "#44ccff", active: true },
  conflict: { name: "Конфликты", icon: "⚔️", color: "#ef4444", active: true }
};

// ============================================================
// 2. ЗАГРУЗКА ИЗ КОРЗИНЫ
// ============================================================

async function loadFromBasket() {
  try {
    const data = await fs.readFile(GEO_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    
    if (parsed.countries && parsed.markers) {
      return {
        source: 'basket',
        countries: parsed.countries,
        markers: parsed.markers,
        layers: parsed.layers || STATIC_LAYERS,
        timestamp: parsed.timestamp || new Date().toISOString(),
        total_countries: Object.keys(parsed.countries).length,
        total_markers: parsed.markers.length
      };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// ============================================================
// 3. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleGeoAPI(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  const source = url.searchParams.get('source') || 'auto';
  const layer = url.searchParams.get('layer') || 'all';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  try {
    let countries = null;
    let markers = null;
    let layers = null;
    let dataSource = 'static';
    let timestamp = new Date().toISOString();

    // Загружаем данные
    if (source === 'basket' || source === 'auto') {
      const basketData = await loadFromBasket();
      if (basketData) {
        countries = basketData.countries;
        markers = basketData.markers;
        layers = basketData.layers;
        dataSource = 'basket';
        timestamp = basketData.timestamp;
      }
    }

    // Если нет данных — статика
    if (!countries) {
      countries = STATIC_COUNTRIES;
      markers = STATIC_MARKERS;
      layers = STATIC_LAYERS;
      dataSource = 'static';
    }

    // Фильтруем маркеры по слою
    let filteredMarkers = markers;
    if (layer !== 'all') {
      filteredMarkers = markers.filter(m => m.layer === layer);
    }

    // GET /api/geo/status — статусы стран
    if (path === '/api/geo/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: dataSource,
        status: { countries: countries },
        total: Object.keys(countries).length,
        timestamp: timestamp
      }));
      return;
    }

    // GET /api/geo/markers — маркеры событий (с фильтром по слою)
    if (path === '/api/geo/markers' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: dataSource,
        layer: layer,
        markers: filteredMarkers,
        total: filteredMarkers.length,
        timestamp: timestamp
      }));
      return;
    }

    // GET /api/geo/layers — список слоёв
    if (path === '/api/geo/layers' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: dataSource,
        layers: layers,
        total: Object.keys(layers).length,
        timestamp: timestamp
      }));
      return;
    }

    // GET /api/geo/all — все данные
    if (path === '/api/geo/all' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: dataSource,
        countries: countries,
        markers: filteredMarkers,
        layers: layers,
        total_countries: Object.keys(countries).length,
        total_markers: filteredMarkers.length,
        total_layers: Object.keys(layers).length,
        timestamp: timestamp
      }));
      return;
    }

    // GET /api/geo/source — источник
    if (path === '/api/geo/source' && req.method === 'GET') {
      const basketData = await loadFromBasket();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        source: basketData ? 'basket' : 'static',
        basket_exists: !!basketData,
        timestamp: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Geo API] Ошибка:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Внутренняя ошибка' }));
    }
  }
}

export default { handleGeoAPI };
