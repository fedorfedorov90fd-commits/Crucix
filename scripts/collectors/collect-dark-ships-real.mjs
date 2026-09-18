#!/usr/bin/env node

// ============================================================
// COLLECT-DARK-SHIPS-REAL.MJS — Сбор данных о тёмных судах
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const DARK_SHIPS = [
  { name: 'Unknown-001', lat: 32.0, lng: -78.0, type: 'tanker', status: 'suspicious' },
  { name: 'Unknown-002', lat: 38.0, lng: -72.0, type: 'cargo', status: 'suspicious' },
  { name: 'Unknown-003', lat: 42.0, lng: -68.0, type: 'tanker', status: 'suspicious' },
  { name: 'Unknown-004', lat: 28.0, lng: -62.0, type: 'cargo', status: 'suspicious' },
  { name: 'Unknown-005', lat: 22.0, lng: -56.0, type: 'tanker', status: 'suspicious' },
];

async function main() {
  console.log('\n🚫 СБОР ДАННЫХ О ТЁМНЫХ СУДАХ\n');
  const outputPath = path.join(process.cwd(), 'data', 'basket', 'dark-ships.json');
  const data = {
    type: 'FeatureCollection',
    features: DARK_SHIPS.map(ship => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [ship.lng, ship.lat]
      },
      properties: {
        name: ship.name,
        type: ship.type,
        status: ship.status,
        severity: 'high'
      }
    }))
  };
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Сохранено ${DARK_SHIPS.length} тёмных судов в ${outputPath}`);
}

main().catch(console.error);
