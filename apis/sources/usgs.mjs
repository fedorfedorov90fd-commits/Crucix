#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'usgs.json');

export async function handleUSGSApi(req, res) {
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
    const data = await fs.readFile(BASKET_FILE, 'utf-8');
    const basket = JSON.parse(data);

    if (path === '/api/usgs/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        module: 'usgs',
        status: 'online',
        earthquakes: basket.data.earthquakes?.length || 0,
        source: basket.source || 'demo',
        timestamp: basket.date || new Date().toISOString()
      }));
      return;
    }

    if (path === '/api/usgs/data' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, data: basket.data }));
      return;
    }

  } catch (e) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      error: 'Нет данных. Запустите: node scripts/collect-usgs.mjs'
    }));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));
}

export default { handleUSGSApi };

// ============================================================
// ДОПОЛНИТЕЛЬНЫЕ ЭКСПОРТЫ ДЛЯ LOCAL.MJS
// ============================================================

export async function fetchQuakes() {
  try {
    const data = await fs.readFile(BASKET_FILE, 'utf-8');
    const basket = JSON.parse(data);
    return basket.data?.earthquakes || [];
  } catch (e) {
    return [];
  }
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}
