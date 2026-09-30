import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_PATH = join(process.cwd(), 'data/basket/hackernews.json');

export default async function handler(req, res) {
  try {
    const data = JSON.parse(await readFile(BASKET_PATH, 'utf-8'));
    const features = data.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng || 0, r.lat || 0] },
      properties: {
        value: r.score || 0,
        label: r.title || 'HN',
        severity: r.severity || 'INFO',
        region: r.country || 'GLOBAL',
        timestamp: r.timestamp || new Date().toISOString(),
        description: r.text || ''
      }
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
