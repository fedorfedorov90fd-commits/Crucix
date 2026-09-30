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
    const speed = parseInt(url.searchParams.get('speed')) || 1;
    
    const cves = await loadJSON('cve_events.json');
    const news = await loadJSON('gdelt_news.json');
    
    // Создаём анимированные кадры
    const frames = [];
    let currentCVE = 0;
    let currentNews = 0;
    
    // Берём события с временными метками
    const events = [
      ...cves.map(c => ({ type: 'cve', time: c.published || c.timestamp, data: c })),
      ...news.map(n => ({ type: 'news', time: n.timestamp, data: n }))
    ].filter(e => e.time).sort((a, b) => new Date(a.time) - new Date(b.time));
    
    // Создаём кадры для каждого события
    events.forEach((e, i) => {
      const frame = {
        frame: i,
        time: e.time,
        type: e.type,
        cve_count: cves.filter(c => new Date(c.published || c.timestamp) <= new Date(e.time)).length,
        news_count: news.filter(n => new Date(n.timestamp) <= new Date(e.time)).length,
        total: i + 1,
        progress: ((i + 1) / events.length) * 100
      };
      frames.push(frame);
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      total_frames: frames.length,
      speed: speed,
      frames: frames.slice(0, 100),
      summary: {
        total_cves: cves.length,
        total_news: news.length
      }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
