#!/usr/bin/env node

import { promises as fs } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_DIR = join(__dirname, '..', 'data', 'basket');

// Конвертирует данные из разных источников в единый формат маркеров
async function convertToMarkers() {
    const allMarkers = [];
    
    // 1. NOTAM (уже есть)
    try {
        const notamData = JSON.parse(await fs.readFile(join(BASKET_DIR, 'notam.json'), 'utf-8'));
        if (notamData.features) {
            for (const f of notamData.features) {
                allMarkers.push({
                    name: f.properties.name || 'NOTAM',
                    lat: f.geometry.coordinates[1],
                    lng: f.geometry.coordinates[0],
                    status: f.properties.severity || 'medium',
                    layer: 'notam',
                    description: f.properties.description || ''
                });
            }
        }
    } catch (e) {}

    // 2. FIRMS (пожары)
    try {
        const firmsData = JSON.parse(await fs.readFile(join(BASKET_DIR, 'firms.json'), 'utf-8'));
        if (Array.isArray(firmsData)) {
            // Добавляем случайные координаты для демо
            const regions = {
                'Turkey': { lat: 39.0, lng: 35.0 },
                'Russia': { lat: 60.0, lng: 90.0 },
                'Brazil': { lat: -15.0, lng: -55.0 },
                'Australia': { lat: -25.0, lng: 135.0 },
                'USA': { lat: 40.0, lng: -100.0 }
            };
            for (const item of firmsData.slice(0, 10)) {
                const region = regions[item.region] || { lat: 30 + Math.random() * 30, lng: 30 + Math.random() * 30 };
                allMarkers.push({
                    name: `Пожар в ${item.region || 'регионе'}`,
                    lat: region.lat + (Math.random() - 0.5) * 5,
                    lng: region.lng + (Math.random() - 0.5) * 5,
                    status: item.value > 150 ? 'high' : 'medium',
                    layer: 'fires',
                    description: `${item.fires || 0} очагов, FRP: ${item.frp || 0}`
                });
            }
        }
    } catch (e) {}

    // 3. ACLED (конфликты)
    try {
        const acledData = JSON.parse(await fs.readFile(join(BASKET_DIR, 'acled.json'), 'utf-8'));
        if (Array.isArray(acledData)) {
            const regions = {
                'Ukraine': { lat: 48.4, lng: 31.2 },
                'Syria': { lat: 35.0, lng: 38.0 },
                'Yemen': { lat: 15.5, lng: 48.0 },
                'Palestine': { lat: 31.5, lng: 34.5 },
                'Sudan': { lat: 15.5, lng: 32.5 },
                'Ethiopia': { lat: 9.0, lng: 40.0 },
                'Myanmar': { lat: 21.0, lng: 96.0 },
                'Afghanistan': { lat: 33.0, lng: 65.0 },
                'Somalia': { lat: 6.0, lng: 47.0 },
                'Mali': { lat: 17.0, lng: -3.0 }
            };
            for (const item of acledData.slice(0, 15)) {
                const region = regions[item.region] || { lat: 30 + Math.random() * 30, lng: 30 + Math.random() * 30 };
                const severity = item.value > 70 ? 'critical' : item.value > 50 ? 'high' : 'medium';
                allMarkers.push({
                    name: `${item.type || 'Конфликт'} в ${item.region || 'регионе'}`,
                    lat: region.lat + (Math.random() - 0.5) * 3,
                    lng: region.lng + (Math.random() - 0.5) * 3,
                    status: severity,
                    layer: 'acled',
                    description: `${item.fatalities || 0} погибших, уровень: ${item.value || 0}`
                });
            }
        }
    } catch (e) {}

    // Сохраняем в geo-markers.json
    const outputPath = join(BASKET_DIR, 'geo-markers.json');
    await fs.writeFile(outputPath, JSON.stringify({ markers: allMarkers }, null, 2));
    console.log(`✅ Сохранено ${allMarkers.length} маркеров в ${outputPath}`);
}

convertToMarkers().catch(console.error);
