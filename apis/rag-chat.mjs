import { readFile } from 'fs/promises';
import { join } from 'path';

export default async function handler(req, res) {
  try {
    const query = new URL(req.url, 'http://localhost').searchParams.get('q') || '';
    if (!query) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing query param q' }));
    }

    // Собираем данные из всех баскетов
    const basketDir = join(process.cwd(), 'data/basket');
    const files = ['cve_events.json', 'gdelt_news.json', 'hackernews.json', 'cisa.json', 'usgs.json'];
    let results = [];
    
    for (const file of files) {
      try {
        const data = JSON.parse(await readFile(join(basketDir, file), 'utf-8'));
        const items = data.filter(r => {
          const text = (r.title || '') + ' ' + (r.description || '') + ' ' + (r.text || '');
          return text.toLowerCase().includes(query.toLowerCase());
        }).slice(0, 5);
        results = results.concat(items);
      } catch {}
    }

    // Простой ответ (без LLM для скорости)
    const answer = results.length > 0
      ? `Найдено ${results.length} результатов по запросу "${query}":\n` + 
        results.map(r => `- ${r.title || r.cve_id || r.place || r.advisory || 'Event'}`).join('\n')
      : `По запросу "${query}" ничего не найдено`;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ query, answer, count: results.length }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
