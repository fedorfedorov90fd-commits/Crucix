import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_PATH = join(process.cwd(), 'data/basket/cve_events.json');

export default async function handler(req, res) {
  try {
    const data = JSON.parse(await readFile(BASKET_PATH, 'utf-8'));
    const features = data.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [r.lng || 0, r.lat || 0] },
      properties: {
        value: r.cvss_score || 0,
        label: r.cve_id || 'CVE',
        severity: r.severity || 'UNKNOWN',
        region: r.country || 'GLOBAL',
        timestamp: r.published || new Date().toISOString(),
        description: r.description || ''
      }
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
