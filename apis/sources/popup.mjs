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
    const url = new URL(req.url, 'http://localhost');
    const layer = url.searchParams.get('layer');
    const id = url.searchParams.get('id');
    
    if (!layer || !id) {
      res.writeHead(400);
      return res.end(JSON.stringify({ error: 'Missing layer or id' }));
    }
    
    let data = [];
    let source = '';
    
    switch(layer) {
      case 'cve':
        data = await loadJSON('cve_events.json');
        source = 'NVD CVE';
        break;
      case 'gdelt':
        data = await loadJSON('gdelt_news.json');
        source = 'GDELT News';
        break;
      case 'hackernews':
        data = await loadJSON('hackernews.json');
        source = 'Hacker News';
        break;
      case 'cisa':
        data = await loadJSON('cisa.json');
        source = 'CISA';
        break;
      case 'usgs':
        data = await loadJSON('usgs.json');
        source = 'USGS';
        break;
      case 'shodan':
        data = await loadJSON('shodan.json');
        source = 'Shodan';
        break;
      case 'github':
        data = await loadJSON('github_events.json');
        source = 'GitHub';
        break;
      case 'reddit':
        data = await loadJSON('reddit.json');
        source = 'Reddit';
        break;
      case 'weather':
        data = await loadJSON('weather.json');
        source = 'Weather';
        break;
      case 'predict':
        data = (await loadJSON('predictions.json')).alerts || [];
        source = 'Прогноз атак';
        break;
      default:
        res.writeHead(404);
        return res.end(JSON.stringify({ error: 'Layer not found' }));
    }
    
    // Ищем запись
    const item = data.find(d => {
      const itemId = d.cve_id || d.id || d.advisory || d.ip || d.repo || d.title || d.city || d.region;
      return String(itemId) === String(id);
    });
    
    if (!item) {
      res.writeHead(404);
      return res.end(JSON.stringify({ error: 'Item not found' }));
    }
    
    // Формируем popup
    const popup = {
      source: source,
      layer: layer,
      title: item.cve_id || item.title || item.advisory || item.ip || item.repo || item.city || item.region || 'Event',
      details: [],
      raw: item
    };
    
    // Добавляем детали в зависимости от типа
    if (item.cve_id) {
      popup.details.push({ label: 'CVE ID', value: item.cve_id });
      popup.details.push({ label: 'CVSS Score', value: item.cvss_score || 'N/A' });
      popup.details.push({ label: 'Severity', value: item.severity || 'N/A' });
      popup.details.push({ label: 'Published', value: item.published || 'N/A' });
      popup.details.push({ label: 'Description', value: (item.description || '').slice(0, 300) });
      if (item.url) popup.details.push({ label: 'URL', value: item.url, link: true });
    } else if (item.title) {
      popup.details.push({ label: 'Title', value: item.title });
      popup.details.push({ label: 'Source', value: item.source || source });
      popup.details.push({ label: 'Country', value: item.country || 'Global' });
      popup.details.push({ label: 'Time', value: item.timestamp || 'N/A' });
      if (item.url) popup.details.push({ label: 'URL', value: item.url, link: true });
      if (item.score) popup.details.push({ label: 'Score', value: item.score });
    } else if (item.region) {
      popup.details.push({ label: 'Region', value: item.region });
      popup.details.push({ label: 'Risk', value: `${item.risk}%` });
      popup.details.push({ label: 'Level', value: item.level });
      popup.details.push({ label: 'CVE count', value: item.cve_count });
      popup.details.push({ label: 'News count', value: item.news_count });
    } else if (item.ip) {
      popup.details.push({ label: 'IP', value: item.ip });
      popup.details.push({ label: 'Service', value: item.service || 'N/A' });
      popup.details.push({ label: 'Ports', value: item.ports || 'N/A' });
      popup.details.push({ label: 'Country', value: item.country || 'Global' });
    } else if (item.repo) {
      popup.details.push({ label: 'Repository', value: item.repo });
      popup.details.push({ label: 'Event', value: item.event || 'N/A' });
      popup.details.push({ label: 'Stars', value: item.stars || 0 });
    } else if (item.place) {
      popup.details.push({ label: 'Location', value: item.place });
      popup.details.push({ label: 'Magnitude', value: item.magnitude || 'N/A' });
      popup.details.push({ label: 'Severity', value: item.severity || 'N/A' });
    } else if (item.city) {
      popup.details.push({ label: 'City', value: item.city });
      popup.details.push({ label: 'Temperature', value: `${item.temp || 'N/A'}°C` });
      popup.details.push({ label: 'Condition', value: item.condition || 'N/A' });
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(popup));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
