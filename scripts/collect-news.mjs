#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const BASKET_FILE = join(ROOT, 'data', 'basket', 'news.json');

const DEMO_DATA = {
  articles: [
    { id: 'news-001', title: 'Иран нанёс ракетные удары по Израилю', source: 'Reuters', category: 'geopolitics', region: 'Ближний Восток', date: '2026-08-16T10:30:00Z', importance: 'critical' },
    { id: 'news-002', title: 'США ввели новые санкции против Ирана', source: 'AP', category: 'geopolitics', region: 'США', date: '2026-08-16T09:15:00Z', importance: 'high' },
    { id: 'news-003', title: 'ЕС одобрил новый пакет помощи Украине на 50 млрд евро', source: 'Euronews', category: 'politics', region: 'Европа', date: '2026-08-16T08:45:00Z', importance: 'high' },
    { id: 'news-004', title: 'Нефть Brent превысила $110 за баррель', source: 'Bloomberg', category: 'economy', region: 'Мир', date: '2026-08-16T08:00:00Z', importance: 'high' },
    { id: 'news-005', title: 'Золото обновило исторический максимум — $2150 за унцию', source: 'CNBC', category: 'economy', region: 'Мир', date: '2026-08-16T07:30:00Z', importance: 'medium' },
    { id: 'news-006', title: 'Байден подписал закон о бюджете на 2026 год', source: 'NYT', category: 'politics', region: 'США', date: '2026-08-16T07:00:00Z', importance: 'medium' },
    { id: 'news-007', title: 'Китай запустил новый спутник для мониторинга океана', source: 'Xinhua', category: 'technology', region: 'Китай', date: '2026-08-16T06:30:00Z', importance: 'low' },
    { id: 'news-008', title: 'Россия заявила о готовности к переговорам по Украине', source: 'TASS', category: 'diplomacy', region: 'Россия', date: '2026-08-16T06:00:00Z', importance: 'high' },
    { id: 'news-009', title: 'Землетрясение магнитудой 6.2 в Индонезии', source: 'USGS', category: 'disaster', region: 'Азия', date: '2026-08-16T05:30:00Z', importance: 'high' },
    { id: 'news-010', title: 'Индия стала третьей экономикой мира', source: 'Times of India', category: 'economy', region: 'Индия', date: '2026-08-16T05:00:00Z', importance: 'medium' }
  ],
  summary: {
    total: 10,
    byCategory: { 'geopolitics': 2, 'politics': 2, 'economy': 3, 'technology': 1, 'diplomacy': 1, 'disaster': 1 },
    byRegion: { 'Ближний Восток': 1, 'США': 2, 'Европа': 1, 'Мир': 2, 'Китай': 1, 'Россия': 1, 'Азия': 1, 'Индия': 1 },
    byImportance: { 'critical': 1, 'high': 4, 'medium': 4, 'low': 1 }
  }
};

async function collect() {
  try {
    const entry = {
      id: `news-${new Date().toISOString().slice(0, 10)}`,
      type: 'news',
      date: new Date().toISOString(),
      data: DEMO_DATA,
      source: 'demo'
    };
    await fs.mkdir(join(ROOT, 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_FILE, JSON.stringify(entry, null, 2));
    console.log('✅ Новости сохранены в корзину');
  } catch (e) {
    console.error('❌ Ошибка сбора новостей:', e.message);
  }
}
collect();
