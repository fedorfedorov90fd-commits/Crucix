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
    
    // Регионы и их вес
    const regions = {
      'Europe': { base: 1.2, cve_weight: 2, news_weight: 1 },
      'Asia': { base: 1.5, cve_weight: 2.5, news_weight: 1.2 },
      'North America': { base: 1.0, cve_weight: 1.5, news_weight: 0.8 },
      'Middle East': { base: 2.0, cve_weight: 3, news_weight: 2 },
      'Africa': { base: 1.8, cve_weight: 2, news_weight: 1.5 },
      'South America': { base: 1.3, cve_weight: 1.8, news_weight: 1.2 },
      'Australia': { base: 0.8, cve_weight: 1.2, news_weight: 0.8 }
    };
    
    // Считаем SSI
    const results = [];
    let maxScore = 0;
    
    for (const [region, weights] of Object.entries(regions)) {
      // Считаем CVE в регионе
      const regionCVEs = cves.filter(c => c.region === region || c.country === region);
      const regionNews = news.filter(n => n.region === region || n.country === region);
      
      const cveScore = regionCVEs.length * weights.cve_weight * (regionCVEs.reduce((s, c) => s + (c.cvss_score || 0), 0) / (regionCVEs.length || 1));
      const newsScore = regionNews.length * weights.news_weight;
      const baseScore = weights.base * 10;
      
      const ssi = Math.round((baseScore + cveScore + newsScore) * 10) / 10;
      if (ssi > maxScore) maxScore = ssi;
      
      results.push({ region, ssi, cve_count: regionCVEs.length, news_count: regionNews.length });
    }
    
    // Нормализуем
    results.forEach(r => {
      r.ssi_normalized = Math.round((r.ssi / (maxScore || 1)) * 100);
      r.level = r.ssi_normalized > 70 ? 'HIGH' : r.ssi_normalized > 40 ? 'MEDIUM' : 'LOW';
    });
    
    results.sort((a, b) => b.ssi - a.ssi);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      regions: results,
      global_ssi: Math.round(results.reduce((s, r) => s + r.ssi_normalized, 0) / results.length)
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
