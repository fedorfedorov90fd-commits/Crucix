// Lenta.ru — новостное агентство России
export async function briefing() {
  try {
    const response = await fetch('https://lenta.ru/rss', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xmlString = await response.text();

    if (!xmlString.includes('<item>')) {
      return {
        source: 'Lenta.ru',
        timestamp: new Date().toISOString(),
        items: [],
        error: 'Лента пуста',
      };
    }

    const items = [];
    const itemMatches = xmlString.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const item = match[1];
      const title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      const link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      const description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';

      if (title) {
        items.push({
          title: title.replace(/<[^>]*>/g, '').trim(),
          url: link.replace(/<!\[CDATA\[|\]\]>/g, '').trim() || '#',
          publishedAt: pubDate.trim() || new Date().toISOString(),
          summary: description.replace(/<[^>]*>/g, '').trim().substring(0, 200),
          source: 'Lenta.ru',
        });
      }
    }

    console.error(`[Lenta.ru] Загружено ${items.length} новостей`);

    return {
      source: 'Lenta.ru',
      timestamp: new Date().toISOString(),
      items: items.slice(0, 15),
    };
  } catch (error) {
    console.error('[Lenta.ru] Ошибка:', error.message);
    return {
      source: 'Lenta.ru',
      timestamp: new Date().toISOString(),
      error: error.message || 'Неизвестная ошибка',
      items: [],
    };
  }
}

if (process.argv[1]?.endsWith('lenta.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}
