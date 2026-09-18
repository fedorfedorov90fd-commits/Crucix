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
    
    // Группируем по дням
    const daily = {};
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      daily[key] = { cves: 0, news: 0 };
    }
    
    cves.forEach(c => {
      const date = c.timestamp ? new Date(c.timestamp).toISOString().split('T')[0] : 'unknown';
      if (daily[date]) daily[date].cves += 1;
    });
    
    news.forEach(n => {
      const date = n.timestamp ? new Date(n.timestamp).toISOString().split('T')[0] : 'unknown';
      if (daily[date]) daily[date].news += 1;
    });
    
    // Считаем среднее и стандартное отклонение
    const dates = Object.keys(daily).filter(d => d !== 'unknown');
    const cveValues = dates.map(d => daily[d].cves);
    const newsValues = dates.map(d => daily[d].news);
    
    const avgCVE = cveValues.reduce((s, v) => s + v, 0) / cveValues.length || 0;
    const avgNews = newsValues.reduce((s, v) => s + v, 0) / newsValues.length || 0;
    
    const stdCVE = Math.sqrt(cveValues.reduce((s, v) => s + Math.pow(v - avgCVE, 2), 0) / cveValues.length) || 1;
    const stdNews = Math.sqrt(newsValues.reduce((s, v) => s + Math.pow(v - avgNews, 2), 0) / newsValues.length) || 1;
    
    // Находим аномалии (z-score > 2)
    const anomalies = [];
    dates.forEach(date => {
      const cveZ = (daily[date].cves - avgCVE) / stdCVE;
      const newsZ = (daily[date].news - avgNews) / stdNews;
      if (cveZ > 2 || newsZ > 2) {
        anomalies.push({
          date,
          cves: daily[date].cves,
          news: daily[date].news,
          cve_z: Math.round(cveZ * 10) / 10,
          news_z: Math.round(newsZ * 10) / 10,
          type: cveZ > newsZ ? 'CVE_SPIKE' : 'NEWS_SPIKE',
          severity: cveZ > 3 || newsZ > 3 ? 'CRITICAL' : 'HIGH'
        });
      }
    });
    
    anomalies.sort((a, b) => b.cve_z - a.cve_z);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      anomalies: anomalies,
      baseline: {
        avg_cves: Math.round(avgCVE * 10) / 10,
        avg_news: Math.round(avgNews * 10) / 10
      }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
