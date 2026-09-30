// ============================================================
// LAYER-MANAGER INDEX — Сборка всех слоев (с поддержкой choropleth)
// ============================================================
// Всего слоев: 121
// ============================================================

import { militaryLayers } from './military.mjs';
import { financialLayers } from './financial.mjs';
import { ecologicalLayers } from './ecological.mjs';
import { infrastructureLayers } from './infrastructure.mjs';
import { socialLayers } from './social.mjs';
import { spaceLayers } from './space.mjs';
import { cyberLayers } from './cyber.mjs';
import { newsLayers } from './news.mjs';
import { energyLayers } from './energy.mjs';
import { maritimeLayers } from './maritime.mjs';
import { transportLayers } from './transport.mjs';
import { healthLayers } from './health.mjs';
import { economicLayers } from './economic.mjs';
import { otherLayers } from './other.mjs';

// ============================================================
// ОБЪЕДИНЯЕМ ВСЕ СЛОИ
// ============================================================
export const LAYER_REGISTRY = {
  ...militaryLayers,
  ...financialLayers,
  ...ecologicalLayers,
  ...infrastructureLayers,
  ...socialLayers,
  ...spaceLayers,
  ...cyberLayers,
  ...newsLayers,
  ...energyLayers,
  ...maritimeLayers,
  ...transportLayers,
  ...healthLayers,
  ...economicLayers,
  ...otherLayers
};

// ============================================================
// ФУНКЦИИ ЗАГРУЗКИ И ОБРАБОТКИ
// ============================================================
import { promises as fs } from 'fs';
import { join } from 'path';

const BASKET_DIR = join(process.cwd(), 'data', 'basket');

export async function loadLayerData(layerName) {
  if (!LAYER_REGISTRY[layerName]) {
    return { error: `Слой "${layerName}" не найден в реестре`, status: 404 };
  }

  const layerMeta = LAYER_REGISTRY[layerName];
  const vizType = layerMeta.visualizationType || 'marker';

  const filePaths = [
    join(BASKET_DIR, `${layerName}.json`),
    join(BASKET_DIR, `${layerName}.geojson`),
    join(BASKET_DIR, `${layerName}-latest.json`),
    join(BASKET_DIR, `${layerName}-data.json`)
  ];

  let rawData = null;
  for (const filePath of filePaths) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      rawData = JSON.parse(content);
      break;
    } catch (err) {}
  }

  if (!rawData) {
    return {
      type: 'FeatureCollection',
      features: [],
      _meta: { layer: layerName, note: 'Данные отсутствуют' }
    };
  }

  // ============================================================
  // ЕСЛИ СЛОЙ — CHOROPLETH
  // ============================================================
  if (vizType === 'choropleth') {
    let features = [];

    // Попытка извлечь данные из разных структур

    // 1. { data: { entities: [...] } } (например, ofac)
    if (rawData.data && rawData.data.entities && Array.isArray(rawData.data.entities)) {
      features = rawData.data.entities.map(item => ({
        type: 'Feature',
        properties: {
          name: item.country || item.name || 'Unknown',
          value: item.sanctions ? item.sanctions.length : 1,
          ...item
        }
      }));
    }
    // 2. Массив объектов с country и value
    else if (Array.isArray(rawData)) {
      features = rawData.map(item => ({
        type: 'Feature',
        properties: {
          name: item.country || item.name || 'Unknown',
          value: item.value || item.price || item.ratio || 0,
          ...item
        }
      }));
    }
    // 3. { data: [ { country, value } ] }
    else if (rawData.data && Array.isArray(rawData.data)) {
      features = rawData.data.map(item => ({
        type: 'Feature',
        properties: {
          name: item.country || item.name || 'Unknown',
          value: item.value || item.price || item.ratio || 0,
          ...item
        }
      }));
    }
    // 4. { features: [...] } (уже GeoJSON)
    else if (rawData.features && Array.isArray(rawData.features)) {
      features = rawData.features;
    }
    // 5. Если есть data.countries или data[0].country
    else if (rawData.countries && Array.isArray(rawData.countries)) {
      features = rawData.countries.map(item => ({
        type: 'Feature',
        properties: {
          name: item.country || item.name || 'Unknown',
          value: item.value || 0,
          ...item
        }
      }));
    }

    // Фильтруем записи без имени страны
    features = features.filter(f => f.properties && f.properties.name && f.properties.name !== 'Unknown');

    return {
      type: 'FeatureCollection',
      features: features,
      _meta: {
        layer: layerName,
        total: features.length,
        visualizationType: 'choropleth'
      }
    };
  }

  // ============================================================
  // ДЛЯ МАРКЕРОВ (стандартная логика)
  // ============================================================
  // Если уже FeatureCollection
  if (rawData.type === 'FeatureCollection') {
    return rawData;
  }

  if (Array.isArray(rawData)) {
    const features = rawData.map(item => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [item.lng || item.lon || 0, item.lat || 0]
      },
      properties: {
        name: item.name || item.title || 'Событие',
        description: item.description || item.summary || '',
        severity: item.severity || item.status || 'medium',
        timestamp: item.timestamp || item.date || new Date().toISOString()
      }
    })).filter(f => f.geometry.coordinates[0] !== 0 || f.geometry.coordinates[1] !== 0);

    return {
      type: 'FeatureCollection',
      features: features,
      _meta: { layer: layerName, visualizationType: 'marker' }
    };
  }

  // Одиночный объект
  return {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [rawData.lng || rawData.lon || 0, rawData.lat || 0]
      },
      properties: {
        name: rawData.name || rawData.title || 'Событие',
        description: rawData.description || rawData.summary || '',
        severity: rawData.severity || rawData.status || 'medium',
        timestamp: rawData.timestamp || rawData.date || new Date().toISOString()
      }
    }]
  };
}

export async function handleLayerAPI(req, res, pathname) {
  const parts = pathname.split('/').filter(p => p);
  if (parts.length < 3 || parts[0] !== 'api' || parts[1] !== 'layers') {
    return false;
  }

  const layerName = parts[2];
  const data = await loadLayerData(layerName);

  if (data.error) {
    res.writeHead(data.status || 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: data.error, status: data.status || 404 }));
    return true;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    layer: layerName,
    data: data,
    meta: LAYER_REGISTRY[layerName] || {}
  }));
  return true;
}

export async function handleLayersListAPI(req, res) {
  const layers = Object.entries(LAYER_REGISTRY).map(([key, value], index) => ({
    id: key,
    number: String(index + 1).padStart(3, '0'),
    ...value
  }));

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    success: true,
    total: layers.length,
    layers: layers
  }));
  return true;
}

export default {
  LAYER_REGISTRY,
  loadLayerData,
  handleLayerAPI,
  handleLayersListAPI
};
