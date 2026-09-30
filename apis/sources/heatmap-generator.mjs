/**
 * heatmap-generator.mjs — Генератор тепловых карт
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';

const BASKET_DIR = '/home/ta8_/Рабочий стол/Crucix/data/basket';

function loadLayerData(layerId) {
  if (!existsSync(BASKET_DIR)) return null;
  const files = readdirSync(BASKET_DIR);
  const pattern = new RegExp(`^${layerId}[.-]`);
  for (const file of files) {
    if (pattern.test(file)) {
      try {
        const data = readFileSync(join(BASKET_DIR, file), 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : (parsed.data || []);
      } catch (e) {
        return null;
      }
    }
  }
  return null;
}

export function generateHeatmap(layerId, options = {}) {
  const { resolution = 10 } = options;

  const data = loadLayerData(layerId);
  if (!data || data.length === 0) {
    return { success: false, error: 'Нет данных' };
  }

  const points = [];
  for (const item of data) {
    const lat = parseFloat(item.lat || item.latitude || 0);
    const lng = parseFloat(item.lng || item.longitude || 0);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      points.push({ lat, lng, weight: item.weight || item.confidence || 0.5 });
    }
  }

  if (points.length === 0) {
    return { success: false, error: 'Нет точек с координатами' };
  }

  // Вычисляем границы
  let minLat = Infinity, maxLat = -Infinity;
  let minLng = Infinity, maxLng = -Infinity;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  const latStep = (maxLat - minLat) / resolution || 1;
  const lngStep = (maxLng - minLng) / resolution || 1;

  const grid = [];
  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      grid.push({
        lat: minLat + i * latStep + latStep / 2,
        lng: minLng + j * lngStep + lngStep / 2,
        weight: 0,
        count: 0
      });
    }
  }

  for (const point of points) {
    let best = null, bestDist = Infinity;
    for (const g of grid) {
      const dist = Math.sqrt(Math.pow(g.lat - point.lat, 2) + Math.pow(g.lng - point.lng, 2));
      if (dist < bestDist) { bestDist = dist; best = g; }
    }
    if (best) { best.weight += point.weight; best.count++; }
  }

  const maxWeight = Math.max(...grid.map(g => g.weight), 1);
  for (const g of grid) g.weight = g.weight / maxWeight;

  const heatmap = {
    type: 'heatmap',
    layerId,
    resolution,
    points: grid.filter(g => g.weight > 0.01),
    stats: { totalPoints: points.length, gridCells: grid.length, activeCells: grid.filter(g => g.weight > 0.01).length }
  };

  return { success: true, heatmap };
}

export function getHeatmapForMap(layerId, zoom = 10) {
  const resolution = Math.min(20, Math.max(5, Math.floor(zoom / 2)));
  const result = generateHeatmap(layerId, { resolution });
  if (!result.success) return result;

  const formatted = {
    type: 'FeatureCollection',
    features: result.heatmap.points.map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { weight: p.weight, count: p.count, intensity: p.weight * 10 }
    }))
  };

  return { success: true, heatmap: formatted, stats: result.heatmap.stats, layerId };
}

export default {
  generateHeatmap,
  getHeatmapForMap
};
