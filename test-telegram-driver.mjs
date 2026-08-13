#!/usr/bin/env node

import { TelegramDriver } from './apis/sources/drivers/telegram-driver.mjs';

async function testTelegram() {
  console.log('='.repeat(60));
  console.log('  ТЕСТ ДРАЙВЕРА TELEGRAM');
  console.log('='.repeat(60));

  const driver = new TelegramDriver();

  console.log('\n📋 Информация о драйвере:');
  console.log(`  - Имя: ${driver.getDriverName()}`);
  console.log(`  - Каналы: ${driver.channels.join(', ') || 'не указаны'}`);

  console.log('\n🔍 Проверка доступности Telegram...');
  const status = await driver.checkAvailability();
  console.log(`  - Доступен: ${status.available ? '✅ да' : '❌ нет'}`);
  console.log(`  - Оценка: ${status.score}`);
  if (status.available) {
    console.log('  - Задержка: ~' + (status.latency || 0) + 'ms');
  } else {
    console.log(`  - Ошибка: ${driver.lastError || 'неизвестна'}`);
  }

  if (status.available) {
    console.log('\n📥 Получение данных...');
    try {
      const data = await driver.fetch({ limit: 10 });
      console.log(`  - Всего записей: ${data.total}`);
      console.log(`  - Источник: ${data.source}`);
      console.log(`  - Время: ${data.fetchedAt}`);

      if (data.items && data.items.length > 0) {
        console.log('\n📰 Первые 3 записи:');
        data.items.slice(0, 3).forEach((item, i) => {
          console.log(`  ${i+1}. ${item.title?.slice(0, 60) || 'Без заголовка'}...`);
          console.log(`     📅 ${item.date}`);
          console.log(`     📂 ${item.category || 'general'}`);
          console.log(`     📍 ${item.sourceId}`);
        });
      } else {
        console.log('  ⚠️ Нет данных');
      }
    } catch (error) {
      console.error(`❌ Ошибка при получении данных: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('  🏁 ТЕСТ ЗАВЕРШЁН');
  console.log('='.repeat(60));
}

testTelegram().catch(console.error);
