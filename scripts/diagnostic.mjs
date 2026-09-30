#!/usr/bin/env node

// ============================================================
// DIAGNOSTIC.MJS — Полная диагностика проекта Crucix
// Версия: 2.0
// Запуск: node scripts/diagnostic.mjs [--checks=all,api,pages,layers,keys,syntax]
// ============================================================

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = process.cwd();

// ============================================================
// 1. КОНФИГУРАЦИЯ
// ============================================================
const REPORT_FILE = path.join(__dirname, 'diagnostic-report.txt');
const LOG_FILE = path.join(__dirname, 'logs', 'diagnostic.log');
const MAX_REPORT_SIZE = 100 * 1024; // 100 KB для чата

// Ключевые страницы для детального анализа
const KEY_PAGES = [
  '/geo-map',
  '/dashboard-5in1',
  '/jarvis',
  '/registry',
  '/monitor',
  '/basket',
  '/dashboard-economic',
  '/dashboard-financial',
  '/dashboard-military',
];

// Ключи API, которые нужно проверить
const API_KEYS = [
  { name: 'FRED_API_KEY', envVar: 'FRED_API_KEY', testUrl: 'https://api.stlouisfed.org/fred/series/observations?series_id=GDP&api_key=' },
  { name: 'NEWSAPI_KEY', envVar: 'NEWSAPI_KEY', testUrl: 'https://newsapi.org/v2/top-headlines?country=us&apiKey=' },
  { name: 'NOAA_API_KEY', envVar: 'NOAA_API_KEY', testUrl: 'https://www.ncdc.noaa.gov/cdo-web/api/v2/datasets?limit=1&' },
  { name: 'EIA_API_KEY', envVar: 'EIA_API_KEY', testUrl: 'https://api.eia.gov/v2/co2-emissions/data?api_key=' },
];

// ============================================================
// 2. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================
function log(msg, color = 'reset') {
  const colors = { reset: '\x1b[0m', green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', blue: '\x1b[34m', cyan: '\x1b[36m', gray: '\x1b[90m' };
  console.log(`${colors[color] || ''}${msg}${colors.reset}`);
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

async function readFile(filePath) {
  try { return await fs.readFile(filePath, 'utf-8'); } catch { return null; }
}

async function fetchJSON(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function formatSize(bytes) {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function truncateText(text, maxLen = 500) {
  if (!text) return '';
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + '… (обрезано)';
}

// ============================================================
// 3. МОДУЛИ ПРОВЕРОК
// ============================================================

// 3.1. Проверка синтаксиса JS-файлов
async function checkSyntax(files) {
  const results = [];
  for (const file of files) {
    try {
      await execAsync(`node --check "${file}"`);
      results.push({ file, status: '✅', error: null });
    } catch (err) {
      results.push({ file, status: '❌', error: err.stderr || err.message });
    }
  }
  return results;
}

// 3.2. Проверка зависимостей package.json
async function checkDependencies() {
  const pkgPath = path.join(__dirname, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath) || '{}');
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const nodeModules = path.join(__dirname, 'node_modules');
  const installed = await fs.readdir(nodeModules).catch(() => []);
  const results = [];
  for (const [name, version] of Object.entries(deps)) {
    const installedVersion = installed.includes(name) ? 'установлена' : 'отсутствует';
    results.push({ name, required: version, installed: installedVersion });
  }
  return results;
}

// 3.3. Проверка API-ключей
async function checkApiKeys() {
  const envPath = path.join(__dirname, '.env');
  const envContent = await readFile(envPath) || '';
  const results = [];
  for (const key of API_KEYS) {
    const regex = new RegExp(`${key.envVar}=(.+)`);
    const match = envContent.match(regex);
    const value = match ? match[1].trim() : null;
    if (!value || value === 'your_' + key.envVar.toLowerCase()) {
      results.push({ name: key.name, status: '⚠️', message: 'Ключ не задан в .env' });
      continue;
    }
    // Проверяем доступность через тестовый запрос
    const testUrl = key.testUrl + value;
    const data = await fetchJSON(testUrl);
    if (data) {
      results.push({ name: key.name, status: '✅', message: 'Ключ работает' });
    } else {
      results.push({ name: key.name, status: '❌', message: 'Ключ невалидный или API недоступен' });
    }
  }
  return results;
}

// 3.4. Детальная информация о странице
async function getPageInfo(pageUrl) {
  const baseUrl = 'http://localhost:3117';
  const url = baseUrl + pageUrl;
  try {
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) return { url, status: res.status, error: `HTTP ${res.status}` };
    const html = await res.text();
    // Извлекаем мета-информацию
    const titleMatch = html.match(/<title>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : '—';
    // Размер страницы
    const size = Buffer.byteLength(html, 'utf-8');
    // Проверяем, есть ли скрипты карты
    const hasMapScript = html.includes('leaflet') || html.includes('map');
    // Проверяем наличие кнопки копирования
    const hasCopyBtn = html.includes('КОПИРОВАТЬ') || html.includes('copy-btn');
    // Статистика объектов на странице (приблизительно)
    const scriptCount = (html.match(/<script/g) || []).length;
    const linkCount = (html.match(/<a /g) || []).length;
    const imgCount = (html.match(/<img /g) || []).length;
    return {
      url,
      status: 200,
      title,
      size,
      hasMapScript,
      hasCopyBtn,
      scriptCount,
      linkCount,
      imgCount,
      truncatedHtml: truncateText(html, 500),
    };
  } catch (err) {
    return { url, status: 500, error: err.message };
  }
}

// ============================================================
// 4. ГЛАВНАЯ ФУНКЦИЯ ДИАГНОСТИКИ
// ============================================================
async function runDiagnostic(checks = 'all') {
  const checkList = checks === 'all' ? ['api', 'pages', 'layers', 'keys', 'syntax'] : checks.split(',');
  
  log('\n🔍 ЗАПУСК ПОЛНОЙ ДИАГНОСТИКИ CRUCIX (v2.0)', 'cyan');
  log('═'.repeat(60), 'gray');

  const reportLines = [];
  reportLines.push('=== DIAGNOSTIC REPORT v2.0 ===');
  reportLines.push(`Дата: ${new Date().toISOString()}`);
  reportLines.push(`Версия Crucix: 2.3.0`);
  reportLines.push(`Путь: ${__dirname}`);
  reportLines.push(`Проверки: ${checks}`);
  reportLines.push('');

  // --- 4.1. Проверка API-модулей ---
  if (checkList.includes('api')) {
    log('\n📦 ПРОВЕРКА API-МОДУЛЕЙ...', 'blue');
    const apiFiles = await scanDirectory(path.join(__dirname, 'apis', 'sources'), /\.mjs$/);
    reportLines.push(`\n📦 API-модули (${apiFiles.length} файлов):`);
    let apiOk = 0, apiMiss = 0;
    for (const file of apiFiles.slice(0, 20)) { // ограничим для компактности
      const name = file.name.replace(/\.mjs$/, '');
      const inServer = await checkServerImports(name);
      const status = inServer ? '✅' : '⚠️';
      if (inServer) apiOk++; else apiMiss++;
      reportLines.push(`  ${status} ${name} — ${formatSize(file.size)}`);
    }
    if (apiFiles.length > 20) reportLines.push(`  ... и ещё ${apiFiles.length - 20} файлов`);
    reportLines.push(`\n  Итого: ${apiOk} зарегистрировано, ${apiMiss} не зарегистрировано`);
  }

  // --- 4.2. Проверка страниц ---
  if (checkList.includes('pages')) {
    log('\n📄 ПРОВЕРКА СТРАНИЦ...', 'blue');
    const pageFiles = await scanDirectory(path.join(__dirname, 'dashboard', 'public'), /\.html$/);
    reportLines.push(`\n📄 Страницы (${pageFiles.length} файлов):`);
    let pageOk = 0, pageMiss = 0;
    for (const file of pageFiles.slice(0, 20)) {
      const name = file.name.replace(/\.html$/, '');
      const inServer = await checkPageRoute(name);
      const status = inServer ? '✅' : '⚠️';
      if (inServer) pageOk++; else pageMiss++;
      reportLines.push(`  ${status} /${name} — ${formatSize(file.size)}`);
    }
    if (pageFiles.length > 20) reportLines.push(`  ... и ещё ${pageFiles.length - 20} файлов`);
    reportLines.push(`\n  Итого: ${pageOk} зарегистрировано, ${pageMiss} не зарегистрировано`);
  }

  // --- 4.3. Проверка слоёв ---
  if (checkList.includes('layers')) {
    log('\n🗺️ ПРОВЕРКА СЛОЁВ...', 'blue');
    const serverStatus = await fetchJSON('http://localhost:3117/api/layers');
    if (!serverStatus || !serverStatus.success) {
      reportLines.push('\n⚠️ СЕРВЕР НЕ ДОСТУПЕН! Запустите node server.mjs');
      log('⚠️ СЕРВЕР НЕ ДОСТУПЕН', 'red');
    } else {
      const layers = serverStatus.layers || [];
      reportLines.push(`\n🗺️ Слои (${layers.length} всего):`);
      let layerOk = 0, layerEmpty = 0, layerError = 0;
      for (const layer of layers.slice(0, 30)) {
        const data = await checkLayerAPI(layer.id);
        let status = '⚠️';
        let detail = '';
        if (data) {
          if (data.total > 0) {
            status = '✅';
            layerOk++;
            detail = `${data.total} маркеров`;
          } else {
            status = '⚠️';
            layerEmpty++;
            detail = 'пусто';
          }
        } else {
          status = '❌';
          layerError++;
          detail = 'API не отвечает';
        }
        reportLines.push(`  ${status} ${layer.id} (${layer.name}) — ${detail}`);
      }
      if (layers.length > 30) reportLines.push(`  ... и ещё ${layers.length - 30} слоёв`);
      reportLines.push(`\n  Итого: ${layerOk} ✅, ${layerEmpty} ⚠️ (пустые), ${layerError} ❌ (ошибки)`);
    }
  }

  // --- 4.4. Проверка API-ключей ---
  if (checkList.includes('keys')) {
    log('\n🔑 ПРОВЕРКА API-КЛЮЧЕЙ...', 'blue');
    const keyResults = await checkApiKeys();
    reportLines.push('\n🔑 API-ключи:');
    for (const r of keyResults) {
      reportLines.push(`  ${r.status} ${r.name}: ${r.message}`);
    }
  }

  // --- 4.5. Проверка синтаксиса JS ---
  if (checkList.includes('syntax')) {
    log('\n🔧 ПРОВЕРКА СИНТАКСИСА JS...', 'blue');
    const jsFiles = (await scanDirectory(path.join(__dirname, 'apis'), /\.mjs$/))
      .concat(await scanDirectory(path.join(__dirname, 'scripts'), /\.mjs$/))
      .slice(0, 10); // ограничим для скорости
    const syntaxResults = await checkSyntax(jsFiles.map(f => f.path));
    reportLines.push('\n🔧 Синтаксис JS:');
    for (const r of syntaxResults) {
      reportLines.push(`  ${r.status} ${path.basename(r.file)}${r.error ? ' — ' + r.error : ''}`);
    }
  }

  // --- 4.6. Детальная информация о ключевых страницах ---
  log('\n📋 СБОР ИНФОРМАЦИИ О КЛЮЧЕВЫХ СТРАНИЦАХ...', 'blue');
  reportLines.push('\n📋 КЛЮЧЕВЫЕ СТРАНИЦЫ:');
  for (const page of KEY_PAGES) {
    const info = await getPageInfo(page);
    reportLines.push(`  ${info.status === 200 ? '✅' : '❌'} ${page} — статус ${info.status}${info.error ? ', ошибка: ' + info.error : ''}`);
    if (info.status === 200) {
      reportLines.push(`    Заголовок: ${info.title}`);
      reportLines.push(`    Размер: ${formatSize(info.size)}`);
      reportLines.push(`    Карта: ${info.hasMapScript ? 'есть' : 'нет'}`);
      reportLines.push(`    Кнопка копирования: ${info.hasCopyBtn ? 'есть' : 'нет'}`);
      reportLines.push(`    Скриптов: ${info.scriptCount}, ссылок: ${info.linkCount}, картинок: ${info.imgCount}`);
      // Добавляем фрагмент HTML для контекста (ограниченно)
      reportLines.push(`    Фрагмент: ${info.truncatedHtml}`);
      reportLines.push('');
    }
  }

  // --- 4.7. Итоговое резюме ---
  log('\n📊 ИТОГОВОЕ РЕЗЮМЕ:', 'cyan');
  const summary = [
    `API-модули: ${(await scanDirectory(path.join(__dirname, 'apis', 'sources'), /\.mjs$/)).length} файлов`,
    `Страницы: ${(await scanDirectory(path.join(__dirname, 'dashboard', 'public'), /\.html$/)).length} файлов`,
    `Сборщики: ${(await scanDirectory(path.join(__dirname, 'scripts'), /^collect-.*\.mjs$/)).length}`,
    `Слоёв: ${(await fetchJSON('http://localhost:3117/api/layers'))?.layers?.length || '—'}`,
  ];
  for (const line of summary) {
    log(`  ${line}`, 'gray');
    reportLines.push(`  ${line}`);
  }

  // Сохраняем отчёт, обрезая до 100 KB
  let reportText = reportLines.join('\n');
  if (reportText.length > MAX_REPORT_SIZE) {
    reportText = reportText.slice(0, MAX_REPORT_SIZE) + '\n… (отчёт обрезан до 100 КБ)';
  }
  await fs.writeFile(REPORT_FILE, reportText);
  log(`\n✅ Отчёт сохранён в ${REPORT_FILE} (${formatSize(reportText.length)})`, 'green');

  // Сохраняем в лог
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, `\n--- ${new Date().toISOString()} ---\n${reportText}\n`);

  log('\n✅ ДИАГНОСТИКА ЗАВЕРШЕНА', 'green');
  log(`📄 Полный отчёт: ${REPORT_FILE}`, 'cyan');
  console.log('\n' + '═'.repeat(60));
}

// ============================================================
// 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (дублируем из предыдущей версии)
// ============================================================
async function scanDirectory(dir, pattern = '') {
  try {
    const files = await fs.readdir(dir);
    const result = [];
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        const sub = await scanDirectory(fullPath, pattern);
        result.push(...sub);
      } else if (!pattern || file.match(pattern)) {
        result.push({ name: file, path: fullPath, size: stat.size, mtime: stat.mtime });
      }
    }
    return result;
  } catch { return []; }
}

async function checkServerImports(moduleName) {
  const serverPath = path.join(__dirname, 'server.mjs');
  const content = await readFile(serverPath);
  if (!content) return false;
  const pattern = new RegExp(`['"]\\./apis/sources/${moduleName}['"]`, 'i');
  return pattern.test(content);
}

async function checkPageRoute(page) {
  const serverPath = path.join(__dirname, 'server.mjs');
  const content = await readFile(serverPath);
  if (!content) return false;
  const pattern = new RegExp(`'/${page}':\\s*'${page}\\.html'`, 'i');
  return pattern.test(content);
}

async function checkLayerAPI(layerName) {
  const url = `http://localhost:3117/api/layers/${layerName}`;
  const data = await fetchJSON(url);
  if (!data || !data.success) return null;
  return { total: data.total || 0 };
}

// ============================================================
// 6. ЗАПУСК С ПАРСИНГОМ АРГУМЕНТОВ
// ============================================================
const args = process.argv.slice(2);
let checks = 'all';
for (const arg of args) {
  if (arg.startsWith('--checks=')) {
    checks = arg.split('=')[1];
  }
}

runDiagnostic(checks).catch(err => {
  console.error('❌ Ошибка при выполнении диагностики:', err);
  process.exit(1);
});
