#!/usr/bin/env node

// ============================================================
// СБОРЩИК RSS-ИСТОЧНИКОВ (УПРОЩЁННАЯ ВЕРСИЯ)
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_DIR = join(ROOT, 'data', 'basket');

async function collectRSSExtra() {
  console.log('[RSS Extra] Сбор RSS-новостей...');
  
  try {
    await fs.mkdir(BASKET_DIR, { recursive: true });
    
    // Тестовые данные вместо реальных RSS-запросов
    const data = {
      source: 'rss-extra',
      timestamp: new Date().toISOString(),
      total_sources: 6,
      success: 6,
      failed: 0,
      results: [
        { 
          source: 'BBC World', 
          category: 'world', 
          count: 3,
          items: [
            { title: 'Global tensions rise as conflicts escalate', link: '#', date: new Date().toISOString() },
            { title: 'Oil prices surge amid supply concerns', link: '#', date: new Date().toISOString() },
            { title: 'Climate summit opens with new commitments', link: '#', date: new Date().toISOString() }
          ]
        },
        { 
          source: 'Al Jazeera', 
          category: 'middle-east', 
          count: 2,
          items: [
            { title: 'Middle East leaders call for de-escalation', link: '#', date: new Date().toISOString() },
            { title: 'Humanitarian crisis deepens in conflict zones', link: '#', date: new Date().toISOString() }
          ]
        }
      ]
    };

    await fs.writeFile(join(BASKET_DIR, 'rss-extra-latest.json'), JSON.stringify(data, null, 2));
    console.log('[RSS Extra] ✅ Готово (тестовые данные)');
    return data;
  } catch (e) {
    console.error('[RSS Extra] Ошибка:', e.message);
    throw e;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) collectRSSExtra().catch(() => process.exit(1));
export { collectRSSExtra };
