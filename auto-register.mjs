#!/usr/bin/env node
/**
 * auto-register.mjs — Автоматический регистратор компонентов Crucix
 *
 * Сканирует проект, регистрирует API-модули, страницы, сборщики,
 * проверяет справки, анализирует геокарту и генерирует отчёт.
 *
 * Использование:
 *   node auto-register.mjs              Полная регистрация
 *   node auto-register.mjs --report     Только отчёт (без изменений)
 *   node auto-register.mjs --api        Только API-модули
 *   node auto-register.mjs --pages      Только страницы
 *   node auto-register.mjs --collectors Только сборщики
 *   node auto-register.mjs --help-stubs Создать заглушки справок
 *   node auto-register.mjs --all        Всё + заглушки справок
 *   node auto-register.mjs --no-geo     Пропустить геокарту
 *
 * Создано: 07.09.2026
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
//  КОНСТАНТЫ И ПУТИ
// ============================================================

const ROOT = __dirname;
const DIRS = {
  apis:       path.join(ROOT, 'apis', 'sources'),
  pages:      path.join(ROOT, 'dashboard', 'public'),
  collectors: path.join(ROOT, 'scripts', 'collectors'),
  server:     path.join(ROOT, 'server'),
  helpRu:     path.join(ROOT, 'data', 'help', 'ru'),
  helpEn:     path.join(ROOT, 'data', 'help', 'en'),
  data:       path.join(ROOT, 'data'),
  geoMapJs:   path.join(ROOT, 'dashboard', 'public', 'geo-map', 'js'),
};

const FILES = {
  modules:      path.join(DIRS.server, 'modules.json'),
  routesApi:    path.join(DIRS.server, 'routes-api.json'),
  pages:        path.join(DIRS.server, 'pages.json'),
  routesPages:  path.join(DIRS.server, 'routes-pages.json'),
  collectors:   path.join(DIRS.server, 'collectors.json'),
  report:       path.join(ROOT, 'crucix-health-report.json'),
};

const TARGET_EXT = ['.mjs', '.js'];
const PAGE_EXT   = ['.html'];
const COLLECTOR_PREFIX = 'collect-';

// ============================================================
//  УТИЛИТЫ
// ============================================================

function log(msg) {
  console.log(msg);
}

function logOk(msg) {
  console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
}

function logWarn(msg) {
  console.log(`  \x1b[33m⚠\x1b[0m ${msg}`);
}

function logErr(msg) {
  console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
}

function logInfo(msg) {
  console.log(`  \x1b[36mℹ\x1b[0m ${msg}`);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJSON(filePath, fallback = []) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    logWarn(`Не удалось прочитать ${path.basename(filePath)}: ${e.message}`);
  }
  return fallback;
}

function writeJSON(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
}

function findFiles(dirPath, extensions, prefix = null) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      results.push(...findFiles(path.join(dirPath, entry.name), extensions, prefix));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (!extensions.includes(ext)) continue;
      if (prefix && !entry.name.startsWith(prefix)) continue;
      results.push(path.join(dirPath, entry.name));
    }
  }
  return results.sort();
}

// ============================================================
//  ПАРСЕР API-МОДУЛЕЙ
// ============================================================

function parseApiModule(filePath) {
  const content = readText(filePath);
  if (!content) return null;

  const name = path.basename(filePath, path.extname(filePath));
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // Извлекаем endpoint — ищем /api/... в строках
  let endpoint = null;
  const endpointMatch = content.match(/['"`](\/api\/[^'"`\s]+)['"`]/);
  if (endpointMatch) {
    endpoint = endpointMatch[1];
  }

  // Извлекаем HTTP-метод
  let method = 'GET';
  const methodMatch = content.match(/\b(GET|POST|PUT|DELETE|PATCH)\b/);
  if (methodMatch) {
    method = methodMatch[1];
  }

  // Извлекаем описание из JSDoc
  let description = '';
  const descMatch = content.match(/@description\s+(.+)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    const commentMatch = content.match(/\/\*\*?[\s\S]*?\*\/\s*\n/);
    if (commentMatch) {
      const lines = commentMatch[0]
        .replace(/\/\*|\*\//g, '')
        .split('\n')
        .map(l => l.replace(/^\s*\*/, '').trim())
        .filter(l => l && !l.startsWith('@'));
      description = lines.join(' ').slice(0, 200);
    }
  }

  // Извлекаем версию
  let version = '0.1';
  const versionMatch = content.match(/@version\s+(.+)/i) || content.match(/version['"\s:=]+['"]?([\d.]+)/i);
  if (versionMatch) {
    version = versionMatch[1].trim();
  }

  // Извлекаем автора
  let author = '';
  const authorMatch = content.match(/@author\s+(.+)/i);
  if (authorMatch) {
    author = authorMatch[1].trim();
  }

  // Извлекаем экспортируемые функции
  const exports = [];
  const exportMatches = content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g);
  for (const m of exportMatches) {
    exports.push(m[1]);
  }
  const constExports = content.matchAll(/export\s+const\s+(\w+)\s*=/g);
  for (const m of constExports) {
    exports.push(m[1]);
  }

  return {
    id: name,
    name,
    path: relPath,
    endpoint,
    method,
    description,
    version,
    author,
    exports: [...new Set(exports)],
    registered: false,
    hasHelpRu: false,
    hasHelpEn: false,
  };
}

// ============================================================
//  ПАРСЕР СТРАНИЦ
// ============================================================

function parsePage(filePath) {
  const content = readText(filePath);
  if (!content) return null;

  const name = path.basename(filePath, path.extname(filePath));
  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  // Заголовок из <title>
  let title = name;
  const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Описание из <meta name="description">
  let description = '';
  const metaMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (metaMatch) {
    description = metaMatch[1].trim();
  } else {
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) {
      description = h1Match[1].trim().slice(0, 200);
    }
  }

  // Категория
  let category = 'general';
  const lowerPath = relPath.toLowerCase();
  if (lowerPath.includes('geo-map') || lowerPath.includes('geomap')) {
    category = 'geomap';
  } else if (lowerPath.includes('dashboard')) {
    category = 'dashboard';
  } else if (lowerPath.includes('admin')) {
    category = 'admin';
  } else if (lowerPath.includes('help')) {
    category = 'help';
  }

  // URL маршрута
  let route = `/${name}`;
  if (lowerPath.includes('geo-map')) {
    route = '/geo-map';
  } else if (category === 'dashboard') {
    route = `/${name}`;
  }

  return {
    id: name,
    name,
    path: relPath,
    title,
    description,
    category,
    route,
    registered: false,
    hasHelpRu: false,
    hasHelpEn: false,
  };
}

// ============================================================
//  ПАРСЕР СБОРЩИКОВ
// ============================================================

function parseCollector(filePath) {
  const content = readText(filePath);
  if (!content) return null;

  const basename = path.basename(filePath, path.extname(filePath));
  const name = basename.replace(/^collect-/, '');

  // Описание
  let description = '';
  const descMatch = content.match(/@description\s+(.+)/i);
  if (descMatch) {
    description = descMatch[1].trim();
  } else {
    const commentMatch = content.match(/\/\*\*?[\s\S]*?\*\/\s*\n/);
    if (commentMatch) {
      const lines = commentMatch[0]
        .replace(/\/\*|\*\//g, '')
        .split('\n')
        .map(l => l.replace(/^\s*\*/, '').trim())
        .filter(l => l && !l.startsWith('@'));
      description = lines.join(' ').slice(0, 200);
    }
  }

  // Цель данных
  let dataSource = '';
  const dataMatch = content.match(/@data\s+(.+)/i) || content.match(/source['"=:]+['"]?([^'"\n]+)/i);
  if (dataMatch) {
    dataSource = dataMatch[1].trim();
  }

  // Интервал
  let interval = 0;
  const intervalMatch = content.match(/@interval\s+(\d+)/i) || content.match(/interval['"=:]+(\d+)/i);
  if (intervalMatch) {
    interval = parseInt(intervalMatch[1], 10);
  }

  const relPath = path.relative(ROOT, filePath).replace(/\\/g, '/');

  return {
    id: name,
    name,
    path: relPath,
    description,
    dataSource,
    interval,
    hasHelpRu: false,
  };
}

// ============================================================
//  ПАРСЕР ГЕОКАРТЫ
// ============================================================

function parseGeoLayers() {
  const layersFile = path.join(DIRS.geoMapJs, 'layers.js');
  const content = readText(layersFile);
  if (!content) {
    return { total: 0, withApi: 0, withoutApi: 0, layers: [], categories: 0 };
  }

  // Извлекаем объекты слоёв — ищем { id: ..., name: ..., api: ... }
  const layers = [];
  const layerRegex = /\{\s*id\s*:\s*['"`]([^'"`]+)['"`]\s*,[\s\S]*?\}/g;
  let match;
  while ((match = layerRegex.exec(content)) !== null) {
    const block = match[0];
    const id = match[1];
    const nameMatch = block.match(/name\s*:\s*['"`]([^'"`]+)['"`]/);
    const categoryMatch = block.match(/category\s*:\s*['"`]([^'"`]+)['"`]/);
    const apiMatch = block.match(/api\s*:\s*['"`]([^'"`]+)['"`]/);

    layers.push({
      id,
      name: nameMatch ? nameMatch[1] : id,
      category: categoryMatch ? categoryMatch[1] : 'unknown',
      hasApi: !!apiMatch,
      apiEndpoint: apiMatch ? apiMatch[1] : null,
    });
  }

  // Категории
  const categories = new Set(layers.map(l => l.category));

  return {
    total: layers.length,
    withApi: layers.filter(l => l.hasApi).length,
    withoutApi: layers.filter(l => !l.hasApi).length,
    layers,
    categories: categories.size,
    layersWithoutApi: layers.filter(l => !l.hasApi).map(l => l.name),
  };
}

// ============================================================
//  ПРОВЕРКА СПРАВОК
// ============================================================

function checkHelp(name, lang = 'ru') {
  const dir = lang === 'ru' ? DIRS.helpRu : DIRS.helpEn;
  const file = path.join(dir, `${name}.md`);
  return fs.existsSync(file);
}

// ============================================================
//  СОЗДАНИЕ ЗАГОЛУШЕК СПРАВОК
// ============================================================

function createHelpStub(name, type, lang = 'ru') {
  const dir = lang === 'ru' ? DIRS.helpRu : DIRS.helpEn;
  ensureDir(dir);

  const file = path.join(dir, `${name}.md`);
  if (fs.existsSync(file)) return false;

  const stub = `# ${name}

> Справка по ${type}: \`${name}\`
> Автосгенерировано: ${new Date().toISOString().slice(0, 10)}

## Описание

TODO — заполните описание.

## Параметры

| Параметр | Тип | По умолчанию | Описание |
|----------|-----|-------------|----------|
| TODO | TODO | TODO | TODO |

## Пример использования

TODO — добавьте пример.

## Возвращаемое значение

TODO — опишите возвращаемое значение.

## Ошибки

TODO — опишите возможные ошибки и способы их обработки.
`;

  fs.writeFileSync(file, stub, 'utf-8');
  return true;
}

// ============================================================
//  РЕГИСТРАЦИЯ API-МОДУЛЕЙ
// ============================================================

function registerApiModules(report, dryRun = false) {
  log('\n' + '='.repeat(60));
  log('📋 РЕГИСТРАЦИЯ API-МОДУЛЕЙ');
  log('='.repeat(60));

  const files = findFiles(DIRS.apis, ['.mjs']);
  log(`Найдено .mjs файлов: ${files.length}`);

  const existingModules = readJSON(FILES.modules, { modules: [] });
  const existingMap = new Map();
  if (Array.isArray(existingModules.modules)) {
    existingModules.modules.forEach(m => existingMap.set(m.id || m.name, m));
  } else if (Array.isArray(existingModules)) {
    existingModules.forEach(m => existingMap.set(m.id || m.name, m));
  }

  const existingRoutes = readJSON(FILES.routesApi, []);
  const existingRouteMap = new Map();
  if (Array.isArray(existingRoutes)) {
    existingRoutes.forEach(r => existingRouteMap.set(r.id || r.path || r.endpoint, r));
  }

  const modules = [];
  const routes = [];
  let newCount = 0;
  let updatedCount = 0;
  let noEndpointCount = 0;

  for (const file of files) {
    const mod = parseApiModule(file);
    if (!mod) continue;

    // Проверяем справки
    mod.hasHelpRu = checkHelp(mod.name, 'ru');
    mod.hasHelpEn = checkHelp(mod.name, 'en');

    const wasRegistered = existingMap.has(mod.id);

    if (!wasRegistered) {
      newCount++;
      report.apiModulesNew.push(mod.id);
    } else {
      const old = existingMap.get(mod.id);
      if (old.endpoint !== mod.endpoint || old.method !== mod.method) {
        updatedCount++;
      }
    }

    mod.registered = true;
    modules.push(mod);

    // Маршрут
    if (mod.endpoint) {
      routes.push({
        id: mod.id,
        endpoint: mod.endpoint,
        method: mod.method,
        module: mod.id,
      });
    } else {
      noEndpointCount++;
      report.apiModulesNoEndpoint.push(mod.id);
    }

    if (!mod.hasHelpRu) {
      report.apiModulesNoHelp.push(mod.id);
    }
  }

  log(`  Всего модулей: ${modules.length}`);
  logOk(`Новых зарегистрировано: ${newCount}`);
  logInfo(`Обновлено: ${updatedCount}`);
  if (noEndpointCount > 0) {
    logWarn(`Без endpoint (нет /api/...): ${noEndpointCount}`);
  }

  report.apiModulesTotal = modules.length;
  report.apiModulesWithoutHelp = report.apiModulesNoHelp.length;

  if (!dryRun) {
    writeJSON(FILES.modules, { modules, updated: new Date().toISOString() });
    writeJSON(FILES.routesApi, routes);
    log(`\n  Записано: ${path.relative(ROOT, FILES.modules)}`);
    log(`  Записано: ${path.relative(ROOT, FILES.routesApi)}`);
  }

  return { modules, routes };
}

// ============================================================
//  РЕГИСТРАЦИЯ СТРАНИЦ
// ============================================================

function registerPages(report, dryRun = false) {
  log('\n' + '='.repeat(60));
  log('📄 РЕГИСТРАЦИЯ СТРАНИЦ');
  log('='.repeat(60));

  const files = findFiles(DIRS.pages, PAGE_EXT);
  log(`Найдено HTML файлов: ${files.length}`);

  const existingPages = readJSON(FILES.pages, { pages: [] });
  const existingMap = new Map();
  if (Array.isArray(existingPages.pages)) {
    existingPages.pages.forEach(p => existingMap.set(p.id || p.name, p));
  } else if (Array.isArray(existingPages)) {
    existingPages.forEach(p => existingMap.set(p.id || p.name, p));
  }

  const existingRoutes = readJSON(FILES.routesPages, []);
  const existingRouteMap = new Map();
  if (Array.isArray(existingRoutes)) {
    existingRoutes.forEach(r => existingRouteMap.set(r.id || r.route, r));
  }

  const pages = [];
  const routes = [];
  let newCount = 0;

  for (const file of files) {
    // Пропускаем служебные файлы
    const basename = path.basename(file);
    if (basename === 'index.html' && file.includes('geo-map')) continue;

    const page = parsePage(file);
    if (!page) continue;

    page.hasHelpRu = checkHelp(page.name, 'ru');
    page.hasHelpEn = checkHelp(page.name, 'en');

    const wasRegistered = existingMap.has(page.id);
    if (!wasRegistered) {
      newCount++;
      report.pagesNew.push(page.id);
    }

    page.registered = true;
    pages.push(page);

    routes.push({
      id: page.id,
      route: page.route,
      file: page.path,
    });

    if (!page.hasHelpRu) {
      report.pagesNoHelp.push(page.id);
    }
  }

  log(`  Всего страниц: ${pages.length}`);
  logOk(`Новых зарегистрировано: ${newCount}`);

  report.pagesTotal = pages.length;
  report.pagesWithoutHelp = report.pagesNoHelp.length;

  if (!dryRun) {
    writeJSON(FILES.pages, { pages, updated: new Date().toISOString() });
    writeJSON(FILES.routesPages, routes);
    log(`\n  Записано: ${path.relative(ROOT, FILES.pages)}`);
    log(`  Записано: ${path.relative(ROOT, FILES.routesPages)}`);
  }

  return { pages, routes };
}

// ============================================================
//  РЕГИСТРАЦИЯ СБОРЩИКОВ
// ============================================================

function registerCollectors(report, dryRun = false) {
  log('\n' + '='.repeat(60));
  log('🔧 РЕГИСТРАЦИЯ СБОРЩИКОВ');
  log('='.repeat(60));

  const files = findFiles(DIRS.collectors, TARGET_EXT, COLLECTOR_PREFIX);
  log(`Найдено сборщиков: ${files.length}`);

  const collectors = [];
  let newCount = 0;

  for (const file of files) {
    const col = parseCollector(file);
    if (!col) continue;

    col.hasHelpRu = checkHelp(col.name, 'ru');
    collectors.push(col);
    newCount++;

    if (!col.hasHelpRu) {
      report.collectorsNoHelp.push(col.id);
    }
  }

  log(`  Всего сборщиков: ${collectors.length}`);
  logOk(`Зарегистрировано: ${newCount}`);

  report.collectorsTotal = collectors.length;
  report.collectorsWithoutHelp = report.collectorsNoHelp.length;

  if (!dryRun) {
    writeJSON(FILES.collectors, { collectors, updated: new Date().toISOString() });
    log(`\n  Записано: ${path.relative(ROOT, FILES.collectors)}`);
  }

  return collectors;
}

// ============================================================
//  АНАЛИЗ ГЕОКАРТЫ
// ============================================================

function analyzeGeoMap(report, dryRun = false) {
  log('\n' + '='.repeat(60));
  log('🗺️  АНАЛИЗ ГЕОКАРТЫ');
  log('='.repeat(60));

  const geo = parseGeoLayers();

  log(`  Всего слоёв: ${geo.total}`);
  log(`  Категорий: ${geo.categories}`);
  logOk(`Слоёв с API: ${geo.withApi}`);
  if (geo.withoutApi > 0) {
    logWarn(`Слоёв без API: ${geo.withoutApi}`);
    geo.layersWithoutApi.forEach(name => {
      log(`    — ${name}`);
    });
  }

  report.geoLayersTotal = geo.total;
  report.geoLayersWithApi = geo.withApi;
  report.geoLayersWithoutApi = geo.withoutApi;
  report.geoLayersWithoutApiNames = geo.layersWithoutApi;

  return geo;
}

// ============================================================
//  СОЗДАНИЕ ЗАГЛУШЕК СПРАВОК
// ============================================================

function createAllHelpStubs(modules, pages, collectors) {
  log('\n' + '='.repeat(60));
  log('📝 СОЗДАНИЕ ЗАГЛУШЕК СПРАВОК');
  log('='.repeat(60));

  let created = 0;

  for (const mod of modules) {
    if (!mod.hasHelpRu) {
      if (createHelpStub(mod.name, 'модуль', 'ru')) {
        logOk(`Создана справка: ${mod.name}.md`);
        created++;
      }
    }
  }

  for (const page of pages) {
    if (!page.hasHelpRu) {
      if (createHelpStub(page.name, 'страница', 'ru')) {
        logOk(`Создана справка: ${page.name}.md`);
        created++;
      }
    }
  }

  for (const col of collectors) {
    if (!col.hasHelpRu) {
      if (createHelpStub(col.name, 'сборщик', 'ru')) {
        logOk(`Создана справка: ${col.name}.md`);
        created++;
      }
    }
  }

  log(`\n  Всего создано заглушек: ${created}`);
  return created;
}

// ============================================================
//  ГЕНЕРАЦИЯ ОТЧЁТА
// ============================================================

function generateReport(report, dryRun) {
  log('\n' + '='.repeat(60));
  log('📊 ОТЧЁТ О ЗДОРОВЬЕ CRUCIX');
  log('='.repeat(60));

  report.timestamp = new Date().toISOString();
  report.mode = dryRun ? 'report-only' : 'full';

  // Сводка
  log('\n  СВОДКА:');
  log(`    API-модулей:    ${report.apiModulesTotal} (новых: ${report.apiModulesNew.length}, без endpoint: ${report.apiModulesNoEndpoint.length})`);
  log(`    Страниц:        ${report.pagesTotal} (новых: ${report.pagesNew.length})`);
  log(`    Сборщиков:      ${report.collectorsTotal}`);
  log(`    Слоёв карты:    ${report.geoLayersTotal} (с API: ${report.geoLayersWithApi}, без API: ${report.geoLayersWithoutApi})`);
  log(`    Без справки:    API: ${report.apiModulesNoHelp.length}, страниц: ${report.pagesNoHelp.length}, сборщиков: ${report.collectorsNoHelp.length}`);

  // Проблемы
  const problems = [];
  if (report.apiModulesNoEndpoint.length > 0) {
    problems.push(`${report.apiModulesNoEndpoint.length} API-модулей без endpoint`);
  }
  if (report.apiModulesNoHelp.length > 0) {
    problems.push(`${report.apiModulesNoHelp.length} API-модулей без справки`);
  }
  if (report.pagesNoHelp.length > 0) {
    problems.push(`${report.pagesNoHelp.length} страниц без справки`);
  }
  if (report.geoLayersWithoutApi > 0) {
    problems.push(`${report.geoLayersWithoutApi} слоёв геокарты без API`);
  }

  report.problems = problems;
  report.healthScore = Math.max(0, 100 - problems.length * 15);

  if (problems.length === 0) {
    log('\n  \x1b[32m✓ Проблем не обнаружено!\x1b[0m');
  } else {
    log('\n  \x1b[33mПРОБЛЕМЫ:\x1b[0m');
    problems.forEach(p => log(`    — ${p}`));
  }

  log(`\n  Оценка здоровья: ${report.healthScore}/100`);

  // Запись отчёта
  writeJSON(FILES.report, report);
  log(`\n  Отчёт записан: ${path.relative(ROOT, FILES.report)}`);

  // Инструкция для DeepSeek
  log('\n' + '-'.repeat(60));
  log('ДЛЯ DEEPSEEK:');
  log('  Скопируйте содержимое crucix-health-report.json');
  log('  и вставьте в чат с DeepSeek с текстом:');
  log('  "Вот актуальный отчёт Crucix. Обнови memory.md."');
  log('-'.repeat(60));
}

// ============================================================
//  ПОКАЗАТЬ СПРАВКУ
// ============================================================

function showHelp() {
  console.log(`
  auto-register.mjs — Автоматический регистратор Crucix

  Использование:
    node auto-register.mjs              Полная регистрация
    node auto-register.mjs --report     Только отчёт (без изменений)
    node auto-register.mjs --api        Только API-модули
    node auto-register.mjs --pages      Только страницы
    node auto-register.mjs --collectors Только сборщики
    node auto-register.mjs --help-stubs Создать заглушки справок
    node auto-register.mjs --all        Всё + заглушки справок
    node auto-register.mjs --no-geo     Пропустить геокарту

  Что делает:
    1. Сканирует /apis/sources/ → регистрирует API-модули
    2. Сканирует /dashboard/public/ → регистрирует страницы
    3. Сканирует /scripts/collectors/ → регистрирует сборщики
    4. Проверяет /data/help/ru/ → находит модули без справки
    5. Анализирует layers.js → находит слои без API
    6. Генерирует crucix-health-report.json
  `);
}

// ============================================================
//  ГЛАВНАЯ ФУНКЦИЯ
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const dryRun = args.includes('--report');
  const doAll = args.includes('--all') || (!args.includes('--api') && !args.includes('--pages') && !args.includes('--collectors') && !args.includes('--help-stubs') && !dryRun);
  const doApi = doAll || args.includes('--api');
  const doPages = doAll || args.includes('--pages');
  const doCollectors = doAll || args.includes('--collectors');
  const doHelpStubs = doAll || args.includes('--help-stubs');
  const doGeo = !args.includes('--no-geo');

  log('');
  log('  \x1b[36m╔══════════════════════════════════════╗\x1b[0m');
  log('  \x1b[36m║   Crucix Auto-Register v1.0          ║\x1b[0m');
  log('  \x1b[36m║   ' + new Date().toLocaleString('ru-RU').padEnd(34) + '║\x1b[0m');
  log('  \x1b[36m╚══════════════════════════════════════╝\x1b[0m');
  log('');

  if (dryRun) {
    log('  РЕЖИМ: Только отчёт (без записи файлов)');
  } else {
    log('  РЕЖИМ: Полная регистрация');
  }
  log('  Папка проекта: ' + ROOT);
  log('');

  const report = {
    apiModulesTotal: 0,
    apiModulesNew: [],
    apiModulesNoEndpoint: [],
    apiModulesNoHelp: [],
    pagesTotal: 0,
    pagesNew: [],
    pagesNoHelp: [],
    collectorsTotal: 0,
    collectorsNoHelp: [],
    geoLayersTotal: 0,
    geoLayersWithApi: 0,
    geoLayersWithoutApi: 0,
    geoLayersWithoutApiNames: [],
    problems: [],
    healthScore: 100,
    timestamp: null,
    mode: null,
  };

  let modulesResult = { modules: [], routes: [] };
  let pagesResult = { pages: [], routes: [] };
  let collectorsResult = [];

  // 1. API-модули
  if (doApi) {
    modulesResult = registerApiModules(report, dryRun);
  }

  // 2. Страницы
  if (doPages) {
    pagesResult = registerPages(report, dryRun);
  }

  // 3. Сборщики
  if (doCollectors) {
    collectorsResult = registerCollectors(report, dryRun);
  }

  // 4. Геокарта
  if (doGeo) {
    analyzeGeoMap(report, dryRun);
  }

  // 5. Заглушки справок
  if (doHelpStubs && !dryRun) {
    createAllHelpStubs(modulesResult.modules, pagesResult.pages, collectorsResult);
  }

  // 6. Отчёт
  generateReport(report, dryRun);

  log('');
  log('  \x1b[32mГотово!\x1b[0m');
  log('');
}

main().catch(err => {
  console.error('\n\x1b[31mКритическая ошибка:\x1b[0m', err);
  process.exit(1);
});
