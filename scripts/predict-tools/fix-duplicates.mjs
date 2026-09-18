#!/usr/bin/env node
// fix-duplicates.mjs — единый скрипт чистки дублей Crucix.
// Синтез из fix-duplicates.mjs и fix-role-duplication.mjs.
//
// Три операции:
//   1. Замена "Crucix Crucix" → "Crucix <role>" (роль по detectRole).
//   2. Схлопывание "Crucix Dashboard Dashboard" → "Crucix Dashboard"
//      для всех ролей из ROLES.
//   3. Обработка 8 разделителей: " · ", "-", "_", ".", "/", ":", пробел,
//      без разделителя.
//
// Роли определяются по пути файла:
//   dashboard/            → Dashboard
//   docker/, k8s/         → Core
//   README_*, docs/       → Handbook
//   .github/workflows/    → CI
//   observability/        → Monitor
//   apis/predict/*engine* → Engine
//   integrations/         → Integrations
//   scripts/              → Core
//   всё остальное         → Core
//
// Запуск:
//   node scripts/fix-duplicates.mjs           -- dry-run (по умолчанию)
//   node scripts/fix-duplicates.mjs --apply   -- реальная запись

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, relative, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const LOG_FILE = join(__dirname, 'fix-duplicates.log');
const APPLY = process.argv.includes('--apply');

const SKIP_DIRS = new Set(['.git', 'node_modules', 'backups', '.cache', 'dist', 'build']);
const TEXT_EXTS = new Set([
  '.mjs', '.js', '.cjs', '.html', '.htm', '.json', '.yml', '.yaml',
  '.md', '.sh', '.txt', '.css', '.wat', '.svg', '.xml', '.env',
]);
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
  '.woff', '.woff2', '.ttf', '.eot', '.otf', '.wasm', '.zip', '.tar', '.gz',
]);

const ROLES = ['Dashboard', 'Core', 'Handbook', 'Monitor', 'CI', 'Integrations', 'Engine'];

// ============================================================
// Определение роли по относительному пути файла
// ============================================================

function detectRole(relPath) {
  const p = relPath.replace(/\\/g, '/');
  if (p.startsWith('dashboard/')) return 'Dashboard';
  if (p.startsWith('.github/workflows/')) return 'CI';
  if (p.startsWith('docs/')) return 'Handbook';
  if (/^README_/i.test(basename(p))) return 'Handbook';
  if (p.startsWith('observability/')) return 'Monitor';
  if (p.startsWith('integrations/')) return 'Integrations';
  if (p.startsWith('docker/') || p.startsWith('k8s/')) return 'Core';
  if (p.startsWith('scripts/')) return 'Core';
  if (p.startsWith('apis/predict/') && /engine/i.test(basename(p))) return 'Engine';
  return 'Core';
}

function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }
function upperAll(s) { return s.toUpperCase(); }

// ============================================================
// ФАЗА 1: Crucix Crucix → Crucix <role>
// ============================================================

function buildPhase1Rules(role) {
  const r = role;
  const rl = lowerFirst(role);
  const ru = upperAll(role);
  return [
    [new RegExp(`Crucix\\s*·\\s*Crucix`, 'g'), `Crucix · ${r}`],
    [new RegExp(`crucix\\s*·\\s*crucix`, 'g'), `crucix · ${rl}`],
    [/Crucix-Core/g, `Crucix-${r}`],
    [/crucix-core/g, `crucix-${rl}`],
    [/CRUCIX-CORE/g, `CRUCIX-${ru}`],
    [/Crucix_Core/g, `Crucix_${r}`],
    [/crucix_core/g, `crucix_${rl}`],
    [/CRUCIX_CORE/g, `CRUCIX_${ru}`],
    [/Crucix\.Crucix/g, `Crucix.${r}`],
    [/crucix\.crucix/g, `crucix.${rl}`],
    [/Crucix\/Crucix/g, `Crucix/${r}`],
    [/crucix\/crucix/g, `crucix/${rl}`],
    [/Crucix:Core/g, `Crucix:${r}`],
    [/crucix:core/g, `crucix:${rl}`],
    [/CrucixCore/g, `Crucix${r}`],
    [/crucixcore/g, `crucix${rl}`],
    [/CRUCIXCORE/g, `CRUCIX${ru}`],
    [/Crucix\s+Crucix/g, `Crucix ${r}`],
    [/crucix\s+crucix/g, `crucix ${rl}`],
    [/CRUCIX\s+CRUCIX/g, `CRUCIX ${ru}`],
  ];
}

// ============================================================
// ФАЗА 2: Crucix <role> <role> → Crucix <role> для всех ROLES
// ============================================================

function buildPhase2Rules() {
  const rules = [];
  for (const role of ROLES) {
    const rl = role.charAt(0).toLowerCase() + role.slice(1);
    const ru = role.toUpperCase();
    rules.push([new RegExp(`Crucix\\s*·\\s*${role}\\s+${role}`, 'g'), `Crucix · ${role}`]);
    rules.push([new RegExp(`crucix\\s*·\\s*${rl}\\s+${rl}`, 'g'), `crucix · ${rl}`]);
    rules.push([new RegExp(`Crucix\\s+${role}\\s+${role}`, 'g'), `Crucix ${role}`]);
    rules.push([new RegExp(`crucix\\s+${rl}\\s+${rl}`, 'g'), `crucix ${rl}`]);
    rules.push([new RegExp(`CRUCIX\\s+${ru}\\s+${ru}`, 'g'), `CRUCIX ${ru}`]);
    rules.push([new RegExp(`crucix-${rl}-${rl}`, 'g'), `crucix-${rl}`]);
    rules.push([new RegExp(`Crucix-${role}-${role}`, 'g'), `Crucix-${role}`]);
    rules.push([new RegExp(`crucix_${rl}_${rl}`, 'g'), `crucix_${rl}`]);
    rules.push([new RegExp(`${role}${role}`, 'g'), role]);
  }
  return rules;
}

// ============================================================
// Объединённый fixer
// ============================================================

function fixAll(text, role) {
  let result = text;
  let totalHits = 0;

  // Фаза 1
  const phase1Rules = buildPhase1Rules(role);
  for (const [pattern, replacement] of phase1Rules) {
    const matches = result.match(pattern);
    if (matches) {
      totalHits += matches.length;
      result = result.replace(pattern, replacement);
    }
  }

  // Фаза 2
  const phase2Rules = buildPhase2Rules();
  for (const [pattern, replacement] of phase2Rules) {
    const matches = result.match(pattern);
    if (matches) {
      totalHits += matches.length;
      result = result.replace(pattern, replacement);
    }
  }

  return { result, totalHits };
}

// ============================================================
// Walk
// ============================================================

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) { return files; }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) await walk(full, files);
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

// ============================================================
// Main
// ============================================================

const logLines = [];
function log(line) { logLines.push(line); console.log(line); }

async function main() {
  log('=================================================');
  log(`fix-duplicates.mjs ${APPLY ? '[APPLY]' : '[DRY-RUN]'}`);
  log(`ROOT: ${ROOT}`);
  log(`Режим: 2 фазы (замена Crucix-Crucix + схлопывание ролей)`);
  log('=================================================');
  log('');

  const files = await walk(ROOT);
  log(`Всего файлов: ${files.length}`);
  log('');

  let changedFiles = 0;
  let totalReplacements = 0;
  const roleStats = {};

  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (BINARY_EXTS.has(ext)) continue;
    if (!TEXT_EXTS.has(ext) && ext !== '') continue;

    let content;
    try {
      content = await readFile(file, 'utf-8');
    } catch (e) { continue; }

    const rel = relative(ROOT, file);
    const role = detectRole(rel);
    const { result, totalHits } = fixAll(content, role);
    if (totalHits === 0) continue;

    if (APPLY) {
      try {
        await writeFile(file, result, 'utf-8');
      } catch (e) {
        log(`WRITE FAIL ${rel}: ${e.message}`);
        continue;
      }
    }
    log(`${APPLY ? 'FIXED' : 'WOULD-FIX'} [${role}] ${rel} (${totalHits} дублей)`);
    changedFiles += 1;
    totalReplacements += totalHits;
    roleStats[role] = (roleStats[role] || 0) + totalHits;
  }

  log('');
  log('=================================================');
  log(`Файлов с дублями:       ${changedFiles}`);
  log(`Всего схлопнуто дублей: ${totalReplacements}`);
  log('Распределение по ролям:');
  for (const [role, count] of Object.entries(roleStats).sort((a, b) => b[1] - a[1])) {
    log(`  ${role.padEnd(14)} ${count}`);
  }
  log('=================================================');
  if (!APPLY) {
    log('');
    log('Это DRY-RUN. Для записи:');
    log('  node scripts/fix-duplicates.mjs --apply');
  }
  await mkdir(dirname(LOG_FILE), { recursive: true });
  await writeFile(LOG_FILE, logLines.join('\n') + '\n', 'utf-8');
  console.log(`Лог: ${LOG_FILE}`);
}

main().catch((e) => { console.error('CRASH:', e); process.exit(1); });

export {
  detectRole,
  buildPhase1Rules,
  buildPhase2Rules,
  fixAll,
  walk,
};
