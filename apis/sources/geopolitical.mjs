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
    
    // Регионы с геополитическим весом
    const regions = {
      'Europe': { lat: 50.0, lng: 10.0, weight: 1.2 },
      'Asia': { lat: 40.0, lng: 100.0, weight: 1.5 },
      'North America': { lat: 45.0, lng: -100.0, weight: 1.0 },
      'Middle East': { lat: 28.0, lng: 45.0, weight: 2.0 },
      'Africa': { lat: 5.0, lng: 20.0, weight: 1.8 },
      'South America': { lat: -15.0, lng: -60.0, weight: 1.3 }
    };
    
    const features = Object.entries(regions).map(([region, coords]) => {
      const regionNews = news.filter(n => (n.region === region || n.country === region));
      const regionCves = cves.filter(c => (c.region === region || c.country === region));
      const score = Math.min(100, (regionNews.length * 0.5 + regionCves.length * 1.5) * coords.weight);
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        properties: {
          value: Math.round(score),
          label: `${region}: ${Math.round(score)}%`,
          region: region,
          severity: score > 70 ? 'HIGH' : score > 40 ? 'MEDIUM' : 'LOW',
          news_count: regionNews.length,
          cve_count: regionCves.length
        }
      };
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
