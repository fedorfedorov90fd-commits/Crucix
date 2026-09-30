// apis/sources/satellite.mjs
// Спутниковая аналитика для Crucix: Sentinel-2, Landsat 8/9, Sentinel-1 SAR
// Change detection + YOLOv8-детекция + Radar Interference Tracker
// 28-й источник данных Crucix
//
// Применение в Crucix:
//   Мультиспектральный change detection по NDVI/NDBI/NDWI,
//   детекция объектов через YOLOv8 (Python-сервис на :8090),
//   обнаружение военных радаров по SAR-помехам Sentinel-1.
//   Алерты интегрируются в dashboard через /api/layers/satellite.
//
// Регионы мониторинга: Чёрное море, Средиземноморье, Балтика,
//   Калининград, Курилы, Арктика.

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- КОНФИГУРАЦИЯ СПУТНИКОВ ------------------------

const SATELLITES = {
  sentinel2: {
    resolution: 10, // метров
    revisitDays: 5,
    bands: ['B02','B03','B04','B08','B11','B12'],
    source: 'ESA Copernicus',
    freeAccess: true,
    api: 'https://scihub.copernicus.eu/dhus',
  },
  landsat89: {
    resolution: 15, // PAN band
    revisitDays: 16,
    bands: ['B1','B2','B3','B4','B5','B6','B7'],
    source: 'USGS EarthExplorer',
    freeAccess: true,
    api: 'https://earthexplorer.usgs.gov',
  },
  sentinel1: {
    resolution: 10, // IW mode
    revisitDays: 6,
    polarization: 'VV+VH',
    source: 'ESA Copernicus',
    freeAccess: true,
    type: 'SAR',
    api: 'https://scihub.copernicus.eu/dhus',
  },
};

// --- РЕГИОНЫ МОНИТОРИНГА ---------------------------

const MONITORED_AOIS = [
  { id: 'black_sea',     name: 'Чёрное море',       bbox: [30.5, 41.0, 42.0, 47.5], type: 'naval' },
  { id: 'mediterranean', name: 'Средиземноморье',   bbox: [-5.0, 30.0, 36.0, 46.0], type: 'naval' },
  { id: 'baltic',        name: 'Балтика',            bbox: [9.0, 53.0, 30.5, 66.0],  type: 'naval' },
  { id: 'kaliningrad',   name: 'Калининград',        bbox: [19.5, 54.0, 23.0, 55.5], type: 'ground' },
  { id: 'kuril',         name: 'Курилы',             bbox: [145.0, 43.0, 156.0, 50.0], type: 'ground' },
  { id: 'arctic',        name: 'Арктика',            bbox: [20.0, 70.0, 180.0, 85.0], type: 'ground' },
];

// --- DETECTION -------------------------------------

/**
 * Результат детекции объекта на спутниковом снимке
 * @typedef {Object} Detection
 * @property {string} type — ship | aircraft | vehicle | building | radar | runway
 * @property {number} confidence — 0..1
 * @property {[number, number]} bbox — [x, y, w, h] в пикселях
 * @property {[number, number]} geoCoords — [lat, lon]
 * @property {number} lengthM — длина в метрах (если определена)
 */

/**
 * Параметры детекции объектов по спутниковым снимкам
 * (в продакшене — вызов Python-сервиса с YOLOv8)
 */
const DETECTION_CLASSES = {
  ship:      { minLength: 15,  maxLength: 400, colorHint: ['gray','dark'] },
  aircraft:  { minLength: 8,   maxLength: 70,  colorHint: ['white','gray'] },
  vehicle:   { minLength: 3,   maxLength: 12,  colorHint: ['green','dark','sand'] },
  building:  { minLength: 5,   maxLength: 200, colorHint: ['gray','brown'] },
  radar:     { minLength: 3,   maxLength: 30,  colorHint: ['white','bright'], sarOnly: true },
  runway:    { minLength: 500, maxLength: 4000, colorHint: ['dark','gray'] },
};

// --- CHANGE DETECTION ------------------------------

/**
 * Сравнение двух снимков: обнаружение изменений.
 * Защита от ragged-массивов и битых пикселей.
 * @param {Object} before — { ndvi: number[][], timestamp, geoTransform }
 * @param {Object} after — { ndvi: number[][], timestamp, geoTransform }
 * @param {Object} thresholds
 * @returns {Object} — список изменений
 */
function detectChanges(before, after, thresholds = {}) {
  const {
    ndviThreshold = 0.15,
    minAreaPixels = 50,
    maxAreaPixels = 100000,
  } = thresholds;

  if (!before || !after || !before.ndvi || !after.ndvi) return { changes: [] };
  if (!Array.isArray(before.ndvi) || !Array.isArray(after.ndvi)) return { changes: [] };

  const rows = Math.min(before.ndvi.length, after.ndvi.length);
  const cols = Math.min(before.ndvi[0]?.length || 0, after.ndvi[0]?.length || 0);

  const changeMask = [];
  for (let r = 0; r < rows; r++) {
    changeMask[r] = [];
    for (let c = 0; c < cols; c++) {
      const bVal = before.ndvi[r]?.[c];
      const aVal = after.ndvi[r]?.[c];
      if (!Number.isFinite(bVal) || !Number.isFinite(aVal)) {
        changeMask[r][c] = 0;
        continue;
      }
      const diff = Math.abs(aVal - bVal);
      changeMask[r][c] = diff > ndviThreshold ? diff : 0;
    }
  }

  // Кластеризация изменений (connected components)
  const clusters = findConnectedComponents(changeMask, minAreaPixels);

  const changes = clusters
    .filter(c => c.area >= minAreaPixels && c.area <= maxAreaPixels)
    .map(c => ({
      area: c.area,
      centroid: c.centroid,
      avgChange: c.avgValue,
      type: classifyChange(c.avgValue, c.area),
      severity: Math.min(1, c.avgValue / 0.5),
      coordinates: pixelToGeo(c.centroid, before.geoTransform),
    }));

  return { changes, totalChangedArea: changes.reduce((s, c) => s + c.area, 0) };
}

function findConnectedComponents(mask, minSize) {
  if (!Array.isArray(mask) || mask.length === 0) return [];
  const rows = mask.length;
  const cols = mask[0]?.length || 0;
  if (cols === 0) return [];

  const visited = Array(rows).fill(null).map(() => Array(cols).fill(false));
  const clusters = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (mask[r][c] > 0 && !visited[r][c]) {
        const cluster = floodFill(mask, visited, r, c, minSize);
        if (cluster) clusters.push(cluster);
      }
    }
  }
  return clusters;
}

/**
 * BFS-заливка с индексным указателем головы очереди.
 * Исходный вариант использовал queue.shift() — O(n^2) на больших кластерах.
 * Индексный указатель даёт O(n).
 */
function floodFill(mask, visited, startR, startC, minSize) {
  if (!mask[0]) return null;
  const cols = mask[0].length;

  const queueR = [startR];
  const queueC = [startC];
  let head = 0;

  let area = 0, sumR = 0, sumC = 0, sumVal = 0;

  while (head < queueR.length) {
    const r = queueR[head];
    const c = queueC[head];
    head++;

    if (r < 0 || r >= mask.length || c < 0 || c >= cols) continue;
    if (visited[r][c] || mask[r][c] === 0) continue;

    visited[r][c] = true;
    area++;
    sumR += r;
    sumC += c;
    sumVal += mask[r][c];

    queueR.push(r-1, r+1, r, r);
    queueC.push(c, c, c-1, c+1);
  }

  if (area < minSize) return null;
  return { area, centroid: [sumR/area, sumC/area], avgValue: sumVal/area };
}

function classifyChange(avgChange, area) {
  if (avgChange > 0.4 && area > 1000) return 'major_construction';
  if (avgChange > 0.3 && area > 500) return 'military_activity';
  if (avgChange > 0.2 && area > 200) return 'vehicle_movement';
  if (avgChange > 0.15) return 'minor_change';
  return 'negligible';
}

function pixelToGeo(centroid, geoTransform) {
  if (!geoTransform || !Array.isArray(centroid)) return [0, 0];
  const [r, c] = centroid;
  const lon = geoTransform.xOrigin + c * geoTransform.pixelWidth;
  const lat = geoTransform.yOrigin - r * geoTransform.pixelHeight;
  return [lat, lon];
}

// --- RADAR INTERFERENCE TRACKER --------------------

/**
 * Обнаружение активных военных радаров через SAR-помехи (Sentinel-1).
 * Радары создают интерференционные полосы на SAR-снимках.
 * Защита от ragged-массивов через Number.isFinite.
 */
function detectRadarInterference(sarImage, baselineNoise = 0.1) {
  if (!sarImage || !sarImage.data) return { detected: false, sources: [] };

  const { data, rows, cols } = sarImage;
  if (!Array.isArray(data) || !Number.isFinite(rows) || !Number.isFinite(cols)) {
    return { detected: false, sources: [] };
  }

  const sources = [];
  const windowSize = 20; // скользящее окно

  for (let r = 0; r < rows - windowSize; r += windowSize) {
    for (let c = 0; c < cols - windowSize; c += windowSize) {
      // Вычисление локального SNR
      let signalPower = 0, noisePower = 0;
      for (let i = 0; i < windowSize; i++) {
        for (let j = 0; j < windowSize; j++) {
          const val = data[r + i]?.[c + j];
          if (!Number.isFinite(val)) continue;
          if (val > baselineNoise * 3) signalPower += val;
          else noisePower += val;
        }
      }
      const snr = signalPower / (noisePower + 1e-10);

      if (snr > 5) { // порог обнаружения помех
        sources.push({
          row: r + windowSize / 2,
          col: c + windowSize / 2,
          snr,
          confidence: Math.min(1, snr / 10),
          type: 'active_radar',
        });
      }
    }
  }

  return {
    detected: sources.length > 0,
    sourceCount: sources.length,
    sources,
    timestamp: sarImage.timestamp || new Date().toISOString(),
  };
}

// --- АЛЕРТЫ ----------------------------------------

/**
 * Генерация алертов на основе спутниковых данных.
 * Защита от null-массивов и null-полей.
 */
function generateSatelliteAlerts(detections, changes, radarInterference) {
  const alerts = [];
  const dets = Array.isArray(detections) ? detections : [];
  const chs = Array.isArray(changes) ? changes : [];
  const radar = radarInterference || { detected: false };

  // Обнаружение объектов
  for (const det of dets) {
    if (!det || typeof det !== 'object') continue;

    if (det.type === 'ship' && det.confidence > 0.7) {
      const len = Number.isFinite(det.lengthM) ? det.lengthM.toFixed(0) : '?';
      alerts.push({
        type: 'naval_activity',
        severity: det.lengthM > 100 ? 'high' : 'medium',
        message: `Обнаружено судно (${len}м) в районе ${(det.geoCoords || []).join(', ')}`,
        coordinates: det.geoCoords,
        confidence: det.confidence,
      });
    }
    if (det.type === 'aircraft' && det.confidence > 0.7) {
      alerts.push({
        type: 'air_activity',
        severity: 'high',
        message: `Обнаружен летательный аппарат в районе ${(det.geoCoords || []).join(', ')}`,
        confidence: det.confidence,
      });
    }
  }

  // Изменения
  for (const ch of chs) {
    if (!ch || typeof ch !== 'object') continue;

    if (ch.type === 'military_activity' || ch.type === 'major_construction') {
      alerts.push({
        type: 'ground_change',
        severity: ch.severity > 0.6 ? 'high' : 'medium',
        message: `${ch.type}: ${ch.area} пикс. изменений в районе ${(ch.coordinates || []).join(', ')}`,
        coordinates: ch.coordinates,
      });
    }
  }

  // Радарные помехи
  if (radar.detected) {
    alerts.push({
      type: 'radar_interference',
      severity: 'high',
      message: `Обнаружена активность радаров: ${radar.sourceCount} источников`,
      confidence: radar.sources?.[0]?.confidence || 0.5,
    });
  }

  return alerts;
}

// --- ИНТЕГРАЦИЯ С CRUCIX ---------------------------

/**
 * Главный модуль-источник: спутниковая аналитика
 * @returns {Object} — данные для latest.json
 */
export async function fetchSatelliteData() {
  const results = {
    timestamp: new Date().toISOString(),
    source: 'satellite',
    monitoredAOIs: MONITORED_AOIS.length,
    satellites: Object.keys(SATELLITES),
    detections: [],
    changes: [],
    radarInterference: null,
    alerts: [],
  };

  // В реальном режиме — вызов Python-сервиса (port 8090) для YOLOv8-детекции
  // Здесь — заглушка с демонстрационными данными
  try {
    const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8090';
    // const response = await fetch(`${pythonUrl}/satellite/detect`, { ... });
    // const data = await response.json();
    // results.detections = data.detections;
    // results.changes = data.changes;
    // results.radarInterference = data.radar;
  } catch (e) {
    console.error('[satellite] Python service unavailable:', e.message);
  }

  results.alerts = generateSatelliteAlerts(
    results.detections,
    results.changes,
    results.radarInterference
  );

  // Сохранение
  try {
    const dir = join(__dirname, '..', '..', 'runs');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'satellite_latest.json'),
      JSON.stringify(results, null, 2)
    );
  } catch (e) {
    console.error('[satellite] write error:', e.message);
  }

  return results;
}

/**
 * Получение снимков с Copernicus (Sentinel-2 / Landsat).
 */
export async function fetchCopernicusImage(aoiId, satellite = 'sentinel2', dateRange = {}) {
  const aoi = MONITORED_AOIS.find(a => a.id === aoiId);
  if (!aoi) throw new Error(`AOI ${aoiId} not found`);

  const cfg = SATELLITES[satellite];
  if (!cfg) throw new Error(`Satellite ${satellite} not configured`);

  const query = {
    bbox: aoi.bbox,
    satellite,
    startDate: dateRange.start || new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: dateRange.end || new Date().toISOString(),
  };

  // В продакшене: запрос к Copernicus API
  // const response = await fetch(`${cfg.api}/search`, { ... });
  return { query, aoi, status: 'pending_implementation' };
}

/**
 * Получение SAR-снимка Sentinel-1 для детекции радарных помех.
 * Режим IW, поляризация VV+VH.
 */
export async function fetchSentinel1SAR(aoiId, dateRange = {}) {
  const aoi = MONITORED_AOIS.find(a => a.id === aoiId);
  if (!aoi) throw new Error(`AOI ${aoiId} not found`);

  const query = {
    bbox: aoi.bbox,
    satellite: 'sentinel1',
    polarization: SATELLITES.sentinel1.polarization,
    startDate: dateRange.start || new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: dateRange.end || new Date().toISOString(),
  };

  // В продакшене: запрос к Copernicus DHUS + препроцессинг
  return { query, aoi, status: 'pending_implementation' };
}

export {
  SATELLITES,
  MONITORED_AOIS,
  DETECTION_CLASSES,
  detectChanges,
  detectRadarInterference,
  generateSatelliteAlerts,
};
