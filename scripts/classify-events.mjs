#!/usr/bin/env node
// Классифицирует события из basket в одну из категорий Crucix
// Использование: node classify-events.mjs [basket-file.json]

import { readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { classify, health, MODELS } from './lib/ollama-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRUCIX_ROOT = join(__dirname, '..');
const BASKET_DIR = join(CRUCIX_ROOT, 'data/basket');

const CATEGORIES = [
  'economics', 'finance', 'military', 'geopolitical',
  'ecological', 'cyber', 'space', 'news',
  'esg', 'threats', 'health', 'energy', 'transport', 'other',
];

async function main() {
  const inputFile = process.argv[2];
  if (!inputFile) {
    console.error('Использование: node classify-events.mjs <file.json>');
    process.exit(1);
  }

  // 1. Проверяем Ollama
  const h = await health();
  if (!h.ok) {
    console.error('❌ Ollama недоступна:', h.error);
    console.error('   Запусти: sudo systemctl start ollama');
    process.exit(1);
  }
  console.log('✅ Ollama OK, модели:', h.models.join(', '));

  // 2. Читаем данные
  const fullPath = inputFile.startsWith('/') ? inputFile : join(BASKET_DIR, inputFile);
  console.log('📂 Читаю:', fullPath);
  const raw = JSON.parse(await readFile(fullPath, 'utf-8'));

  // Универсальное извлечение массива событий (crucix.basket.v1 + legacy)
  let events;
  if (Array.isArray(raw)) {
    events = raw;
    console.log(`📦 Legacy-формат: массив, ${events.length} элементов`);
  } else if (raw && raw.schema === 'crucix.basket.v1') {
    events = raw.documents || [];
    if (!events.length) {
      console.error('❌ crucix.basket.v1 без documents. Ключи:', Object.keys(raw));
      process.exit(1);
    }
    console.log(`📦 Контракт crucix.basket.v1, documents: ${events.length}`);
  } else if (raw && typeof raw === 'object') {
    const key = ['features', 'records', 'items', 'data', 'rows', 'results'].find(k => Array.isArray(raw[k]));
    if (key) { events = raw[key]; console.log(`📦 Fallback ключ "${key}": ${events.length}`); }
    else { console.error('❌ Не найден массив событий. Ключи:', Object.keys(raw)); process.exit(1); }
  } else {
    console.error('❌ Неподдерживаемый формат'); process.exit(1);
  }

  // Лимит для быстрого теста (--limit=N)
  const limitArg = process.argv.find(a => a.startsWith('--limit='));
  if (limitArg) {
    const lim = parseInt(limitArg.split('=')[1], 10);
    if (lim > 0) { events = events.slice(0, lim); console.log(`✂️  Ограничено до ${lim}`); }
  }

  console.log(`📊 Событий: ${events.length}`);

  // 3. Классифицируем каждое
  const enriched = [];
  let processed = 0;
  for (const ev of events) {
    const text = ev.text || ev.title || ev.label || ev.description || ev.summary || JSON.stringify(ev);
    try {
      const result = await classify({ text, categories: CATEGORIES, model: MODELS.fast });
      enriched.push({ ...ev, ai_category: result.category, ai_confidence: result.confidence, ai_reason: result.reason });
      processed++;
      if (processed % 10 === 0) {
        console.log(`   [${processed}/${events.length}] обработано...`);
      }
    } catch (e) {
      console.warn(`   ⚠️  Ошибка на событии #${processed}: ${e.message}`);
      enriched.push({ ...ev, ai_category: 'other', ai_confidence: 0, ai_error: e.message });
    }
  }

  // 4. Сохраняем
  const outPath = fullPath.replace(/\.json$/, '.classified.json');
  await writeFile(outPath, JSON.stringify(enriched, null, 2), 'utf-8');
  console.log(`✅ Готово. Записано: ${outPath}`);

  // 5. Статистика
  const stats = {};
  for (const e of enriched) {
    stats[e.ai_category] = (stats[e.ai_category] || 0) + 1;
  }
  console.log('\n📈 Распределение категорий:');
  for (const [cat, n] of Object.entries(stats).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat.padEnd(15)} ${n}`);
  }
}

main().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });
