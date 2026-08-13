// The Economist — новости экономики
export async function briefing() {
  try {
    const response = await fetch('https://www.economist.com/latest/rss.xml', {
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
    
    if (!xmlString.includes('<item>')) {
      return {
        source: 'The Economist',
        timestamp: new Date().toISOString(),
        items: [],
        error: 'Лента пуста',
      };
    }

    const items = [];
    const itemMatches = xmlString.matchAll(/<item>([\s\S]*?)<\/item>/g);
    
    for (const match of itemMatches) {
      const item = match[1];
      let title = item.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '';
      let link = item.match(/<link>([\s\S]*?)<\/link>/)?.[1] || '';
      const pubDate = item.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] || '';
      let description = item.match(/<description>([\s\S]*?)<\/description>/)?.[1] || '';
      
      title = title.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      link = link.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      description = description.replace(/<!\[CDATA\[|\]\]>/g, '').trim();
      
      if (title) {
        items.push({
          title: title,
          url: link || '#',
          publishedAt: pubDate.trim() || new Date().toISOString(),
          summary: description.replace(/<[^>]*>/g, '').trim().substring(0, 200),
          source: 'The Economist',
        });
      }
    }
    
    console.error(`[The Economist] Загружено ${items.length} новостей`);
    
    return {
      source: 'The Economist',
      timestamp: new Date().toISOString(),
      items: items.slice(0, 15),
    };
  } catch (error) {
    console.error('[The Economist] Ошибка:', error.message);
    return {
      source: 'The Economist',
      timestamp: new Date().toISOString(),
      error: error.message || 'Неизвестная ошибка',
      items: [],
    };
  }
}

if (process.argv[1]?.endsWith('economist.mjs')) {
  const data = await briefing();
  console.log(JSON.stringify(data, null, 2));
}