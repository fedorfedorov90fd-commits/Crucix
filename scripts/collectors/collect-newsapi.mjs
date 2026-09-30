#!/usr/bin/env node
/**
 * Crucix Collector: newsapi (топ-новости NewsAPI) — требует ключ.
 * Версия 2.0.0. Принят 20.09.2026.
 * Правило 12.2: NewsAPI требует ключ → fallback demo (10 статей).
 * Формат: {source, lastUpdated, totalArticles, articles:[...], note}. Тип — events.
 */
import { saveRaw } from './lib/collector-helper.mjs';
import { pathToFileURL } from 'url';

const API_URL = 'https://newsapi.org/v2/top-headlines?country=us&pageSize=20';
const TIMEOUT_MS = 15000;

function buildFallback() {
  const now = new Date().toISOString();
  return {
    source: 'NewsAPI (DEMO)',
    lastUpdated: now,
    totalArticles: 10,
    articles: [
      { title: 'Глобальный экономический форум начал работу в Давосе', source: 'Reuters', publishedAt: now },
      { title: 'Новый этап переговоров по климату стартовал в ООН', source: 'BBC News', publishedAt: now },
      { title: 'Технологические гиганты объявили о сотрудничестве в области ИИ', source: 'TechCrunch', publishedAt: now },
      { title: 'Цены на нефть продолжают расти на фоне геополитической напряженности', source: 'Bloomberg', publishedAt: now },
      { title: 'Европа готовится к новому пакету санкций', source: 'Euronews', publishedAt: now },
      { title: 'Китай представил новый план развития экономики', source: 'Xinhua', publishedAt: now },
      { title: 'NASA объявило о новой миссии на Марс', source: 'Space.com', publishedAt: now },
      { title: 'Мировые рынки закрылись ростом на фоне оптимизма инвесторов', source: 'Financial Times', publishedAt: now },
      { title: 'Новый закон о кибербезопасности принят в ЕС', source: 'Politico', publishedAt: now },
      { title: 'Гуманитарный кризис в регионе усугубляется', source: 'Al Jazeera', publishedAt: now },
    ],
    note: 'Демо-данные (NewsAPI требует ключ, правило 12.2)',
  };
}

export async function collectNewsAPI() {
  console.log('[NewsAPI] Загрузка...');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let basketData;
  let ok = false;
  try {
    const r = await fetch(API_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    basketData = {
      source: 'NewsAPI',
      lastUpdated: new Date().toISOString(),
      totalArticles: data.articles?.length || 0,
      articles: (data.articles || []).slice(0, 20).map(a => ({
        title: a.title || 'No title',
        description: a.description || '',
        source: a.source?.name || 'Unknown',
        publishedAt: a.publishedAt || '',
        url: a.url || '',
        image: a.urlToImage || '',
      })),
      note: 'Данные загружены через NewsAPI',
    };
    ok = true;
  } catch (e) {
    clearTimeout(timer);
    console.error('[NewsAPI] ⚠️ Ошибка:', e.message);
    basketData = buildFallback();
  }

  const result = await saveRaw('newsapi', basketData, {
    collector: 'collect-newsapi.mjs',
    source: ok ? 'NewsAPI' : 'NewsAPI (DEMO)',
    source_url: API_URL,
    license: 'public-domain',
    format_hint: 'events',
    value_type: 'count',
    value_unit: 'count',
    granularity: 'snapshot',
    period: null,
    record_count: basketData.articles.length,
    notes: ok ? 'Реальные данные NewsAPI' : 'Fallback demo (требуется ключ, правило 12.2); basket не перезаписывается',
    backwardCompat: false,
  });
  console.log(`[NewsAPI] OK ${basketData.articles.length} → ${result.raw_file}`);
  return basketData;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  collectNewsAPI().catch((e) => { console.error('[NewsAPI] FATAL:', e); process.exit(1); });
}
