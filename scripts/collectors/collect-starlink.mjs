#!/usr/bin/env node

// ============================================================
// COLLECT-STARLINK.MJS — Сбор данных о спутниках Starlink
// Источник: Демо-данные (орбитальные позиции)
// ============================================================

import fs from 'fs/promises';
import path from 'path';

const SATS = [
    { name: 'Starlink-1001', lat: 53.0, lng: -80.0 },
    { name: 'Starlink-1002', lat: 45.0, lng: -120.0 },
    { name: 'Starlink-1003', lat: 30.0, lng: -100.0 },
    { name: 'Starlink-1004', lat: 20.0, lng: -60.0 },
    { name: 'Starlink-1005', lat: -15.0, lng: -40.0 },
    { name: 'Starlink-1006', lat: -30.0, lng: -20.0 },
    { name: 'Starlink-1007', lat: 40.0, lng: 80.0 },
    { name: 'Starlink-1008', lat: 35.0, lng: 120.0 },
    { name: 'Starlink-1009', lat: 25.0, lng: 150.0 },
    { name: 'Starlink-1010', lat: -20.0, lng: 140.0 },
    { name: 'Starlink-1011', lat: 55.0, lng: 10.0 },
    { name: 'Starlink-1012', lat: 50.0, lng: -10.0 },
    { name: 'Starlink-1013', lat: 60.0, lng: -50.0 },
    { name: 'Starlink-1014', lat: 65.0, lng: -30.0 },
    { name: 'Starlink-1015', lat: 70.0, lng: 0.0 },
    { name: 'Starlink-1016', lat: 75.0, lng: 20.0 },
    { name: 'Starlink-1017', lat: 80.0, lng: 40.0 },
    { name: 'Starlink-1018', lat: 85.0, lng: 60.0 }
];

async function main() {
    console.log('\n🛰️ СБОР ДАННЫХ О STARLINK\n');
    
    const outputPath = path.join(process.cwd(), 'data', 'basket', 'starlink.json');
    
    const data = {
        success: true,
        data: {
            features: SATS.map(sat => ({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [sat.lng, sat.lat]
                },
                properties: {
                    name: sat.name,
                    type: 'starlink',
                    status: 'active',
                    severity: 'low'
                }
            }))
        },
        metadata: {
            total: SATS.length,
            updated: new Date().toISOString(),
            source: 'Starlink constellation data (approximate)'
        }
    };
    
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    
    console.log(`✅ Сохранено ${SATS.length} спутников Starlink в ${outputPath}`);
}

main().catch(console.error);
