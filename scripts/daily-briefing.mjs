#!/usr/bin/env node
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);
const BASKET_DIR = join(process.cwd(), 'data/basket');
const BRIEFING_FILE = join(process.cwd(), 'data/briefing.json');

async function generateBriefing() {
  console.log('📰 Генерация ежедневного AI-брифинга...');
  
  try {
    // Собираем данные из корзины
    const cves = JSON.parse(await readFile(join(BASKET_DIR, 'cve_events.json'), 'utf-8'));
    const news = JSON.parse(await readFile(join(BASKET_DIR, 'gdelt_news.json'), 'utf-8'));
    const predictions = JSON.parse(await readFile(join(BASKET_DIR, 'predictions.json'), 'utf-8'));
    
    // Формируем брифинг
    const briefing = {
      timestamp: new Date().toISOString(),
      summary: {
        total_cves: cves.length,
        critical_cves: cves.filter(c => (c.cvss_score || 0) >= 9.0).length,
        total_news: news.length,
        alerts: predictions.alerts || []
      },
      top_cves: cves.filter(c => (c.cvss_score || 0) >= 9.0).slice(0, 5).map(c => ({
        id: c.cve_id,
        severity: c.severity,
        cvss: c.cvss_score,
        description: (c.description || '').slice(0, 200)
      })),
      top_news: news.slice(0, 5).map(n => ({
        title: n.title,
        country: n.country,
        url: n.url
      })),
      predictions: predictions.alerts || []
    };
    
    await writeFile(BRIEFING_FILE, JSON.stringify(briefing, null, 2));
    console.log(`✅ Брифинг сохранён: ${BRIEFING_FILE}`);
    
    // Выводим в консоль
    console.log('\n📋 КРАТКИЙ БРИФИНГ:');
    console.log(`  CVE: ${briefing.summary.total_cves} (критических: ${briefing.summary.critical_cves})`);
    console.log(`  Новости: ${briefing.summary.total_news}`);
    console.log(`  Алертов: ${briefing.summary.alerts.length}`);
    
    return briefing;
  } catch (e) {
    console.error(`❌ Ошибка генерации брифинга: ${e.message}`);
    return null;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateBriefing();
}

export { generateBriefing };
