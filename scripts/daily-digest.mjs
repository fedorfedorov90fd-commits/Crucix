#!/usr/bin/env node
// Собирает все события за сутки и генерирует текстовый дайджест через LLM

import { readFile, writeFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generate, health, MODELS } from './lib/ollama-client.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CRUCIX_ROOT = join(__dirname, '..');
const BASKET_DIR = join(CRUCIX_ROOT, 'data/basket');

async function main() {
  const h = await health();
  if (!h.ok) { console.error('❌ Ollama недоступна:', h.error); process.exit(1); }

  // Собираем все json из basket за последние 24 часа
  const files = (await readdir(BASKET_DIR)).filter(f => f.endsWith('.json'));
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const recent = [];

  for (const f of files) {
    try {
      const data = JSON.parse(await readFile(join(BASKET_DIR, f), 'utf-8'));
      const arr = Array.isArray(data) ? data : [data];
      for (const item of arr) {
        const ts = item.timestamp ? new Date(item.timestamp).getTime() : 0;
        if (ts >= cutoff) recent.push({ ...item, _source: f });
      }
    } catch {}
  }

  console.log(`📊 Событий за 24ч: ${recent.length}`);
  if (recent.length === 0) { console.log('Нечего суммаризировать.'); return; }

  // Компактно упаковываем для промпта
  const digest = recent.slice(0, 200).map((r, i) =>
    `${i + 1}. [${r._source}] ${r.title || r.label || '?'}`
  ).join('\n');

  const prompt = `Ниже список событий за сутки из систем мониторинга Crucix.

${digest}

Задачи:
1. Сгруппируй события по темам (экономика, геополитика, кибербезопасность и т.д.).
2. Выдели 5 самых значимых событий.
3. Дай краткую сводку по каждому — 1-2 предложения.
4. Отметь регионы, где концентрация событий выше всего.

Формат: markdown, без воды.`;

  console.log('🤔 Генерирую дайджест (deepseek-r1:7b — может занять несколько минут)...');
  const out = await generate({ model: MODELS.heavy, prompt, timeoutMs: 900000 });

  const outPath = join(CRUCIX_ROOT, 'data/digests', `digest-${new Date().toISOString().slice(0, 10)}.md`);
  await import('fs/promises').then(fs => fs.mkdir(dirname(outPath), { recursive: true }));
  await writeFile(outPath, `# Дайджест за ${new Date().toISOString().slice(0, 10)}\n\n${out.text}`, 'utf-8');

  console.log(`✅ Записано: ${outPath}`);
  console.log(`⏱️  Сгенерировано за ${out.totalMs}ms, ${out.evalCount} токенов`);
}

main().catch(e => { console.error('💥', e); process.exit(1); });
