import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_PATH = join(process.cwd(), 'data/basket/predictions.json');

export default async function handler(req, res) {
  try {
    const data = JSON.parse(await readFile(BASKET_PATH, 'utf-8'));
    const alerts = data.alerts || [];
    
    // Координаты регионов (центры)
    const REGION_COORDS = {
      'Europe': { lat: 50.0, lng: 10.0 },
      'Asia': { lat: 40.0, lng: 100.0 },
      'North America': { lat: 45.0, lng: -100.0 },
      'Middle East': { lat: 28.0, lng: 45.0 },
      'Africa': { lat: 5.0, lng: 20.0 },
      'South America': { lat: -15.0, lng: -60.0 },
      'Australia': { lat: -25.0, lng: 135.0 },
      'Global': { lat: 20.0, lng: 0.0 }
    };
    
    const features = alerts.map(r => {
      const coords = REGION_COORDS[r.region] || REGION_COORDS['Global'];
      const riskColor = r.risk > 70 ? '#ff0000' : r.risk > 40 ? '#ff8800' : '#ffcc00';
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [coords.lng, coords.lat] },
        properties: {
          value: r.risk,
          label: `${r.region}: ${r.risk}%`,
          severity: r.level,
          region: r.region,
          timestamp: data.timestamp || new Date().toISOString(),
          description: `${r.region}: ${r.level} риск (CVE: ${r.cve_count}, новости: ${r.news_count})`,
          risk: r.risk,
          color: riskColor,
          cve_count: r.cve_count,
          news_count: r.news_count
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
