#!/usr/bin/env node
import fs from 'fs';

// === ОРБИТАЛЬНЫЕ ГРУППИРОВКИ ===
const groups = [
    { name: 'Starlink',     count: 50, altitude: 550,  inclination: 53.0,  color: '#44ff44', owner: 'SpaceX',     type: 'comm' },
    { name: 'GPS',          count: 24, altitude: 20200, inclination: 55.0,  color: '#44aaff', owner: 'USAF',      type: 'nav' },
    { name: 'OneWeb',       count: 20, altitude: 1200, inclination: 87.9,  color: '#aaff44', owner: 'OneWeb',    type: 'comm' },
    { name: 'GLONASS',      count: 12, altitude: 19100, inclination: 64.8,  color: '#ff4444', owner: 'Россия',    type: 'nav' },
    { name: 'BeiDou',       count: 8,  altitude: 21500, inclination: 55.0,  color: '#ffaa00', owner: 'Китай',     type: 'nav' },
    { name: 'Recon',        count: 6,  altitude: 800,  inclination: 97.6,  color: '#ff00ff', owner: 'разведка',  type: 'recon' }
];

// === ВЫЧИСЛЕНИЕ ПОЗИЦИИ НА ОРБИТЕ ===
function calcPosition(altitude, inclination, phase, offset) {
    const a = 6371 + altitude; // радиус орбиты
    const inc = inclination * Math.PI / 180;
    const t = phase + offset;

    // Положение на круговой орбите
    const argLat = t;
    const x0 = a * Math.cos(argLat);
    const y0 = a * Math.sin(argLat);

    // Наклон орбиты
    const x = x0;
    const y = y0 * Math.cos(inc);
    const z = y0 * Math.sin(inc);

    // Поворот по долготе (RAAN — разных плоскостей)
    const raan = offset * 0.8;
    const xr = x * Math.cos(raan) - y * Math.sin(raan);
    const yr = x * Math.sin(raan) + y * Math.cos(raan);
    const zr = z;

    // В географические координаты
    const lat = Math.asin(zr / a) * 180 / Math.PI;
    const lon = Math.atan2(yr, xr) * 180 / Math.PI;

    return { lat, lon, altitude };
}

// === ГЕНЕРАЦИЯ ===
const features = [];
let id = 0;

for (const group of groups) {
    const planes = Math.min(group.count, 6); // число орбитальных плоскостей
    const perPlane = Math.ceil(group.count / planes);

    for (let p = 0; p < planes; p++) {
        for (let s = 0; s < perPlane; s++) {
            if (id >= group.count) break;

            const phase = (s / perPlane) * 2 * Math.PI;
            const offset = (p / planes) * 2 * Math.PI;
            const pos = calcPosition(group.altitude, group.inclination, phase, offset);

            const satName = `${group.name}-${String(id + 1).padStart(3, '0')}`;

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [pos.lon, pos.lat]
                },
                properties: {
                    label: satName,
                    region: group.owner,
                    country: group.owner,
                    constellation: group.name,
                    orbitType: group.type === 'comm' ? 'Коммуникации' :
                               group.type === 'nav' ? 'Навигация' : 'Разведка',
                    altitude: pos.altitude,
                    inclination: group.inclination,
                    value: group.type === 'recon' ? 28 :
                           group.type === 'nav' ? 22 : 18,
                    icon: group.type === 'comm' ? '🛰️' :
                          group.type === 'nav' ? '🛰️' : '🕵️',
                    timestamp: new Date().toISOString()
                }
            });
            id++;
        }
        id = 0;
    }
    id += group.count;
}

// Сбрасываем id для следующей группы
let totalId = 0;
const allFeatures = [];
for (const group of groups) {
    const planes = Math.min(group.count, 6);
    const perPlane = Math.ceil(group.count / planes);
    let localId = 0;

    for (let p = 0; p < planes; p++) {
        for (let s = 0; s < perPlane; s++) {
            if (localId >= group.count) break;

            const phase = (s / perPlane) * 2 * Math.PI;
            const offset = (p / planes) * 2 * Math.PI;
            const pos = calcPosition(group.altitude, group.inclination, phase, offset);

            const satName = `${group.name}-${String(totalId + 1).padStart(3, '0')}`;

            allFeatures.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [pos.lon, pos.lat]
                },
                properties: {
                    label: satName,
                    region: group.owner,
                    country: group.owner,
                    constellation: group.name,
                    orbitType: group.type === 'comm' ? 'Коммуникации' :
                               group.type === 'nav' ? 'Навигация' : 'Разведка',
                    altitude: pos.altitude,
                    inclination: group.inclination,
                    value: group.type === 'recon' ? 28 :
                           group.type === 'nav' ? 22 : 18,
                    icon: group.type === 'comm' ? '🛰️' :
                          group.type === 'nav' ? '🛰️' : '🕵️',
                    timestamp: new Date().toISOString()
                }
            });
            localId++;
            totalId++;
        }
    }
}

const geojson = { type: 'FeatureCollection', features: allFeatures };
fs.writeFileSync('crucix-satellites.json', JSON.stringify(geojson, null, 2), 'utf-8');
console.log(`✅ crucix-satellites.json: ${allFeatures.length} объектов`);

// Статистика
const byGroup = {};
allFeatures.forEach(f => {
    const g = f.properties.constellation;
    byGroup[g] = (byGroup[g] || 0) + 1;
});
console.log('   По группировкам:', byGroup);
