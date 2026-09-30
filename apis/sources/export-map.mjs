import { readFile } from 'fs/promises';
import { join } from 'path';

export default async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const format = url.searchParams.get('format') || 'json';
    
    // Собираем текущее состояние карты из данных
    const basketDir = join(process.cwd(), 'data/basket');
    const files = ['cve_events.json', 'gdelt_news.json', 'predictions.json', 'vix.json'];
    const state = {};
    
    for (const file of files) {
      try {
        const data = await readFile(join(basketDir, file), 'utf-8');
        state[file.replace('.json', '')] = JSON.parse(data);
      } catch {
        state[file.replace('.json', '')] = [];
      }
    }
    
    const exportData = {
      timestamp: new Date().toISOString(),
      map_state: {
        layers: state,
        count: {
          cves: state.cve_events?.length || 0,
          news: state.gdelt_news?.length || 0,
          predictions: state.predictions?.alerts?.length || 0,
          vix: state.vix?.length || 0
        }
      }
    };
    
    if (format === 'csv') {
      let csv = 'Category,Count\n';
      csv += `CVEs,${exportData.map_state.count.cves}\n`;
      csv += `News,${exportData.map_state.count.news}\n`;
      csv += `Predictions,${exportData.map_state.count.predictions}\n`;
      csv += `VIX,${exportData.map_state.count.vix}\n`;
      res.writeHead(200, { 
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="crucix-map-export.csv"'
      });
      res.end(csv);
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(exportData, null, 2));
    }
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
