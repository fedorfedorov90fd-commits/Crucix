#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX MULTIMAP MODULES REGISTRAR v1.0.0
//  Добавляет записи multimap-модулей в modules.json и routes-api.json.
//  Ничего не удаляет. Только добавляет недостающие.
//  Правило 13.5: правка JSON через JSON.parse/stringify.
// ═══════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MODULES_FILE = join(ROOT, 'server', 'modules.json');
const ROUTES_FILE = join(ROOT, 'server', 'routes-api.json');

const NEW_MODULES = [
  { id: 'entity-graph-api', path: './apis/sources/entity-graph-api' },
  { id: 'preset-api',       path: './apis/sources/preset-api' },
  { id: 'ofac-sdn-api',     path: './apis/sources/ofac-sdn-api' },
  { id: 'country-instability-api', path: './apis/sources/country-instability-api' },
  { id: 'resilience-index-api',    path: './apis/sources/resilience-index-api' },
];

const NEW_ROUTES = [
  { path: '/api/layers/entity-graph',         module: 'entity-graph-api',         method: 'GET' },
  { path: '/api/layers/entity-graph/*',       module: 'entity-graph-api',         method: 'GET' },
  { path: '/api/layers/preset',               module: 'preset-api',               method: 'GET' },
  { path: '/api/layers/preset/*',             module: 'preset-api',               method: 'GET' },
  { path: '/api/layers/ofac-sdn',             module: 'ofac-sdn-api',             method: 'GET' },
  { path: '/api/layers/ofac-sdn/*',           module: 'ofac-sdn-api',             method: 'GET' },
  { path: '/api/layers/country-instability',  module: 'country-instability-api',  method: 'GET' },
  { path: '/api/layers/country-instability/*',module: 'country-instability-api',  method: 'GET' },
  { path: '/api/layers/resilience-index',     module: 'resilience-index-api',     method: 'GET' },
  { path: '/api/layers/resilience-index/*',   module: 'resilience-index-api',     method: 'GET' },
];

function loadJSON(path, fallback) {
  if (!existsSync(path)) return fallback;
  try { return JSON.parse(readFileSync(path, 'utf-8')); } catch (e) { console.error(`Ошибка чтения ${path}: ${e.message}`); return fallback; }
}

function saveJSON(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
}

function main() {
  console.log('[registrar] Старт');

  // modules.json
  let modules = loadJSON(MODULES_FILE, []);
  if (!Array.isArray(modules)) modules = modules.modules || [];
  const existingModuleIds = new Set(modules.map(m => m.id).filter(Boolean));
  let addedModules = 0;
  for (const m of NEW_MODULES) {
    if (existingModuleIds.has(m.id)) continue;
    modules.push(m);
    addedModules++;
  }
  saveJSON(MODULES_FILE, modules);
  console.log(`[registrar] modules.json: добавлено ${addedModules}, всего ${modules.length}`);

  // routes-api.json
  let routesData = loadJSON(ROUTES_FILE, { routes: [] });
  let routes = Array.isArray(routesData) ? routesData : (routesData.routes || []);
  const existingPaths = new Set(routes.map(r => `${r.path}|${r.method || 'GET'}`));
  let addedRoutes = 0;
  for (const r of NEW_ROUTES) {
    const key = `${r.path}|${r.method}`;
    if (existingPaths.has(key)) continue;
    routes.push(r);
    existingPaths.add(key);
    addedRoutes++;
  }
  if (Array.isArray(routesData)) saveJSON(ROUTES_FILE, routes);
  else { routesData.routes = routes; saveJSON(ROUTES_FILE, routesData); }
  console.log(`[registrar] routes-api.json: добавлено ${addedRoutes}, всего ${routes.length}`);

  console.log('[registrar] ГОТОВО');
}

main();
