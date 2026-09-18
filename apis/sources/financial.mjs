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
    
    const finKeywords = ['stock', 'market', 'bank', 'finance', 'investment', 'fund', 'bond', 'crypto', 'bitcoin', 'currency', 'dollar', 'euro'];
    const finNews = news.filter(n => {
      const text = (n.title + ' ' + n.description).toLowerCase();
      return finKeywords.some(kw => text.includes(kw));
    });
    
    const features = finNews.slice(0, 50).map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng || 0, n.lat || 0] },
      properties: {
        value: 1,
        label: n.title || 'Financial event',
        region: n.country || 'Global',
        severity: 'INFO'
      }
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
