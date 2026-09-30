#!/usr/bin/env node
// rename-crucix.mjs
// Уничтожение слова crucix в песочнице /home/ta8/Документы.
// Две операции:
//   1. Переименование файлов, содержащих crucix/Crucix/CRUCIX в имени -> crucix/Crucix/CRUCIX.
//   2. Замена всех вхождений crucix/Crucix/CRUCIX внутри текстовых файлов -> crucix/Crucix/CRUCIX.
// Запуск:
//   node scripts/rename-crucix.mjs           -- режим просмотра (dry-run), ничего не меняет
//   node scripts/rename-crucix.mjs --apply   -- реальная замена
// Все переименования и замены логируются в scripts/rename-crucix.log

import { readdir, readFile, writeFile, rename, stat, mkdir } from 'node:fs/promises';
import { join, relative, extname, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const LOG_FILE = join(__dirname, 'rename-crucix.log');

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

const logLines = [];
function log(line) {
  logLines.push(line);
  console.log(line);
}

// Замена в строке: сохраняем регистр.
// crucix -> crucix, Crucix -> Crucix, CRUCIX -> CRUCIX, Crucix_ -> Crucix_, и т. д.
function replaceCrucixInString(s) {
  let result = '';
  let i = 0;
  const lower = s.toLowerCase();
  while (i < s.length) {
    const chunk = lower.slice(i, i + 5);
    if (chunk === 'crucix') {
      const original = s.slice(i, i + 5);
      let replacement;
      if (original === 'crucix') replacement = 'crucix';
      else if (original === 'Crucix') replacement = 'Crucix';
      else if (original === 'CRUCIX') replacement = 'CRUCIX';
      else {
        // смешанный регистр — приводим к титульному
        replacement = 'Crucix';
      }
      result += replacement;
      i += 5;
    } else {
      result += s[i];
      i += 1;
    }
  }
  // Кириллический вариант "круцикс" -> "круцикс"
  result = result.replace(/круцикс/gi, (m) => {
    if (m === 'круцикс') return 'круцикс';
    if (m === 'Круцикс') return 'Круцикс';
    if (m === 'КРУЦИКС') return 'КРУЦИКС';
    return 'Круцикс';
  });
  return result;
}

function fileHasCrucix(name) {
  return /crucix/i.test(name);
}

function renameFile(name) {
  return replaceCrucixInString(name);
}

async function walk(dir, files = [], dirs = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch (e) {
    return { files, dirs };
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      dirs.push(full);
      await walk(full, files, dirs);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return { files, dirs };
}

async function processFiles(files) {
  let renamedCount = 0;
  let contentChangedCount = 0;
  let totalReplacements = 0;

  // Шаг 1: переименование файлов.
  // Сортируем по убыванию длины пути, чтобы не сломать вложенные.
  const toRename = files
    .filter((f) => fileHasCrucix(basename(f)))
    .sort((a, b) => b.length - a.length);

  for (const oldPath of toRename) {
    const dir = dirname(oldPath);
    const oldName = basename(oldPath);
    const newName = renameFile(oldName);
    const newPath = join(dir, newName);
    if (oldPath === newPath) continue;

    if (APPLY) {
      try {
        await rename(oldPath, newPath);
      } catch (e) {
        log(`RENAME FAIL ${relative(ROOT, oldPath)} -> ${newName}: ${e.message}`);
        continue;
      }
    }
    log(`RENAME ${APPLY ? 'OK' : 'DRY'} ${relative(ROOT, oldPath)} -> ${newName}`);
    renamedCount += 1;
  }

  // Шаг 2: замена содержимого.
  // После переименования список файлов меняется — обходим заново.
  const { files: filesAfter } = await walk(ROOT);

  for (const file of filesAfter) {
    const ext = extname(file).toLowerCase();
    if (BINARY_EXTS.has(ext)) continue;
    if (!TEXT_EXTS.has(ext) && ext !== '') continue;

    let content;
    try {
      content = await readFile(file, 'utf-8');
    } catch (e) {
      continue;
    }
    if (!/crucix/i.test(content) && !/круцикс/i.test(content)) continue;

    const replaced = replaceCrucixInString(content);
    if (replaced === content) continue;

    // Считаем число замен
    const matches = content.match(/crucix/gi);
    const cyrMatches = content.match(/круцикс/gi);
    const count = (matches ? matches.length : 0) + (cyrMatches ? cyrMatches.length : 0);
    totalReplacements += count;

    if (APPLY) {
      try {
        await writeFile(file, replaced, 'utf-8');
      } catch (e) {
        log(`WRITE FAIL ${relative(ROOT, file)}: ${e.message}`);
        continue;
      }
    }
    log(`REPLACE ${APPLY ? 'OK' : 'DRY'} ${relative(ROOT, file)} (${count} вхождений)`);
    contentChangedCount += 1;
  }

  return { renamedCount, contentChangedCount, totalReplacements };
}

async function main() {
  log('=================================================');
  log(`rename-crucix.mjs ${APPLY ? '[APPLY — реальная замена]' : '[DRY-RUN — только показать, ничего не менять]'}`);
  log(`ROOT: ${ROOT}`);
  log('=================================================');

  const { files } = await walk(ROOT);
  log(`Всего файлов для обхода: ${files.length}`);
  log('');

  const stats = await processFiles(files);

  log('');
  log('=================================================');
  log(`Переименовано файлов:       ${stats.renamedCount}`);
  log(`Файлов с заменой содержимого: ${stats.contentChangedCount}`);
  log(`Всего замен слова crucix:    ${stats.totalReplacements}`);
  log('=================================================');

  if (!APPLY) {
    log('');
    log('Это был DRY-RUN. Ничего не изменено.');
    log('Для реальной замены: node scripts/rename-crucix.mjs --apply');
  }

  // Лог в файл
  await mkdir(dirname(LOG_FILE), { recursive: true });
  await writeFile(LOG_FILE, logLines.join('\n') + '\n', 'utf-8');
  console.log(`Лог: ${LOG_FILE}`);
}

main().catch((e) => {
  console.error('CRASH:', e);
  process.exit(1);
});
