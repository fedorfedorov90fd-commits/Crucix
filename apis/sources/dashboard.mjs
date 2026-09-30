import { readFile } from 'fs/promises';
import { join } from 'path';
const BASKET_DIR = join(process.cwd(), 'data/basket');

async function loadJSON(file) {
  try {
    const data = await readFile(join(BASKET_DIR, file), 'utf-8');
    return JSON.parse(data);
  } catch { return null; }
}

export default async function handler(req, res) {
  try {
    const cves = await loadJSON('cve_events.json') || [];
    const news = await loadJSON('gdelt_news.json') || [];
    const pred = await loadJSON('predictions.json') || { alerts: [] };
    
    // Подсчет статистики
    const critical = cves.filter(c => (c.cvss_score || 0) >= 9.0).length;
    const high = cves.filter(c => (c.cvss_score || 0) >= 7.0 && (c.cvss_score || 0) < 9.0).length;
    const medium = cves.filter(c => (c.cvss_score || 0) >= 4.0 && (c.cvss_score || 0) < 7.0).length;
    const low = cves.filter(c => (c.cvss_score || 0) < 4.0).length;
    
    // Топ регионов по риску
    const topRegions = (pred.alerts || [])
      .sort((a, b) => b.risk - a.risk)
      .slice(0, 5)
      .map(a => ({ region: a.region, risk: a.risk, level: a.level }));
    
    const dashboard = {
      timestamp: new Date().toISOString(),
      summary: {
        total_cves: cves.length,
        total_news: news.length,
        total_alerts: (pred.alerts || []).length,
        critical_cves: critical,
        high_cves: high,
        medium_cves: medium,
        low_cves: low,
        max_risk: (pred.alerts || []).length > 0 ? Math.max(...(pred.alerts || []).map(a => a.risk)) : 0
      },
      top_regions: topRegions,
      alerts: pred.alerts || []
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(dashboard));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
