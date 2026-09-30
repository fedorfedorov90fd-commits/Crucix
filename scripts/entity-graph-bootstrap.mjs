#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX ENTITY GRAPH BOOTSTRAP
//  Загружает корзину в граф сущностей и сохраняет в data/persist/.
//  Запуск: node scripts/entity-graph-bootstrap.mjs
// ═══════════════════════════════════════════════════════════════

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, mkdirSync } from 'node:fs';
import { EntityGraph } from '../core/entity-graph-engine.mjs';
import { EntityModelEngine } from '../core/entity-model-engine.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET = join(ROOT, 'data', 'basket');
const PERSIST = join(ROOT, 'data', 'persist');
const PERSIST_FILE = join(PERSIST, 'entity-graph.json');

function log(m) { console.log(`[bootstrap] ${m}`); }

async function main() {
  log('Старт');
  if (!existsSync(BASKET)) { log(`Корзина не найдена: ${BASKET}`); process.exit(0); }
  if (!existsSync(PERSIST)) mkdirSync(PERSIST, { recursive: true });

  const graph = new EntityGraph({ persistFile: PERSIST_FILE });
  log(`Загружено узлов: ${graph.nodes.size}`);

  const model = new EntityModelEngine(graph);
  log('Движок моделей готов');

  const imported = graph.autoImportFromBasket(BASKET);
  log(`Импортировано из корзины: ${imported} узлов`);

  graph.save(PERSIST_FILE);
  log(`Сохранено: ${PERSIST_FILE}`);
  log(`Итог: ${graph.nodes.size} узлов, ${graph.edges.size} рёбер`);
  log(`Модели: ${model.getStats().schemas} схем`);
}

main().catch(e => { log(`Ошибка: ${e.message}`); process.exit(1); });
