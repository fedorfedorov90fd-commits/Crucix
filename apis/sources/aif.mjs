// Аргументы и Факты — новостное агентство России
export async function briefing() {
  try {
    const response = await fetch('https://aif.ru/rss/news.php', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlString = await response.text();

    // Ищем элементы item с любыми атрибутами
    const itemMatches = xmlString.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/g);
    const items = [];
    let count = 0;

    for (const match of itemMatches) {
      if (count >= 15) break; // берем не больше 15 новостей
      const item = match[1];

      // Извлекаем title (может быть с CDATA)
      let title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      title = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

      // Извлекаем link
      let link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      link = link.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

      // Извлекаем pubDate
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';

      // Извлекаем description (может быть с CDATA)
      let description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      description = description.replace(/<!\[CDATA\[|\]\]>/g, '').trim();

      if (title) {
        items.push({
          title: title,
          url: link || '#',
          publishedAt: pubDate.trim() || new Date().toISOString(),
          summary: description.replace(/<[^>]*>/g, '').trim().substring(0, 200),
          source: 'Аргументы и Факты',
        });
        count++;
      }
    }

    console.error(`[Аргументы и Факты] Загружено ${items.length} новостей`);

    return {
      source: 'Аргументы и Факты',
      timestamp: new Date().toISOString(),
      items: items,
    };
  } catch (error) {
    console.error('[Аргументы и Факты] Ошибка:', error.message);
    return {
      source: 'Аргументы и Факты',
      timestamp: new Date().toISOString(),
      error: error.message || 'Неизвестная ошибка',
      items: [],
    };
  }
}

if (process.argv[1]?.endsWith('aif.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
