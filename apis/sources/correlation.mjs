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
    
    // 1. Корреляция CVE с новостями по регионам
    const regionMap = {};
    
    // Группируем CVE по регионам
    cves.forEach(cve => {
      const region = cve.region || 'Global';
      if (!regionMap[region]) regionMap[region] = { cves: 0, news: 0, severity: 0 };
      regionMap[region].cves += 1;
      regionMap[region].severity += (cve.cvss_score || 0);
    });
    
    // Группируем новости по регионам
    news.forEach(item => {
      const region = item.region || 'Global';
      if (!regionMap[region]) regionMap[region] = { cves: 0, news: 0, severity: 0 };
      regionMap[region].news += 1;
    });
    
    // Вычисляем корреляцию
    const correlations = Object.keys(regionMap).map(region => {
      const data = regionMap[region];
      const avgSeverity = data.cves > 0 ? (data.severity / data.cves) : 0;
      // Чем больше новостей и CVE, и выше severity — тем выше корреляция
      const correlation = Math.min(100, (data.news * 2) + (data.cves * 3) + (avgSeverity * 5));
      return {
        region,
        cve_count: data.cves,
        news_count: data.news,
        avg_severity: Math.round(avgSeverity * 10) / 10,
        correlation: Math.round(correlation),
        level: correlation > 70 ? 'HIGH' : correlation > 40 ? 'MEDIUM' : 'LOW'
      };
    });
    
    // Сортируем по корреляции
    correlations.sort((a, b) => b.correlation - a.correlation);
    
    // Находим связи между событиями
    const links = [];
    correlations.forEach(c => {
      if (c.cve_count > 0 && c.news_count > 0) {
        links.push({
          region: c.region,
          strength: c.correlation,
          description: `${c.region}: ${c.cve_count} CVE + ${c.news_count} новостей → корреляция ${c.correlation}%`
        });
      }
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlations: correlations,
      links: links,
      summary: {
        total_regions: correlations.length,
        high_correlation: correlations.filter(c => c.correlation > 70).length,
        medium_correlation: correlations.filter(c => c.correlation > 40 && c.correlation <= 70).length
      }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
