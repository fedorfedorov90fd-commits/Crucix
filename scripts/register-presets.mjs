#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX PRESET REGISTRAR
//  Добавляет preset-api в modules.json и routes-api.json.
//  Ничего не удаляет. Только добавляет недостающие записи.
//  Правило 13.5: правка JSON через JSON.parse/stringify.
//  Запуск: node scripts/register-presets.mjs
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MODULES_FILE = join(ROOT, 'server', 'modules.json');
const ROUTES_FILE = join(ROOT, 'server', 'routes-api.json');

const NEW_MODULE = { id: 'preset-api', path: './apis/sources/preset-api' };

const NEW_ROUTES = [
  { path: '/api/layers/preset',                    module: 'preset-api', method: 'GET' },
  { path: '/api/layers/preset/',                   module: 'preset-api', method: 'GET' },
  { path: '/api/layers/preset/*',                  module: 'preset-api', method: 'GET' },
  { path: '/api/layers/preset/*',                  module: 'preset-api', method: 'POST' },
  { path: '/api/layers/preset/*',                  module: 'preset-api', method: 'DELETE' },
];

function loadJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); }
  catch (e) { console.error(`Ошибка чтения ${path}: ${e.message}`); return fallback; }
}

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function log(m) { console.log(`[preset-registrar] ${m}`); }

function main() {
  log('Старт');

  // modules.json
  let modules = loadJSON(MODULES_FILE, []);
  if (!Array.isArray(modules)) modules = modules.modules || [];
  const ids = new Set(modules.map(m => m.id).filter(Boolean));
  if (ids.has(NEW_MODULE.id)) {
    log(`modules.json: ${NEW_MODULE.id} уже зарегистрирован`);
  } else {
    modules.push(NEW_MODULE);
    saveJSON(MODULES_FILE, modules);
    log(`modules.json: добавлен ${NEW_MODULE.id}, всего ${modules.length}`);
  }

  // routes-api.json
  let routesData = loadJSON(ROUTES_FILE, { routes: [] });
  let routes = Array.isArray(routesData) ? routesData : (routesData.routes || []);
  const routeKeys = new Set(routes.map(r => `${r.path}|${r.method || 'GET'}`));
  let added = 0;
  for (const r of NEW_ROUTES) {
    const key = `${r.path}|${r.method}`;
    if (routeKeys.has(key)) continue;
    routes.push(r);
    routeKeys.add(key);
    added++;
  }
  if (Array.isArray(routesData)) saveJSON(ROUTES_FILE, routes);
  else { routesData.routes = routes; saveJSON(ROUTES_FILE, routesData); }
  log(`routes-api.json: добавлено ${added} маршрутов, всего ${routes.length}`);

  log('ГОТОВО');
}

main();
