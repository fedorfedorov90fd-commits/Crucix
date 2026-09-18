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
    const gold = await loadJSON('gold.json');
    const oil = await loadJSON('oil.json');
    const vix = await loadJSON('vix.json');
    
    const goldPrice = gold[0]?.value || 0;
    const oilPrice = oil[0]?.value || 0;
    const vixValue = vix[vix.length-1]?.close || 0;
    
    const ratio = goldPrice / oilPrice;
    const signals = [];
    
    if (ratio > 25 && vixValue > 30) {
      signals.push({
        type: 'CRISIS',
        level: 'CRITICAL',
        message: `Кризисный сигнал: Gold/Oil = ${ratio.toFixed(2)} (>25), VIX = ${vixValue} (>30)`,
        gold: goldPrice,
        oil: oilPrice,
        vix: vixValue,
        ratio: ratio
      });
    } else if (ratio > 20 && vixValue > 25) {
      signals.push({
        type: 'WARNING',
        level: 'HIGH',
        message: `Предупреждение: Gold/Oil = ${ratio.toFixed(2)} (>20), VIX = ${vixValue} (>25)`,
        gold: goldPrice,
        oil: oilPrice,
        vix: vixValue,
        ratio: ratio
      });
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      signals: signals,
      metrics: { gold: goldPrice, oil: oilPrice, vix: vixValue, ratio: ratio }
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
