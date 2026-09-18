/**
 * map-layer-vix.mjs
 * API слой для VIX — использует универсальный адаптер
 */

import { loadBasketFeatureCollection } from '../../lib/basket-adapter.mjs';

export default async function handler(req, res) {
  try {
    const data = await loadBasketFeatureCollection('vix');

    // Если данных нет — возвращаем демо
    if (data.features.length === 0) {
      const demo = generateDemoData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(demo));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));

  } catch (err) {
    console.error('[map-layer-vix] Error:', err);
    const demo = generateDemoData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(demo));
  }
}

function generateDemoData() {
  const features = [];
  const exchanges = [
    { name: 'NYSE', lat: 40.7070, lng: -74.0110, region: 'US' },
    { name: 'NASDAQ', lat: 40.7560, lng: -73.9860, region: 'US' },
    { name: 'LSE', lat: 51.5150, lng: -0.0990, region: 'UK' },
    { name: 'Deutsche Börse', lat: 50.1090, lng: 8.6850, region: 'EU' },
    { name: 'TSE', lat: 35.6810, lng: 139.7700, region: 'JAPAN' },
    { name: 'HKEX', lat: 22.2830, lng: 114.1560, region: 'CHINA' },
    { name: 'BSE', lat: 18.9290, lng: 72.8300, region: 'INDIA' },
    { name: 'MOEX', lat: 55.7530, lng: 37.6200, region: 'RUSSIA' },
    { name: 'B3', lat: -23.5500, lng: -46.6330, region: 'BRAZIL' },
    { name: 'ASX', lat: -33.8680, lng: 151.2090, region: 'AUSTRALIA' },
    { name: 'DFM', lat: 25.2048, lng: 55.2708, region: 'MIDDLE_EAST' },
    { name: 'JSE', lat: -26.2041, lng: 28.0473, region: 'AFRICA' }
  ];

  for (const ex of exchanges) {
    const value = 15 + Math.random() * 25;
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [ex.lng, ex.lat]
      },
      properties: {
        value: Math.round(value * 100) / 100,
        timestamp: new Date().toISOString(),
        region: ex.region,
        source: 'demo',
        label: `VIX: ${Math.round(value * 100) / 100}`,
        exchange: ex.name
      }
    });
  }

  return {
    type: 'FeatureCollection',
    features,
    metadata: {
      source: 'DEMO',
      total: features.length,
      timestamp: new Date().toISOString(),
      demo: true
    }
  };
}
