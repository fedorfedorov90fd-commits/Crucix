#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX REGISTRY TRIGGER
//  Проверка: все API-модули из партии зарегистрированы в modules.json
//  и routes-api.json. Ничего не пишет — только отчёт.
//  Запуск: node scripts/registry-trigger.mjs
// ═══════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const MODULES = [
  'entity-graph-api',
  'preset-api',
  'ofac-sdn-api',
  'country-instability-api',
  'resilience-index-api',
];

const ROUTES = [
  { path: '/api/layers/entity-graph',        module: 'entity-graph-api' },
  { path: '/api/layers/entity-graph/*',      module: 'entity-graph-api' },
  { path: '/api/layers/preset',              module: 'preset-api' },
  { path: '/api/layers/preset/*',            module: 'preset-api' },
  { path: '/api/layers/ofac-sdn',            module: 'ofac-sdn-api' },
  { path: '/api/layers/ofac-sdn/*',          module: 'ofac-sdn-api' },
  { path: '/api/layers/country-instability', module: 'country-instability-api' },
  { path: '/api/layers/country-instability/*', module: 'country-instability-api' },
  { path: '/api/layers/resilience-index',    module: 'resilience-index-api' },
  { path: '/api/layers/resilience-index/*',  module: 'resilience-index-api' },
];

function loadJSON(p, fallback) {
  if (!existsSync(p)) return fallback;
  try { return JSON.parse(readFileSync(p, 'utf-8')); } catch { return fallback; }
}

function main() {
  const modulesFile = join(ROOT, 'server', 'modules.json');
  const routesFile = join(ROOT, 'server', 'routes-api.json');

  let modules = loadJSON(modulesFile, []);
  if (!Array.isArray(modules)) modules = modules.modules || [];

  let routes = loadJSON(routesFile, { routes: [] });
  if (!Array.isArray(routes)) routes = routes.routes || [];

  const moduleIds = new Set(modules.map(m => m.id));
  const routeKeys = new Set(routes.map(r => `${r.path}|${r.method || 'GET'}`));

  let missingModules = 0, missingRoutes = 0;

  console.log('=== МОДУЛИ ===');
  for (const m of MODULES) {
    if (moduleIds.has(m)) console.log(`  OK  ${m}`);
    else { console.log(`  MISS ${m}`); missingModules++; }
  }

  console.log('=== МАРШРУТЫ ===');
  for (const r of ROUTES) {
    const key = `${r.path}|GET`;
    if (routeKeys.has(key)) console.log(`  OK  ${r.path} → ${r.module}`);
    else { console.log(`  MISS ${r.path} → ${r.module}`); missingRoutes++; }
  }

  console.log(`\nИтог: модулей отсутствует ${missingModules}, маршрутов отсутствует ${missingRoutes}`);
  console.log(`Всего: modules ${modules.length}, routes ${routes.length}`);
  console.log('ГОТОВО');
}

main();
