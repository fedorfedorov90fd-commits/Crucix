/**
 * apis/sources/uranium-api.mjs — API-МОДУЛЬ
 *
 * КОНТРАКТ CRUCIX v2.
 * ИСТОЧНИК: data/basket/uranium.json.
 * Сборщик: collect-uranium.mjs.
 *
 * ФОРМАТЫ: json, csv, stats, raw.
 * ФИЛЬТРЫ: ?limit=, ?since=, ?until=.
 */
// ============================================================
// URANIUM-API.MJS — API для цены урана
// ============================================================

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export const route  = '/api/layers/uranium';
export const method = 'GET';

export const meta = {
  category: "finance",
  icon: "☢️",
  color: "#44ff44",
  vizType: "choropleth",
  source: "basket/uranium.json",
  collector: "collect-uranium.mjs",
  cache: 300,
  description: "Цена урана",
  unit: "records",
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', '..', 'data', 'basket', 'uranium.json');

async function loadData() {
    try {
        const data = await fs.readFile(BASKET_PATH, 'utf8');
        let parsed = JSON.parse(data);
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
    } catch { return []; }
}

export async function handler(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    try {
        const data = await loadData();
        const last = data.length > 0 ? data[data.length - 1] : null;

        if (pathname === '/api/uranium/' || pathname === '/api/uranium') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                success: true,
                count: data.length,
                data: data,
                last: last,
                timestamp: new Date().toISOString()
            }));
            return;
        }


        if (pathname === '/api/layers/uranium') {
            const features = data.filter(d => d.lat != null && d.lng != null).map(d => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [Number(d.lng), Number(d.lat)] },
                properties: { ...d, lat: undefined, lng: undefined, lon: undefined }
            }));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'FeatureCollection',
                features,
                metadata: {
                    source: 'basket/uranium.json',
                    count: features.length,
                    total: data.length,
                    timestamp: new Date().toISOString()
                }
            }));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Unknown endpoint' }));
    } catch (error) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}
