#!/usr/bin/env node
// scripts/split-book-parts.mjs
// Нарезает каждый том из docs/book-parts/part-N-*.txt на куски по ~40 KB,
// НЕ разрезая отдельные файлы внутри тома (границы — по маркеру FILE:).
// Результат: docs/book-parts/chunks/part-N-XX.txt

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PARTS_DIR = join(ROOT, 'docs', 'book-parts');
const CHUNKS_DIR = join(PARTS_DIR, 'chunks');
const TARGET_BYTES = 40 * 1024; // ~40 KB на кусок

function splitIntoFiles(text) {
  // Разбивает текст тома на блоки по маркеру "FILE: ..."
  // Возвращает массив блоков (включая шапку тома как отдельный блок).
  const marker = /^FILE: /m;
  const lines = text.split('\n');
  const blocks = [];
  let current = [];
  let inFile = false;

  for (const line of lines) {
    if (/^FILE: /.test(line)) {
      if (current.length > 0) blocks.push(current.join('\n'));
      current = [line];
      inFile = true;
    } else if (/^={72}$/.test(line) && !inFile) {
      // Разделитель до первого файла — часть шапки тома
      current.push(line);
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'));
  return blocks.filter(b => b.trim().length > 0);
}

function packBlocks(blocks) {
  // Пакует блоки в куски, не превышающие TARGET_BYTES.
  // Если отдельный блок больше TARGET_BYTES — кладём его отдельным куском (не режем внутри файла).
  const chunks = [];
  let current = [];
  let currentBytes = 0;

  for (const block of blocks) {
    const blockBytes = Buffer.byteLength(block, 'utf8');
    if (currentBytes + blockBytes > TARGET_BYTES && current.length > 0) {
      chunks.push(current.join('\n\n'));
      current = [];
      currentBytes = 0;
    }
    current.push(block);
    currentBytes += blockBytes;
  }
  if (current.length > 0) chunks.push(current.join('\n\n'));
  return chunks;
}

function processPart(partPath) {
  const text = readFileSync(partPath, 'utf8');
  const partName = basename(partPath, '.txt');
  const blocks = splitIntoFiles(text);
  const chunks = packBlocks(blocks);

  const written = [];
  chunks.forEach((chunkText, i) => {
    const idx = String(i + 1).padStart(2, '0');
    const outName = `${partName}-${idx}.txt`;
    const outPath = join(CHUNKS_DIR, outName);
    const header = `===== ЧАСТЬ ${partName} · КУСОК ${idx}/${String(chunks.length).padStart(2, '0')} · ${(Buffer.byteLength(chunkText, 'utf8') / 1024).toFixed(1)} KB =====\n\n`;
    writeFileSync(outPath, header + chunkText + '\n', 'utf8');
    written.push({ outName, sizeKB: ((Buffer.byteLength(chunkText, 'utf8') + header.length) / 1024).toFixed(1), filesInChunk: (chunkText.match(/^FILE: /gm) || []).length });
  });

  return { partName, totalChunks: chunks.length, written };
}

function main() {
  if (!existsSync(CHUNKS_DIR)) mkdirSync(CHUNKS_DIR, { recursive: true });

  console.log('CRUCIX · split-book-parts');
  console.log(`PARTS:  ${PARTS_DIR}`);
  console.log(`CHUNKS: ${CHUNKS_DIR}`);
  console.log(`TARGET: ~${TARGET_BYTES / 1024} KB на кусок`);
  console.log('');

  const files = readdirSync(PARTS_DIR).filter(f => f.endsWith('.txt') && f.startsWith('part-'));
  const allWritten = [];

  for (const f of files.sort()) {
    const partPath = join(PARTS_DIR, f);
    const result = processPart(partPath);
    console.log(`=== ${result.partName}: ${result.totalChunks} кусков ===`);
    for (const w of result.written) {
      console.log(`   ${w.outName}  —  ${w.sizeKB} KB  (${w.filesInChunk} файлов)`);
      allWritten.push(w.outName);
    }
    console.log('');
  }

  console.log('ИТОГО:');
  console.log(`  Всего кусков: ${allWritten.length}`);
  console.log(`  Папка: ${CHUNKS_DIR}`);
  console.log('');
  console.log('ГОТОВО. Присылайте куски по одному, начиная с part-1-foundation-01.txt.');
}

main();
