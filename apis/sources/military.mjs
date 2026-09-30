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
    const news = await loadJSON('gdelt_news.json');
    const cves = await loadJSON('cve_events.json');
    
    // Ключевые слова для военных индикаторов
    const militaryKeywords = ['military', 'army', 'navy', 'air force', 'missile', 'drone', 'defense', 'weapon', 'troop', 'base', 'exercise', 'war', 'conflict'];
    
    const militaryNews = news.filter(n => {
      const text = (n.title + ' ' + n.description).toLowerCase();
      return militaryKeywords.some(kw => text.includes(kw));
    });
    
    const features = militaryNews.slice(0, 50).map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng || 0, n.lat || 0] },
      properties: {
        value: 1,
        label: n.title || 'Military event',
        region: n.country || 'Global',
        severity: n.severity || 'INFO'
      }
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
