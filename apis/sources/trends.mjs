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
    
    // Группируем по дням
    const dailyCVE = {};
    const dailyNews = {};
    
    cves.forEach(cve => {
      const date = cve.timestamp ? new Date(cve.timestamp).toISOString().split('T')[0] : 'unknown';
      if (!dailyCVE[date]) dailyCVE[date] = 0;
      dailyCVE[date] += 1;
    });
    
    news.forEach(item => {
      const date = item.timestamp ? new Date(item.timestamp).toISOString().split('T')[0] : 'unknown';
      if (!dailyNews[date]) dailyNews[date] = 0;
      dailyNews[date] += 1;
    });
    
    // Сортируем даты
    const dates = [...new Set([...Object.keys(dailyCVE), ...Object.keys(dailyNews)])].sort();
    
    // Строим тренды
    const trends = dates.map(date => ({
      date,
      cves: dailyCVE[date] || 0,
      news: dailyNews[date] || 0,
      total: (dailyCVE[date] || 0) + (dailyNews[date] || 0)
    }));
    
    // Вычисляем скользящее среднее (7 дней)
    const trendWithMA = trends.map((t, i) => {
      const window = trends.slice(Math.max(0, i - 6), i + 1);
      const avgCVE = window.reduce((s, w) => s + w.cves, 0) / window.length;
      const avgNews = window.reduce((s, w) => s + w.news, 0) / window.length;
      return {
        ...t,
        ma_cves: Math.round(avgCVE * 10) / 10,
        ma_news: Math.round(avgNews * 10) / 10
      };
    });
    
    // Прогноз на основе тренда
    const last = trendWithMA[trendWithMA.length - 1] || { cves: 0, news: 0 };
    const future = {
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      predicted_cves: Math.round(last.ma_cves * 1.1),
      predicted_news: Math.round(last.ma_news * 1.05)
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      timestamp: new Date().toISOString(),
      trends: trendWithMA,
      summary: {
        total_days: trends.length,
        avg_daily_cves: trends.reduce((s, t) => s + t.cves, 0) / trends.length || 0,
        avg_daily_news: trends.reduce((s, t) => s + t.news, 0) / trends.length || 0,
        max_cves_day: trends.reduce((max, t) => t.cves > max.cves ? t : max, trends[0] || { date: 'none', cves: 0 }),
        max_news_day: trends.reduce((max, t) => t.news > max.news ? t : max, trends[0] || { date: 'none', news: 0 })
      },
      forecast: future
    }));
  } catch(e) {
    res.writeHead(500);
    res.end(JSON.stringify({ error: e.message }));
  }
}
