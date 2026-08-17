#!/usr/bin/env node

// ============================================================
// АВТОНОМНАЯ ДИАГНОСТИКА — НЕ ЗАВИСИТ ОТ ИМПОРТОВ
// ============================================================
// Сканирует файлы напрямую, не требует импорта модулей

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SOURCES_DIR = join(ROOT, 'apis', 'sources');

// ============================================================
// 1. СКАНИРОВАНИЕ ФАЙЛОВ (НЕ ТРЕБУЕТ ИМПОРТА)
// ============================================================

export async function scanModules() {
  const modules = [];

  try {
    const files = await fs.readdir(SOURCES_DIR);

    for (const file of files) {
      if (!file.endsWith('.mjs') || file === 'monitor-api.mjs') continue;

      const filePath = join(SOURCES_DIR, file);
      const content = await fs.readFile(filePath, 'utf-8');

      // Проверяем, есть ли экспорт функции
      const hasExport = /export\s+(async\s+)?function/.test(content);
      const hasHandler = /export\s+(async\s+)?function\s+handle/.test(content);

      // Проверяем, зарегистрирован ли модуль в server.mjs
      const serverContent = await fs.readFile(join(ROOT, 'server.mjs'), 'utf-8');
      const isImported = serverContent.includes(`'./apis/sources/${file}'`);
      const hasRoute = serverContent.includes(`/api/${file.replace('.mjs', '')}/`);

      const name = file.replace('.mjs', '');

      modules.push({
        name: name,
        file: file,
        path: `apis/sources/${file}`,
        hasExport: hasExport,
        hasHandler: hasHandler,
        isImported: isImported,
        hasRoute: hasRoute,
        status: 'UNKNOWN'
      });
    }
  } catch (e) {
    console.error('[Monitor] Ошибка сканирования:', e);
  }

  return modules;
}

// ============================================================
// 2. ПРОВЕРКА ДОСТУПНОСТИ (ЧЕРЕЗ HTTP, ЕСЛИ СЕРВЕР РАБОТАЕТ)
// ============================================================

export async function checkModules() {
  const modules = await scanModules();
  const baseUrl = 'http://localhost:3117';

  for (const m of modules) {
    if (!m.hasHandler || !m.isImported) {
      m.status = 'UNREGISTERED';
      m.responseTime = '—';
      continue;
    }

    const endpoint = `/api/${m.name}/status`;
    const start = Date.now();

    try {
      const response = await fetch(`${baseUrl}${endpoint}`, {
        signal: AbortSignal.timeout(3000)
      });
      const time = Date.now() - start;

      m.status = response.ok ? 'ONLINE' : 'ERROR';
      m.responseTime = time + 'ms';
      m.statusCode = response.status;
    } catch (e) {
      m.status = 'OFFLINE';
      m.responseTime = '—';
      m.error = e.message;
    }
  }

  return modules;
}

// ============================================================
// 3. ИНВЕНТАРИЗАЦИЯ (ПОЛНЫЙ ОТЧЁТ)
// ============================================================

export async function getInventory() {
  const modules = await scanModules();

  for (const m of modules) {
    if (m.hasHandler && m.isImported && m.hasRoute) {
      m.status = 'REGISTERED';
    } else if (m.hasHandler && m.isImported && !m.hasRoute) {
      m.status = 'NO_ROUTE';
    } else if (m.hasHandler && !m.isImported) {
      m.status = 'NOT_IMPORTED';
    } else {
      m.status = 'NO_EXPORT';
    }
  }

  return modules;
}

// ============================================================
// 4. ЭКСПОРТ КОНТЕКСТА ДЛЯ ИИ
// ============================================================

export async function generateContext() {
  const lines = [];
  const timestamp = new Date().toISOString();

  lines.push('=== CRUCIX — ПОЛНЫЙ КОНТЕКСТ ПРОЕКТА ===');
  lines.push(`Дата экспорта: ${timestamp}`);
  lines.push('');

  // 1. Инвентаризация
  lines.push('=== 1. ИНВЕНТАРИЗАЦИЯ ПРОЕКТА ===');
  const inventory = await getInventory();

  let registered = 0, notImported = 0, noRoute = 0, noExport = 0;

  for (const m of inventory) {
    if (m.status === 'REGISTERED') registered++;
    else if (m.status === 'NOT_IMPORTED') notImported++;
    else if (m.status === 'NO_ROUTE') noRoute++;
    else if (m.status === 'NO_EXPORT') noExport++;
  }

  lines.push(`Всего модулей: ${inventory.length}`);
  lines.push(`✅ Зарегистрированы: ${registered}`);
  lines.push(`🟡 Есть в папке, но НЕ зарегистрированы: ${notImported}`);
  lines.push(`🟡 Есть импорт, но нет маршрута: ${noRoute}`);
  lines.push(`🔴 Нет экспорта функции: ${noExport}`);
  lines.push('');

  // 2. Детальный список
  lines.push('=== 2. ДЕТАЛЬНЫЙ СПИСОК МОДУЛЕЙ ===');
  for (const m of inventory) {
    const icon = m.status === 'REGISTERED' ? '✅' :
                 m.status === 'NOT_IMPORTED' ? '🟡' :
                 m.status === 'NO_ROUTE' ? '🟡' :
                 m.status === 'NO_EXPORT' ? '🔴' : '⚪';
    lines.push(`${icon} ${m.file} → ${m.status}`);
  }

  // 3. Системная информация
  lines.push('');
  lines.push('=== 3. СИСТЕМНАЯ ИНФОРМАЦИЯ ===');
  lines.push(`Версия Node.js: ${process.version}`);
  lines.push(`Платформа: ${process.platform}`);
  lines.push(`Память: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`);

  lines.push('');
  lines.push('=== CRUCIX OSINT TERMINAL ===');
  lines.push('🌐 http://localhost:3117/monitor');

  return lines.join('\n');
}

// ============================================================
// 5. HTTP-ОБРАБОТЧИК
// ============================================================

export async function handleMonitorAPI(req, res) {
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
    // GET /api/monitor/check — проверка доступности
    if (path === '/api/monitor/check' && req.method === 'GET') {
      const modules = await checkModules();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, modules }));
      return;
    }

    // GET /api/monitor/inventory — инвентаризация
    if (path === '/api/monitor/inventory' && req.method === 'GET') {
      const modules = await getInventory();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, modules }));
      return;
    }

    // GET /api/monitor/export — экспорт контекста
    if (path === '/api/monitor/export' && req.method === 'GET') {
      const context = await generateContext();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, context }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Неизвестный путь' }));

  } catch (error) {
    console.error('[Monitor API] Ошибка:', error);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: error.message }));
  }
}

export default { handleMonitorAPI };
