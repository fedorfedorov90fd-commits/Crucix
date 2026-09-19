#!/usr/bin/env node
import fs from 'fs';

// === ГОРОДА-ИСТОЧНИКИ АТАК ===
const sources = [
    { city: 'Москва',          country: 'Россия',      lat: 55.7558, lon: 37.6173 },
    { city: 'Санкт-Петербург', country: 'Россия',      lat: 59.9343, lon: 30.3351 },
    { city: 'Beijing',         country: 'Китай',        lat: 39.9042, lon: 116.4074 },
    { city: 'Shanghai',        country: 'Китай',        lat: 31.2304, lon: 121.4737 },
    { city: 'Pyongyang',       country: 'КНДР',         lat: 39.0392, lon: 125.7625 },
    { city: 'Tehran',          country: 'Иран',         lat: 35.6892, lon: 51.3890 },
    { city: 'Kyiv',            country: 'Украина',      lat: 50.4501, lon: 30.5234 },
    { city: 'Lagos',           country: 'Нигерия',      lat: 6.5244, lon: 3.3792 },
    { city: 'São Paulo',       country: 'Бразилия',     lat: -23.5505, lon: -46.6333 },
    { city: 'Mumbai',          country: 'Индия',        lat: 19.0760, lon: 72.8777 },
    { city: 'Istanbul',        country: 'Турция',      lat: 41.0082, lon: 28.9784 },
    { city: 'Bangkok',         country: 'Таиланд',     lat: 13.7563, lon: 100.5018 },
    { city: 'Jakarta',        country: 'Индонезия',   lat: -6.2088, lon: 106.8456 },
    { city: 'Manila',          country: 'Филиппины',   lat: 14.5995, lon: 120.9842 },
    { city: 'Hanoi',           country: 'Вьетнам',     lat: 21.0285, lon: 105.8542 }
];

// === ГОРОДА-ЦЕЛИ АТАК ===
const targets = [
    { city: 'Washington DC',  country: 'США',         lat: 38.9072, lon: -77.0369 },
    { city: 'New York',        country: 'США',         lat: 40.7128, lon: -74.0060 },
    { city: 'London',          country: 'Великобритания', lat: 51.5074, lon: -0.1278 },
    { city: 'Berlin',          country: 'Германия',    lat: 52.5200, lon: 13.4050 },
    { city: 'Tokyo',           country: 'Япония',       lat: 35.6762, lon: 139.6503 },
    { city: 'Seoul',           country: 'Юж. Корея',   lat: 37.5665, lon: 126.9780 },
    { city: 'Taipei',          country: 'Тайвань',     lat: 25.0330, lon: 121.5654 },
    { city: 'Tel Aviv',        country: 'Израиль',     lat: 32.0853, lon: 34.7818 },
    { city: 'Paris',           country: 'Франция',     lat: 48.8566, lon: 2.3522 },
    { city: 'Amsterdam',       country: 'Нидерланды',  lat: 52.3676, lon: 4.9041 },
    { city: 'Singapore',       country: 'Сингапур',   lat: 1.3521, lon: 103.8198 },
    { city: 'Sydney',          country: 'Австралия',   lat: -33.8688, lon: 151.2093 },
    { city: 'Ottawa',          country: 'Канада',      lat: 45.4215, lon: -75.6972 },
    { city: 'Madrid',          country: 'Испания',     lat: 40.4168, lon: -3.7038 },
    { city: 'Warsaw',          country: 'Польша',      lat: 52.2297, lon: 21.0122 }
];

// === ТИПЫ АТАК ===
const attackTypes = [
    { type: 'DDoS',        icon: '💥', weight: 25, sev: [15, 28] },
    { type: 'Phishing',    icon: '🎣', weight: 20, sev: [10, 20] },
    { type: 'Ransomware',  icon: '🔒', weight: 18, sev: [20, 30] },
    { type: 'Malware',     icon: '💻', weight: 15, sev: [12, 22] },
    { type: 'Botnet',      icon: '🤖', weight: 12, sev: [10, 18] },
    { type: 'Scan',        icon: '🔍', weight: 10, sev: [5, 12] }
];

// === ГЕНЕРАЦИЯ ===
function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted(arr) {
    const total = arr.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * total;
    for (const a of arr) {
        r -= a.weight;
        if (r <= 0) return a;
    }
    return arr[0];
}

const features = [];
const count = 90;
const now = Date.now();

for (let i = 0; i < count; i++) {
    const src = pick(sources);
    const tgt = pick(targets);
    const atk = pickWeighted(attackTypes);
    const sev = atk.sev[0] + Math.random() * (atk.sev[1] - atk.sev[0]);
    const ageMin = Math.floor(Math.random() * 180); // до 3 часов назад
    const ts = new Date(now - ageMin * 60 * 1000).toISOString();

    features.push({
        type: 'Feature',
        geometry: {
            type: 'Point',
            coordinates: [tgt.lon, tgt.lat]
        },
        properties: {
            label: `${atk.type} → ${tgt.city}`,
            region: tgt.country,
            country: tgt.country,
            sourceCity: src.city,
            sourceCountry: src.country,
            targetCity: tgt.city,
            targetCountry: tgt.country,
            attackType: atk.type,
            icon: atk.icon,
            value: Math.round(sev),
            severity: sev > 22 ? 'Критическая' : sev > 15 ? 'Высокая' : 'Средняя',
            timestamp: ts
        }
    });
}

// Сортировка по времени (новые первыми)
features.sort((a, b) => new Date(b.properties.timestamp) - new Date(a.properties.timestamp));

const geojson = { type: 'FeatureCollection', features };
fs.writeFileSync('crucix-cyber-attacks.json', JSON.stringify(geojson, null, 2), 'utf-8');
console.log(`✅ crucix-cyber-attacks.json: ${features.length} объектов`);

// Статистика
const byType = {};
features.forEach(f => {
    const t = f.properties.attackType;
    byType[t] = (byType[t] || 0) + 1;
});
console.log('   По типам:', byType);
