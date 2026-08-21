#!/usr/bin/env node

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

if (!existsSync(BASKET_DIR)) {
  mkdirSync(BASKET_DIR, { recursive: true });
}

async function fetchNewsAPI() {
  console.log('[NewsAPI] Загрузка новостей...');

  try {
    // Бесплатный NewsAPI (без ключа — ограниченный доступ)
    const url = 'https://newsapi.org/v2/top-headlines?country=us&pageSize=20';
    
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 401) {
        console.log('[NewsAPI] ⚠️ Требуется API-ключ. Сохраняем демо-данные.');
        throw new Error('API key required');
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const basketData = {
      source: 'NewsAPI',
      lastUpdated: new Date().toISOString(),
      totalArticles: data.articles?.length || 0,
      articles: (data.articles || []).slice(0, 20).map(a => ({
        title: a.title || 'No title',
        description: a.description || '',
        source: a.source?.name || 'Unknown',
        publishedAt: a.publishedAt || '',
        url: a.url || '',
        image: a.urlToImage || ''
      })),
      note: 'Данные загружены через NewsAPI (без ключа — ограниченно)'
    };

    const filePath = join(BASKET_DIR, 'newsapi-latest.json');
    writeFileSync(filePath, JSON.stringify(basketData, null, 2));
    console.log(`[NewsAPI] ✅ Данные сохранены в ${filePath}`);
    console.log(`[NewsAPI] Всего новостей: ${basketData.totalArticles}`);

  } catch (error) {
    console.error('[NewsAPI] ❌ Ошибка:', error.message);
    const fallbackData = {
      source: 'NewsAPI (DEMO)',
      lastUpdated: new Date().toISOString(),
      totalArticles: 10,
      articles: [
        { title: 'Глобальный экономический форум начал работу в Давосе', source: 'Reuters', publishedAt: new Date().toISOString() },
        { title: 'Новый этап переговоров по климату стартовал в ООН', source: 'BBC News', publishedAt: new Date().toISOString() },
        { title: 'Технологические гиганты объявили о сотрудничестве в области ИИ', source: 'TechCrunch', publishedAt: new Date().toISOString() },
        { title: 'Цены на нефть продолжают расти на фоне геополитической напряженности', source: 'Bloomberg', publishedAt: new Date().toISOString() },
        { title: 'Европа готовится к новому пакету санкций', source: 'Euronews', publishedAt: new Date().toISOString() },
        { title: 'Китай представил новый план развития экономики', source: 'Xinhua', publishedAt: new Date().toISOString() },
        { title: 'NASA объявило о новой миссии на Марс', source: 'Space.com', publishedAt: new Date().toISOString() },
        { title: 'Мировые рынки закрылись ростом на фоне оптимизма инвесторов', source: 'Financial Times', publishedAt: new Date().toISOString() },
        { title: 'Новый закон о кибербезопасности принят в ЕС', source: 'Politico', publishedAt: new Date().toISOString() },
        { title: 'Гуманитарный кризис в регионе усугубляется', source: 'Al Jazeera', publishedAt: new Date().toISOString() }
      ],
      note: 'Демо-данные (NewsAPI требует ключ)'
    };
    writeFileSync(join(BASKET_DIR, 'newsapi-latest.json'), JSON.stringify(fallbackData, null, 2));
    console.log('[NewsAPI] ✅ Сохранены демо-данные');
  }
}

fetchNewsAPI();
