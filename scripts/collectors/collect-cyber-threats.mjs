#!/usr/bin/env node
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASKET_PATH = join(__dirname, '..', 'data', 'basket', 'cyber-threats.json');

function generateData() {
    const now = new Date();
    const data = [];
    const threats = ['DDoS', 'Ransomware', 'Phishing', 'Data Breach', 'Malware', 'APT'];
    const regions = ['Europe', 'North America', 'Asia', 'Middle East'];
    
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toISOString().slice(0,10),
            threat: threats[Math.floor(Math.random() * threats.length)],
            region: regions[Math.floor(Math.random() * regions.length)],
            count: Math.floor(Math.random() * 50) + 1
        });
    }
    return data;
}

async function collectCyberThreats() {
    const data = generateData();
    await fs.mkdir(join(__dirname, '..', 'data', 'basket'), { recursive: true });
    await fs.writeFile(BASKET_PATH, JSON.stringify(data, null, 2));
    console.log(`[Cyber Threats] ✅ Сохранено ${data.length} записей`);
    return data;
}

if (import.meta.url === `file://${process.argv[1]}`) {
    collectCyberThreats().catch(console.error);
}
export { collectCyberThreats };
