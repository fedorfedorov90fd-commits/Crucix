#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('✅ СБОРЩИК ЗАПУЩЕН');

const FRED_API_KEY = process.env.FRED_API_KEY || '78abf54ae7e30d6a011d927002e387fc';
console.log('🔑 Ключ:', FRED_API_KEY.substring(0, 10) + '...');

const DATA_DIR = path.join(__dirname, '../data/indicators');
console.log('📁 Папка:', DATA_DIR);

if (!fs.existsSync(DATA_DIR)) {
    console.log('📁 Создаю папку...');
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function testFetch() {
    console.log('🟡 Загрузка цен на золото...');
    
    try {
        const url = 'https://api.stlouisfed.org/fred/series/observations';
        const params = {
            series_id: 'GOLDAMGBD228NLBM',
            api_key: FRED_API_KEY,
            file_type: 'json',
            limit: 5,
            sort_order: 'desc',
        };

        console.log('📡 Запрос к FRED API...');
        const response = await axios.get(url, { params, timeout: 30000 });
        
        console.log('📊 Статус:', response.status);
        console.log('📊 Данные получены:', response.data?.observations?.length || 0, 'записей');
        
        if (response.data && response.data.observations) {
            const data = response.data.observations;
            console.log('📊 Первая запись:', JSON.stringify(data[0], null, 2));
            
            // Сохраняем тестовые данные
            const testData = {
                timestamp: new Date().toISOString(),
                currentRatio: 24.56,
                avgRatio: 22.34,
                minRatio: 18.90,
                maxRatio: 28.76,
                riskLevel: 'normal',
                riskColor: '#22c55e',
                riskDesc: 'Нормальный уровень. Рынки стабильны.',
                history: [
                    { date: '2026-07-20', gold: 1975.60, oil: 81.70, ratio: 24.18 },
                    { date: '2026-08-20', gold: 1950.40, oil: 79.40, ratio: 24.56 }
                ],
                metadata: {
                    source: 'FRED API (test)',
                    dataPoints: 2,
                    lastUpdate: new Date().toISOString()
                },
                metrics: {
                    goldPrice: 1950.40,
                    oilPrice: 79.40,
                    ratioChange1d: 0.15,
                    ratioChange7d: 0.38
                }
            };
            
            const filePath = path.join(DATA_DIR, 'gold-oil-ratio.json');
            fs.writeFileSync(filePath, JSON.stringify(testData, null, 2));
            console.log('✅ Тестовые данные сохранены:', filePath);
        }
    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        if (error.response) {
            console.error('📡 Ответ:', error.response.status, error.response.statusText);
        }
    }
}

testFetch();
