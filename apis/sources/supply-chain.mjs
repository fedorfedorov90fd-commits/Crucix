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
    const routes = await loadJSON('shipping-route.json');
    const sanctions = await loadJSON('sanction-list.json');
    
    // Анализируем цепочки поставок
    const metrics = {
      total_routes: routes.length,
      blocked_routes: routes.filter(r => r.value > 80).length,
      sanctions_impact: sanctions.reduce((s, r) => s + (r.value || 0), 0) / sanctions.length,
      risk_level: 'LOW'
    };
    
    if (metrics.blocked_routes > 3 && metrics.sanctions_impact > 50) {
      metrics.risk_level = 'HIGH';
    } else if (metrics.blocked_routes > 2 && metrics.sanctions_impact > 30) {
      metrics.risk_level = 'MEDIUM';
    }
    
    const alerts = [];
    routes.filter(r => r.value > 80).forEach(r => {
      alerts.push({ route: r.label, issue: 'High traffic volume', severity: r.value });
    });
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: metrics,
      alerts: alerts,
      routes: routes
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
