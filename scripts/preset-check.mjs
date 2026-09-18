#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  CRUCIX PRESET CHECK
//  Диагностика: состояние пресетов, движка, API.
//  Запуск: node scripts/preset-check.mjs
// ═══════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PRESETS_FILE = join(ROOT, 'data', 'persist', 'presets', 'presets.json');

function log(m) { console.log(m); }

async function main() {
  log('=== CRUCIX PRESET CHECK ===');
  log(`Дата: ${new Date().toISOString()}`);

  // 1. Файл пресетов
  log('\n1. Файл data/persist/presets/presets.json');
  if (!existsSync(PRESETS_FILE)) {
    log('  MISSING');
  } else {
    try {
      const list = JSON.parse(readFileSync(PRESETS_FILE, 'utf-8'));
      log(`  OK  ${list.length} пресетов:`);
      for (const p of list) {
        log(`    - ${p.icon || '★'} ${p.name} (id=${p.id}, слоёв ${(p.layers||[]).length}, модулей ${(p.modules||[]).length})`);
      }
    } catch (e) {
      log(`  ERROR: ${e.message}`);
    }
  }

  // 2. Модуль preset-engine
  log('\n2. core/preset-engine.mjs');
  try {
    const { PresetEngine } = await import('../core/preset-engine.mjs');
    const engine = new PresetEngine(join(ROOT, 'data', 'persist', 'presets'));
    const st = engine.getStats();
    log(`  OK  total=${st.total} builtin=${st.builtin} custom=${st.custom} themes=${st.themes}`);
    log(`      слои: ${st.totalLayers}, модули: ${st.totalModules}, панели: ${st.totalPanels}`);
  } catch (e) {
    log(`  ERROR: ${e.message}`);
  }

  // 3. API-модуль preset-api
  log('\n3. apis/sources/preset-api.mjs');
  try {
    const mod = await import('../apis/sources/preset-api.mjs');
    log(`  OK  route="${mod.route}" default=${typeof mod.default}`);
  } catch (e) {
    log(`  ERROR: ${e.message}`);
  }

  // 4. Проверка сервера
  log('\n4. Сервер на порту 3117');
  try {
    const r = await fetch('http://127.0.0.1:3117/api/layers/preset/list', { signal: AbortSignal.timeout(3000) });
    if (r.ok) {
      const data = await r.json();
      log(`  OK  HTTP ${r.status}, пресетов: ${data.total}`);
    } else {
      log(`  HTTP ${r.status}`);
    }
  } catch (e) {
    log(`  недоступен: ${e.message}`);
  }

  log('\n=== ГОТОВО ===');
}

main().catch(e => { log(`Fatal: ${e.message}`); process.exit(1); });
