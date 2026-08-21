#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

// Убедимся, что папка basket существует
if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchUCDP() {
  console.log('[UCDP] Загрузка данных о конфликтах...');

  try {
    // Используем CSV → JSON конвертацию через прямой парсинг
    const url = 'https://ucdp.uu.se/downloads/ucdpprio/ucdp-prio-acd-241.zip';
    console.log(`[UCDP] URL: ${url}`);

    // Пока используем демо-данные, т.к. прямой парсинг zip требует дополнительной обработки
    // В реальном проекте нужно распаковать zip и прочитать CSV

    const demoData = {
      source: 'UCDP',
      lastUpdated: new Date().toISOString(),
      conflicts: [
        { region: 'Ukraine', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Syria', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Yemen', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Sudan', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Myanmar', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Gaza', type: 'Armed Conflict', year: 2024, status: 'active' },
        { region: 'Ethiopia', type: 'Armed Conflict', year: 2024, status: 'active' },
      ],
      note: 'Данные загружены из демо-режима. Для реальных данных требуется парсинг ZIP → CSV'
    };

    const filePath = join(BASKET_DIR, 'ucdp-latest.json');
    writeFileSync(filePath, JSON.stringify(demoData, null, 2));
    console.log(`[UCDP] ✅ Данные сохранены в ${filePath}`);
    console.log(`[UCDP] Всего конфликтов: ${demoData.conflicts.length}`);

  } catch (error) {
    console.error('[UCDP] ❌ Ошибка:', error.message);
  }
}

fetchUCDP();
