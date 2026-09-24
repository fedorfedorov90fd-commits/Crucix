#!/usr/bin/env node
/**
 * scripts/maintenance/rotate-all.mjs — ротация данных Crucix (v3.0.0)
 * Создан 23.09.2026.
 *
 * ПРИНЦИП (указание хозяина 23.09.2026):
 *   - Задача: освободить винчестер от лишних данных.
 *   - НЕ удалять автоматически. Только ПЕРЕМЕЩАТЬ в archive-Crucix.
 *   - Хозяин сам смотрит в archive-Crucix и вручную удаляет.
 *   - НИКАКОГО раздувания задачи. Простая односторонняя ротация.
 *
 * ЧТО ДЕЛАЕТ:
 *   Перемещает устаревшие данные из активных папок в
 *   /home/ta8_/Рабочий стол/Crucix/archive-Crucix/<категория>/
 *
 * ПОЛИТИКИ (когда данные считаются устаревшими):
 *   data/raw/                 — старше 7 дней или сверх 500 файлов / 500 МБ
 *   data/raw/ofac-sdn-*       — старше 3 дней или сверх 3 файлов
 *   backups/                  — старше 30 дней или сверх 20 папок
 *   snapshots_full/           — старше 90 дней или сверх 3 папок
 *   runs/predictions/         — старше 30 дней или сверх 200 файлов
 *
 * ФЛАГИ:
 *   --apply      реально перемещать (по умолчанию — dry-run)
 *   --verbose    подробный вывод
 */

import { promises as fs } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const ARCHIVE_ROOT = join(ROOT, 'archive-Crucix');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');

// ============================================================
// ПОЛИТИКИ РОТАЦИИ
// ============================================================
const POLICIES = [
  {
    name: 'data/raw',
    dir: join(ROOT, 'data', 'raw'),
    archiveTo: join(ARCHIVE_ROOT, 'data-raw'),
    maxAgeDays: 7,
    maxFiles: 500,
    maxSizeMB: 500,
  },
  {
    name: 'data/raw/ofac-sdn',
    dir: join(ROOT, 'data', 'raw'),
    pattern: /^ofac-sdn-/,
    archiveTo: join(ARCHIVE_ROOT, 'ofac-sdn'),
    maxAgeDays: 3,
    maxFiles: 3,
  },
  {
    name: 'backups',
    dir: join(ROOT, 'backups'),
    archiveTo: join(ARCHIVE_ROOT, 'backups'),
    maxAgeDays: 30,
    maxItems: 20,
    skipPattern: /^archive$/,
  },
  {
    name: 'snapshots_full',
    dir: join(ROOT, 'snapshots_full'),
    archiveTo: join(ARCHIVE_ROOT, 'snapshots-full'),
    maxAgeDays: 90,
    maxItems: 3,
  },
  {
    name: 'runs/predictions',
    dir: join(ROOT, 'runs', 'predictions'),
    archiveTo: join(ARCHIVE_ROOT, 'runs-predictions'),
    maxAgeDays: 30,
    maxFiles: 200,
  },
];

// ============================================================
// УТИЛИТЫ
// ============================================================
const stats = { moved: 0, wouldMove: 0, errors: 0, byPolicy: {} };
const now = Date.now();
const dayMs = 24 * 60 * 60 * 1000;

async function ensureDir(d) {
  await fs.mkdir(d, { recursive: true });
}

async function moveOne(src, destDir) {
  const name = basename(src);
  const dest = join(destDir, name);
  if (!APPLY) {
    console.log(`  [DRY] ${src}`);
    console.log(`       → ${dest}`);
    return false;
  }
  try {
    await ensureDir(destDir);
    await fs.rename(src, dest);
    console.log(`  MOVED: ${name} → ${destDir}/`);
    return true;
  } catch (e) {
    console.error(`  ERROR: ${src}: ${e.message}`);
    stats.errors++;
    return false;
  }
}

// ============================================================
// ОСНОВНАЯ ЛОГИКА
// ============================================================
async function rotate(policy) {
  console.log('');
  console.log(`═══ ${policy.name} ═══`);

  let entries;
  try { entries = await fs.readdir(policy.dir); }
  catch (e) { console.log(`  [SKIP] папка не найдена: ${policy.dir}`); return; }

  let items = [];
  for (const name of entries) {
    if (policy.skipPattern && policy.skipPattern.test(name)) continue;
    if (policy.pattern && !policy.pattern.test(name)) continue;
    const fp = join(policy.dir, name);
    let st;
    try { st = await fs.stat(fp); } catch { continue; }
    items.push({ name, fp, mtimeMs: st.mtimeMs, size: st.size, ageDays: (now - st.mtimeMs) / dayMs });
  }
  items.sort((a, b) => b.mtimeMs - a.mtimeMs);

  const byAge = [], byCount = [], bySize = [];
  let cumulativeSize = 0;
  const keep = new Set();

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const sizeMB = it.size / (1024 * 1024);

    if (policy.maxAgeDays && it.ageDays > policy.maxAgeDays) {
      byAge.push(it);
      continue;
    }
    if ((policy.maxFiles && i >= policy.maxFiles) || (policy.maxItems && i >= policy.maxItems)) {
      byCount.push(it);
      continue;
    }
    if (policy.maxSizeMB) {
      cumulativeSize += sizeMB;
      if (cumulativeSize > policy.maxSizeMB) {
        bySize.push(it);
        continue;
      }
    }
    keep.add(it.name);
  }

  console.log(`  Всего элементов: ${items.length}`);
  console.log(`  Оставить: ${keep.size}`);
  console.log(`  Устарело по возрасту: ${byAge.length}`);
  console.log(`  Устарело по количеству: ${byCount.length}`);
  console.log(`  Устарело по размеру: ${bySize.length}`);

  const all = [...byAge, ...byCount, ...bySize];
  if (all.length === 0) {
    console.log(`  → перемещать нечего`);
    stats.byPolicy[policy.name] = { total: items.length, moved: 0 };
    return;
  }

  console.log(`  Перемещение в ${policy.archiveTo}/:`);
  for (const it of all) {
    const moved = await moveOne(it.fp, policy.archiveTo);
    if (moved) stats.moved++; else stats.wouldMove++;
  }
  stats.byPolicy[policy.name] = { total: items.length, moved: all.length };
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('╔══════════════════════════════════════════════════╗');
  console.log('║  ROTATE-ALL v3.0.0                               ║');
  console.log(`║  Режим: ${APPLY ? 'APPLY (реальное перемещение)' : 'DRY-RUN (просмотр)'.padEnd(35)}║`);
  console.log('║  Принцип: только перемещение в archive-Crucix.    ║');
  console.log('║  Удаление — вручную хозяином.                      ║');
  console.log('╚══════════════════════════════════════════════════╝');

  await ensureDir(ARCHIVE_ROOT);

  for (const p of POLICIES) {
    await rotate(p);
  }

  console.log('');
  console.log('═══ ИТОГО ═══');
  console.log(`  Перемещено: ${stats.moved}`);
  console.log(`  Будет перемещено (dry-run): ${stats.wouldMove}`);
  console.log(`  Ошибок: ${stats.errors}`);
  console.log(`  Archive: ${ARCHIVE_ROOT}`);
  console.log('');
  if (!APPLY) {
    console.log('  Это DRY-RUN. Реально переместить:');
    console.log('    node scripts/maintenance/rotate-all.mjs --apply');
  }
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1); });
