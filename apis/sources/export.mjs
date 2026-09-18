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
    
    const format = new URL(req.url, 'http://localhost').searchParams.get('format') || 'json';
    
    // Базовые данные
    const report = {
      generated: new Date().toISOString(),
      summary: {
        total_cves: cves.length,
        total_news: news.length,
        alerts: pred.alerts || []
      },
      cves: cves.slice(0, 100).map(c => ({
        id: c.cve_id || 'unknown',
        severity: c.severity || 'unknown',
        cvss: c.cvss_score || 0,
        description: (c.description || '').slice(0, 200)
      })),
      news: news.slice(0, 50).map(n => ({
        title: n.title || 'unknown',
        country: n.country || 'global'
      }))
    };
    
    if (format === 'json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(report, null, 2));
    }
    
    if (format === 'csv') {
      let csv = 'Generated,Total CVEs,Total News,Alerts\n';
      csv += `${report.generated},${report.summary.total_cves},${report.summary.total_news},${report.summary.alerts.length}\n\n`;
      csv += 'CVE ID,Severity,CVSS,Description\n';
      report.cves.forEach(c => {
        csv += `"${c.id}","${c.severity}",${c.cvss},"${c.description}"\n`;
      });
      csv += '\nTitle,Country\n';
      report.news.forEach(n => {
        csv += `"${n.title}","${n.country}"\n`;
      });
      res.writeHead(200, { 
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="crucix-report.csv"'
      });
      return res.end(csv);
    }
    
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'Invalid format. Use json or csv' }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
