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
    const cves = await loadJSON('cve_events.json');
    const news = await loadJSON('gdelt_news.json');
    const pred = await loadJSON('predictions.json');
    
    // Агрегируем риск по регионам
    const regions = {};
    const coords = {};
    
    const allData = [...cves, ...news];
    allData.forEach(item => {
      const region = item.region || item.country || 'Global';
      const lat = item.lat || 0;
      const lng = item.lng || 0;
      if (!regions[region]) {
        regions[region] = { cves: 0, news: 0, risk: 0, lat: lat, lng: lng };
      }
      regions[region].cves += 1;
      regions[region].risk += (item.cvss_score || 1);
    });
    
    // Добавляем прогнозы
    (pred.alerts || []).forEach(a => {
      const region = a.region || 'Global';
      if (regions[region]) {
        regions[region].risk += a.risk || 0;
      }
    });
    
    const features = Object.entries(regions).map(([region, data]) => ({
      type: 'Feature',
      geometry: { 
        type: 'Point', 
        coordinates: [data.lng || 0, data.lat || 0] 
      },
      properties: {
        value: Math.round((data.risk / (data.cves || 1)) * 10) / 10,
        label: region,
        region: region,
        cves: data.cves,
        news: data.news,
        severity: data.risk > 50 ? 'CRITICAL' : data.risk > 20 ? 'HIGH' : 'MEDIUM'
      }
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      type: 'FeatureCollection',
      features: features,
      summary: {
        regions: Object.keys(regions).length,
        total_risk: Object.values(regions).reduce((s, r) => s + r.risk, 0)
      }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
