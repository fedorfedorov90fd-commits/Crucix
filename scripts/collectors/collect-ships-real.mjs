#!/usr/bin/env node

// ============================================================
// COLLECT-SHIPS-REAL.MJS — Сбор данных о судах (AIS)
// Использует демо-данные, т.к. AIS API платные
// ============================================================

import fs from 'fs/promises';
import path from 'path';

// Демо-данные (координаты крупных портов)
const SHIPS = [
  { name: 'CMA CGM Alexander', imo: '1234567', lat: 30.0, lng: -80.0, type: 'container' },
  { name: 'MSC Anna', imo: '2345678', lat: 35.0, lng: -75.0, type: 'container' },
  { name: 'Maersk Sofia', imo: '3456789', lat: 40.0, lng: -70.0, type: 'container' },
  { name: 'COSCO Hope', imo: '4567890', lat: 45.0, lng: -65.0, type: 'container' },
  { name: 'Ever Given', imo: '5678901', lat: 25.0, lng: -60.0, type: 'container' },
  { name: 'HMM Rotterdam', imo: '6789012', lat: 20.0, lng: -55.0, type: 'container' },
  { name: 'ONE Trust', imo: '7890123', lat: 15.0, lng: -50.0, type: 'container' },
  { name: 'Yang Ming Wisdom', imo: '8901234', lat: 10.0, lng: -45.0, type: 'container' },
  { name: 'ZIM Constanta', imo: '9012345', lat: 5.0, lng: -40.0, type: 'container' },
  { name: 'MOL Triumph', imo: '0123456', lat: 0.0, lng: -35.0, type: 'container' },
];

async function main() {
  console.log('\n🚢 СБОР ДАННЫХ О СУДАХ (AIS)\n');
  const outputPath = path.join(process.cwd(), 'data', 'basket', 'ships.json');
  const data = {
    type: 'FeatureCollection',
    features: SHIPS.map(ship => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [ship.lng, ship.lat]
      },
      properties: {
        name: ship.name,
        imo: ship.imo,
        type: ship.type,
        severity: 'low'
      }
    }))
  };
  await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
  console.log(`✅ Сохранено ${SHIPS.length} судов в ${outputPath}`);
}

main().catch(console.error);
