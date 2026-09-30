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
    
    // Интеллектуальные индикаторы: критические CVE + прогнозы + всплески новостей
    const critical = cves.filter(c => (c.cvss_score || 0) >= 9.0);
    const highSeverity = cves.filter(c => (c.cvss_score || 0) >= 7.0 && (c.cvss_score || 0) < 9.0);
    
    const intelData = [
      ...critical.map(c => ({ ...c, severity: 'CRITICAL', type: 'CVE' })),
      ...(pred.alerts || []).map(a => ({ ...a, severity: a.level, type: 'PREDICT' }))
    ];
    
    const features = intelData.slice(0, 30).map(n => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [n.lng || 0, n.lat || 0] },
      properties: {
        value: n.cvss_score || n.risk || 1,
        label: n.cve_id || n.region || 'Intelligence',
        region: n.region || n.country || 'Global',
        severity: n.severity || 'INFO',
        type: n.type || 'event'
      }
    }));
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ type: 'FeatureCollection', features }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
