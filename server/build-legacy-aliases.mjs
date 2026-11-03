#!/usr/bin/env node
/**
 * server/build-legacy-aliases.mjs — ГЕНЕРАТОР LEGACY-АЛИАСОВ
 *
 * Читает:
 *   - server/registry.generated.json (все v2 routes)
 *   - data/basket/*.json (все basket-файлы)
 *   - server/legacy-stubs.json (34 заглушки)
 *
 * Пишет:
 *   - server/legacy-aliases.generated.json (плоский объект: '/api/<n>' -> '/api/layers/<target>')
 *   - server/legacy-aliases.report.json  (аудит: сколько v2, basket, stubs, warnings)
 *
 * Инварианты:
 *   - Ключ (oldPath) — всегда без trailing slash: '/api/<name>'.
 *   - Значение (newPath) — всегда '/api/layers/<target>' или '/api/layers/direct-basket/<name>'.
 *   - Каждая запись валидируется: target существует в registry ИЛИ basket ИЛИ stubs.
 *   - Дубликатов нет (иначе — process.exit(1)).
 *   - Никаких «битых» алиасов: если target не найден — warning + запись НЕ создаётся.
 *
 * Запуск:
 *   node server/build-legacy-aliases.mjs
 *   node server/build-legacy-aliases.mjs --strict   (warnings → errors, exit 1)
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT = join(__dirname, '..');

const REGISTRY_FILE = join(__dirname, 'registry.generated.json');
const BASKET_DIR    = join(ROOT, 'data', 'basket');
const STUBS_FILE    = join(__dirname, 'legacy-stubs.json');
const OUTPUT_FILE   = join(__dirname, 'legacy-aliases.generated.json');
const REPORT_FILE   = join(__dirname, 'legacy-aliases.report.json');

const STRICT = process.argv.includes('--strict');

// ============================================================
//  СПЕЦ-ИСКЛЮЧЕНИЯ (имя в URL ≠ имя в registry/basket)
// ============================================================
const SPECIAL_TARGETS = {
  // 'mcp' в URL → модуль mcp-server-api
  'mcp': 'mcp-server',
  // 'daily-briefing' в URL → модуль daily-briefing-api (если/когда появится)
  'daily-briefing': 'daily-briefing',
};

// ============================================================
//  1. Читаем registry
// ============================================================
async function readRegistry() {
  const raw = await fs.readFile(REGISTRY_FILE, 'utf8');
  const data = JSON.parse(raw);
  return data.routes || {};
}

function extractV2Names(routes) {
  const names = new Set();
  const re = /^\/api\/layers\/([a-z0-9_-]+)$/;
  for (const path of Object.keys(routes)) {
    const m = path.match(re);
    if (m) names.add(m[1]);
  }
  return names;
}

// ============================================================
//  2. Читаем basket
// ============================================================
async function readBasketNames() {
  const entries = await fs.readdir(BASKET_DIR);
  return new Set(
    entries
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''))
      .filter(name => /^[a-z0-9_-]+$/.test(name))  // только безопасные имена (без точек)
  );
}

// ============================================================
//  3. Читаем stubs
// ============================================================
async function readStubs() {
  const raw = await fs.readFile(STUBS_FILE, 'utf8');
  const data = JSON.parse(raw);
  return new Set(data.stubs || []);
}

// ============================================================
//  4. Строим алиасы
// ============================================================
function buildAliases({ v2Names, basketNames, stubs }) {
  const aliases = {};
  const report = {
    total: 0,
    by_group: { v2: 0, basket: 0, stubs: 0, special: 0 },
    warnings: [],
    errors: [],
  };

  // Группа 1: v2 (registry) — прямой redirect
  for (const name of [...v2Names].sort()) {
    const target = SPECIAL_TARGETS[name] || name;
    aliases[`/api/${name}`] = `/api/layers/${target}`;
    report.by_group.v2++;
    if (target !== name) report.by_group.special++;
  }

  // Группа 2: basket без v2 — direct-basket
  for (const name of [...basketNames].sort()) {
    if (v2Names.has(name)) continue; // уже v2
    const key = `/api/${name}`;
    if (aliases[key]) {
      report.warnings.push(`duplicate_key: ${key} (basket overrides v2)`);
    }
    aliases[key] = `/api/layers/direct-basket/${name}`;
    report.by_group.basket++;
  }

  // Группа 3: stubs (нет ни v2, ни basket) — direct-basket, вернёт not_found
  for (const name of [...stubs].sort()) {
    if (v2Names.has(name) || basketNames.has(name)) {
      report.warnings.push(`stub_is_redundant: ${name} уже есть в v2 или basket`);
      continue; // не перезаписываем реальные
    }
    const key = `/api/${name}`;
    if (aliases[key]) {
      report.errors.push(`stub_collision: ${key}`);
      continue;
    }
    aliases[key] = `/api/layers/direct-basket/${name}`;
    report.by_group.stubs++;
  }

  report.total = Object.keys(aliases).length;
  return { aliases, report };
}

// ============================================================
//  5. Пишем
// ============================================================
async function main() {
  console.log('=== BUILD LEGACY-ALIASES ===\n');

  const routes = await readRegistry();
  const v2Names = extractV2Names(routes);
  const basketNames = await readBasketNames();
  const stubs = await readStubs();

  console.log(`registry routes:      ${Object.keys(routes).length}`);
  console.log(`v2 top-level:         ${v2Names.size}`);
  console.log(`basket files:         ${basketNames.size}`);
  console.log(`stubs (whitelist):    ${stubs.size}`);
  console.log('');

  const { aliases, report } = buildAliases({ v2Names, basketNames, stubs });

  // Валидация: каждый target существует
  for (const [oldPath, newPath] of Object.entries(aliases)) {
    let ok = false;
    // /api/layers/<name>
    const m1 = newPath.match(/^\/api\/layers\/([a-z0-9_-]+)$/);
    if (m1) {
      ok = v2Names.has(m1[1]);
      if (!ok) report.errors.push(`target_not_in_v2: ${oldPath} -> ${newPath}`);
    }
    // /api/layers/direct-basket/<name>
    const m2 = newPath.match(/^\/api\/layers\/direct-basket\/([a-z0-9_-]+)$/);
    if (m2) {
      const name = m2[1];
      ok = basketNames.has(name) || stubs.has(name);
      if (!ok) report.errors.push(`target_not_in_basket_or_stubs: ${oldPath} -> ${newPath}`);
    }
    if (!m1 && !m2) report.errors.push(`target_malformed: ${oldPath} -> ${newPath}`);
  }

  console.log('Группы:');
  console.log(`  v2:      ${report.by_group.v2}`);
  console.log(`  special: ${report.by_group.special}`);
  console.log(`  basket:  ${report.by_group.basket}`);
  console.log(`  stubs:   ${report.by_group.stubs}`);
  console.log(`  TOTAL:   ${report.total}`);
  console.log('');

  if (report.warnings.length) {
    console.log(`Warnings (${report.warnings.length}):`);
    for (const w of report.warnings.slice(0, 30)) console.log(`  - ${w}`);
    if (report.warnings.length > 30) console.log(`  ... +${report.warnings.length - 30}`);
    console.log('');
  }

  if (report.errors.length) {
    console.log(`ERRORS (${report.errors.length}):`);
    for (const e of report.errors.slice(0, 30)) console.log(`  ❌ ${e}`);
    if (report.errors.length > 30) console.log(`  ... +${report.errors.length - 30}`);
    if (STRICT) {
      await fs.writeFile(REPORT_FILE, JSON.stringify(report, null, 2));
      console.error('\n❌ --strict: exit 1 (errors)');
      process.exit(1);
    }
  }

  // Сортируем ключи для детерминизма
  const sorted = {};
  for (const k of Object.keys(aliases).sort()) sorted[k] = aliases[k];

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(sorted, null, 2) + '\n');
  await fs.writeFile(REPORT_FILE, JSON.stringify({ ...report, generated_at: new Date().toISOString() }, null, 2));

  console.log(`✅ Записано: ${OUTPUT_FILE}`);
  console.log(`✅ Отчёт:    ${REPORT_FILE}`);

  if (STRICT && (report.errors.length || report.warnings.length)) {
    console.error('\n❌ --strict: exit 1 (errors or warnings)');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('FATAL:', e);
  process.exit(1);
});
