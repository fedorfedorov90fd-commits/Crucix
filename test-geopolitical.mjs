import module from './apis/sources/geopolitical-reports.mjs';
import fs from 'fs/promises';
import path from 'path';

console.log('=== ТЕСТ МОДУЛЯ ГЕОПОЛИТИКА ===\n');

console.log('Имя:', module.name);
console.log('Интервал:', module.fetchInterval);

console.log('\n--- Запуск сбора данных ---');
const start = Date.now();

try {
  const result = await module.fetch();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n--- Результат (${elapsed}с) ---`);
  console.log('Всего новостей:', result.features?.length || 0);

  if (result.features && result.features.length > 0) {
    console.log('\nПервые 3 новости:');
    result.features.slice(0, 3).forEach((f, i) => {
      const title = f.properties?.title || 'Без названия';
      console.log(`  ${i+1}. ${title.substring(0, 80)}${title.length > 80 ? '...' : ''}`);
    });
  }

  console.log('\n--- Проверка OPML ---');
  const feedsFile = path.join(process.cwd(), 'data', 'feeds', 'feeds.opml');
  try {
    const content = await fs.readFile(feedsFile, 'utf-8');
    const lines = content.split('\n').filter(l => l.includes('xmlUrl')).length;
    console.log(`✅ Файл OPML: ${feedsFile}`);
    console.log(`   Количество RSS-лент: ${lines}`);
  } catch (e) {
    console.log('❌ OPML-файл не найден');
  }

  console.log('\n--- Проверка "корзины" ---');
  const today = new Date().toISOString().slice(0, 10);
  const filePath = path.join(process.cwd(), 'data', 'ai_raw', 'geopolitical-reports', `${today}.json`);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    console.log(`✅ Файл существует: ${filePath}`);
    console.log(`   Всего записей: ${data.reports?.length || 0}`);
    console.log(`   Размер: ${(content.length / 1024).toFixed(1)} KB`);
  } catch (e) {
    console.log('❌ Файл не найден');
  }

} catch (error) {
  console.error('❌ Ошибка:', error.message);
  console.error(error.stack);
}

console.log('\n=== ТЕСТ ЗАВЕРШЁН ===');
