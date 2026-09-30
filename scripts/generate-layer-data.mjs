import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASKET_DIR = join(__dirname, '../data/basket');

// Данные для каждого слоя
const layerData = {
    'economy': {
        file: 'economy.json',
        records: [
            { country: 'USA', gdp: 28.8, inflation: 3.2, lat: 39.8283, lng: -98.5795, region: 'US' },
            { country: 'China', gdp: 18.6, inflation: 2.1, lat: 35.8617, lng: 104.1954, region: 'ASIA' },
            { country: 'Germany', gdp: 4.7, inflation: 2.5, lat: 51.1657, lng: 10.4515, region: 'EU' },
            { country: 'India', gdp: 3.9, inflation: 4.8, lat: 20.5937, lng: 78.9629, region: 'ASIA' },
            { country: 'UK', gdp: 3.5, inflation: 3.1, lat: 55.3781, lng: -3.4360, region: 'EU' },
            { country: 'Brazil', gdp: 2.3, inflation: 4.2, lat: -14.2350, lng: -51.9253, region: 'BRAZIL' },
            { country: 'Russia', gdp: 2.1, inflation: 5.1, lat: 61.5240, lng: 105.3188, region: 'RUSSIA' },
            { country: 'Japan', gdp: 4.2, inflation: 1.8, lat: 36.2048, lng: 138.2529, region: 'JAPAN' }
        ]
    },
    'energy': {
        file: 'eia.json',
        records: [
            { country: 'USA', energy: 120, oil: 18.5, lat: 39.8283, lng: -98.5795, region: 'US' },
            { country: 'Saudi Arabia', energy: 80, oil: 10.2, lat: 23.8859, lng: 45.0792, region: 'MIDDLE_EAST' },
            { country: 'Russia', energy: 70, oil: 11.0, lat: 61.5240, lng: 105.3188, region: 'RUSSIA' },
            { country: 'China', energy: 65, oil: 8.5, lat: 35.8617, lng: 104.1954, region: 'ASIA' },
            { country: 'Canada', energy: 55, oil: 7.2, lat: 56.1304, lng: -106.3468, region: 'US' }
        ]
    },
    'cyber': {
        file: 'cyber-attacks.json',
        records: [
            { name: 'Ransomware attack', severity: 3, lat: 40.7128, lng: -74.0060, region: 'US' },
            { name: 'DDoS attack', severity: 2, lat: 51.5074, lng: -0.1278, region: 'EU' },
            { name: 'Data breach', severity: 3, lat: 35.6762, lng: 139.6503, region: 'JAPAN' },
            { name: 'Phishing campaign', severity: 1, lat: 22.3193, lng: 114.1694, region: 'ASIA' },
            { name: 'Malware outbreak', severity: 2, lat: 55.7558, lng: 37.6173, region: 'RUSSIA' }
        ]
    },
    'social-unrest': {
        file: 'social-unrest.json',
        records: [
            { country: 'France', intensity: 4, lat: 46.6033, lng: 1.8883, region: 'EU' },
            { country: 'India', intensity: 5, lat: 20.5937, lng: 78.9629, region: 'ASIA' },
            { country: 'Brazil', intensity: 3, lat: -14.2350, lng: -51.9253, region: 'BRAZIL' },
            { country: 'South Africa', intensity: 4, lat: -30.5595, lng: 22.9375, region: 'AFRICA' },
            { country: 'USA', intensity: 2, lat: 39.8283, lng: -98.5795, region: 'US' }
        ]
    },
    'ofac': {
        file: 'ofac.json',
        records: [
            { country: 'Russia', severity: 3, lat: 61.5240, lng: 105.3188, region: 'RUSSIA' },
            { country: 'Iran', severity: 3, lat: 32.4279, lng: 53.6880, region: 'MIDDLE_EAST' },
            { country: 'North Korea', severity: 3, lat: 40.3399, lng: 127.5101, region: 'ASIA' },
            { country: 'Syria', severity: 2, lat: 34.8021, lng: 38.9968, region: 'MIDDLE_EAST' },
            { country: 'Belarus', severity: 2, lat: 53.7098, lng: 27.9534, region: 'EU' }
        ]
    },
    'conflict-zones': {
        file: 'conflict-zones.json',
        records: [
            { type: 'war', severity: 'critical', lat: 48.3794, lng: 31.1656, region: 'UKRAINE' },
            { type: 'war', severity: 'critical', lat: 33.8886, lng: 35.4955, region: 'LEBANON' },
            { type: 'conflict', severity: 'high', lat: 15.5527, lng: 48.5164, region: 'YEMEN' },
            { type: 'conflict', severity: 'high', lat: 26.8206, lng: 30.8025, region: 'SUDAN' },
            { type: 'conflict', severity: 'medium', lat: 33.9391, lng: 67.7100, region: 'AFGHANISTAN' }
        ]
    }
};

async function generate() {
    await mkdir(BASKET_DIR, { recursive: true });
    for (const [key, data] of Object.entries(layerData)) {
        const filePath = join(BASKET_DIR, data.file);
        const records = data.records.map((r, i) => ({
            ...r,
            timestamp: new Date(Date.now() - i * 60000 * 60).toISOString()
        }));
        await writeFile(filePath, JSON.stringify(records, null, 2));
        console.log(`✅ ${data.file}: ${records.length} записей`);
    }
    console.log('✅ Все демо-данные созданы!');
}

generate().catch(console.error);
