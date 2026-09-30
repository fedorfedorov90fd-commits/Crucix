/**
 * apis/sources/gold-oil-ratio-api.mjs — API-МОДУЛЬ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/gold-oil-ratio.json.
 * Сборщик: collect-gold-oil-ratio.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.
 */
// ============================================================
// GOLD-OIL-RATIO-API.MJS — API для индекса Золото/Нефть
// ============================================================
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const route  = '/api/layers/gold-oil-ratio';
export const method = 'GET';

export const meta = {
  category: "other",
  icon: "📊",
  color: "#64748b",
  vizType: "marker",
  source: "basket/gold-oil-ratio.json",
  collector: "collect-gold-oil-ratio.mjs",
  cache: 300,
  description: "Слой gold-oil-ratio",
  unit: "records",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'gold-oil.json');

async function loadData() {
    try {
        const content = await fs.readFile(BASKET_PATH, 'utf8');
        let parsed = JSON.parse(content);
  if (parsed && !Array.isArray(parsed) && parsed.schema === 'crucix.basket.v1') {
    parsed = (Array.isArray(parsed.points) && parsed.points.length ? parsed.points
           : Array.isArray(parsed.series) && parsed.series.length ? parsed.series
           : Array.isArray(parsed.regions) ? parsed.regions : []).map(r => {
      const _ex = r.extra || {};
      return { ...r, ..._ex,
        lng: r.lng ?? r.lon, longitude: r.longitude ?? r.lon,
        magnitude: r.magnitude ?? r.value, mag: r.mag ?? r.value,
        severity: r.severity ?? r.value, count: r.count ?? r.value,
        score: r.score ?? r.value, name: r.name ?? r.label,
        title: r.title ?? r.label, place: r.place ?? r.label,
        date: r.date ?? (r.timestamp ? String(r.timestamp).slice(0, 10) : null),
        time: r.time ?? r.timestamp,
        ...(r.lat != null && r.lon != null && !r.bbox ? { bbox: [r.lon, r.lat, r.lon, r.lat] } : {}),
      };
    });
  }
  return parsed;
    } catch (err) {
        console.warn('[GoldOil] ⚠️ Нет данных в корзине');
        return [];
    }
}

export async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    console.log(`[GoldOil] Запрос: ${pathname}`);

    // Все данные
    if (pathname === '/api/gold-oil-ratio/' || pathname === '/api/gold-oil-ratio') {
        const data = await loadData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: data,
            count: data.length,
            lastUpdate: data.length > 0 ? data[data.length-1].date : null
        }));
        return;
    }

    // Статус
    if (pathname === '/api/gold-oil-ratio/status') {
        const data = await loadData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            status: data.length > 0 ? 'online' : 'no_data',
            count: data.length
        }));
        return;
    }

    if (pathname === '/api/layers/gold-oil-ratio') {
        const data = await loadData();
        const features = data.filter(d => d.lat != null && d.lng != null).map(d => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [Number(d.lng), Number(d.lat)] },
            properties: { ...d, lat: undefined, lng: undefined, lon: undefined }
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            type: 'FeatureCollection',
            features,
            metadata: { source: 'basket/gold-oil-ratio.json', count: features.length, total: data.length, timestamp: new Date().toISOString() }
        }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
}
