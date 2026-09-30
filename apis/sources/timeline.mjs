import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_DIR = join(process.cwd(), 'data/basket');

async function loadJSON(file) {
  try {
    const data = await readFile(join(BASKET_DIR, file), 'utf-8');
    return JSON.parse(data);
  } catch { return []; }
}

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const start = url.searchParams.get('start') || '2026-09-01';
    const end = url.searchParams.get('end') || '2026-09-07';
    
    const cves = await loadJSON('cve_events.json');
    const news = await loadJSON('gdelt_news.json');
    
    // Группируем по дням
    const timeline = {};
    const dates = [];
    let current = new Date(start);
    const endDate = new Date(end);
    while (current <= endDate) {
      const key = current.toISOString().split('T')[0];
      dates.push(key);
      timeline[key] = { cves: 0, news: 0, total: 0 };
      current.setDate(current.getDate() + 1);
    }
    
    cves.forEach(c => {
      const date = c.published ? new Date(c.published).toISOString().split('T')[0] : 'unknown';
      if (timeline[date]) timeline[date].cves += 1;
    });
    
    news.forEach(n => {
      const date = n.timestamp ? new Date(n.timestamp).toISOString().split('T')[0] : 'unknown';
      if (timeline[date]) timeline[date].news += 1;
    });
    
    // Вычисляем накопленные итоги
    let cumCVE = 0, cumNews = 0;
    dates.forEach(date => {
      cumCVE += timeline[date].cves;
      cumNews += timeline[date].news;
      timeline[date].cum_cves = cumCVE;
      timeline[date].cum_news = cumNews;
      timeline[date].total = timeline[date].cves + timeline[date].news;
    });
    
    const features = dates.map(date => {
      const data = timeline[date];
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [0, 0] },
        properties: {
          date: date,
          cves: data.cves,
          news: data.news,
          total: data.total,
          cum_cves: data.cum_cves,
          cum_news: data.cum_news,
          severity: data.total > 10 ? 'HIGH' : data.total > 5 ? 'MEDIUM' : 'LOW'
        }
      };
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'FeatureCollection',
      features: features,
      timeline: timeline,
      dates: dates,
      summary: {
        total_cves: cves.length,
        total_news: news.length,
        total_events: cves.length + news.length
      }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
